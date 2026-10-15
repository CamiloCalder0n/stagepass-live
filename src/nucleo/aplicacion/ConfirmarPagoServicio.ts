/**
 * NÚCLEO › APLICACIÓN — Caso de uso: confirmar pago y emitir boletas.
 *
 * Regla: una boleta solo se genera si el pago fue exitoso y verificado:
 *   • la firma de la pasarela fue validada por su adaptador,
 *   • la transacción está aprobada,
 *   • el monto pagado coincide con el total de la orden,
 *   • la orden sigue pendiente y su bloqueo de 10 minutos no venció.
 * La firma hash de cada boleta se calcula con los datos inmutables de la orden
 * y la clave secreta del evento.
 */
import {
  PagoNoVerificadoError,
  RecursoNoEncontradoError,
} from '../dominio/excepciones/errores';
import { Boleto } from '../dominio/modelo/Boleto';
import { EstadoAsiento, EstadoOrden, EstadoTransaccion } from '../dominio/modelo/enumeraciones';
import { Evento } from '../dominio/modelo/Evento';
import {
  ConfirmacionPago,
  FacturaElectronica,
  NotificacionPago,
  ResultadoNotificacion,
} from '../dominio/modelo/objetosValor';
import { Orden } from '../dominio/modelo/Orden';
import { ContenidoFirmableBoleto } from '../dominio/servicios/ContenidoFirmableBoleto';
import { ConfirmarPagoCasoUso, ResultadoConfirmacionPago } from '../puertos/entrada/ConfirmarPagoCasoUso';
import { FacturadorElectronico } from '../puertos/salida/FacturadorElectronico';
import { GeneradorCredencialesBoleto } from '../puertos/salida/GeneradorCredencialesBoleto';
import { GeneradorIdentificadores } from '../puertos/salida/GeneradorIdentificadores';
import { Notificador } from '../puertos/salida/Notificador';
import { PasarelaPago } from '../puertos/salida/PasarelaPago';
import { Reloj } from '../puertos/salida/Reloj';
import { RepositorioAsientos } from '../puertos/salida/RepositorioAsientos';
import { RepositorioBoletos } from '../puertos/salida/RepositorioBoletos';
import { RepositorioClientes } from '../puertos/salida/RepositorioClientes';
import { RepositorioEventos } from '../puertos/salida/RepositorioEventos';
import { RepositorioOrdenes } from '../puertos/salida/RepositorioOrdenes';
import { GestorAsientosOrden } from './GestorAsientosOrden';
import { seleccionarPasarela } from './utilidades';

export class ConfirmarPagoServicio implements ConfirmarPagoCasoUso {
  constructor(
    private readonly pasarelas: readonly PasarelaPago[],
    private readonly ordenes: RepositorioOrdenes,
    private readonly boletos: RepositorioBoletos,
    private readonly eventos: RepositorioEventos,
    private readonly clientes: RepositorioClientes,
    private readonly asientos: RepositorioAsientos,
    private readonly gestorAsientos: GestorAsientosOrden,
    private readonly generadorCredenciales: GeneradorCredencialesBoleto,
    private readonly facturador: FacturadorElectronico,
    private readonly notificadores: readonly Notificador[],
    private readonly identificadores: GeneradorIdentificadores,
    private readonly reloj: Reloj
  ) {}

  async ejecutar(notificacion: NotificacionPago): Promise<ResultadoConfirmacionPago> {
    const pasarela = seleccionarPasarela(this.pasarelas, notificacion.medioPago);
    const confirmacion = await pasarela.recibirConfirmacion(notificacion);
    if (!confirmacion.firmaVerificada) {
      throw new PagoNoVerificadoError(`La firma de la notificación de ${confirmacion.medioPago} no es válida.`);
    }

    const orden = await this.ordenes.buscarPorReferenciaPago(confirmacion.referencia);
    if (!orden) throw new RecursoNoEncontradoError('Orden con referencia de pago', confirmacion.referencia);
    if (orden.medioPago !== confirmacion.medioPago) {
      throw new PagoNoVerificadoError(`La orden ${orden.id} no se pagó con ${confirmacion.medioPago}.`);
    }

    if (!orden.estaPendiente()) return this.procesarOrdenYaCerrada(orden, confirmacion);

    switch (confirmacion.estado) {
      case EstadoTransaccion.PENDIENTE:
        return this.resultado(orden, { advertencias: ['La pasarela reporta el pago en proceso; la orden sigue pendiente.'] });
      case EstadoTransaccion.RECHAZADA:
        return this.rechazar(orden, confirmacion);
      case EstadoTransaccion.APROBADA:
        return this.aprobar(orden, confirmacion);
    }
  }

  private async rechazar(orden: Orden, confirmacion: ConfirmacionPago): Promise<ResultadoConfirmacionPago> {
    orden.rechazar(confirmacion.idTransaccion);
    await this.gestorAsientos.liberar(orden);
    await this.ordenes.guardar(orden);
    return this.resultado(orden, { advertencias: ['Pago rechazado: los asientos fueron liberados.'] });
  }

  private async aprobar(orden: Orden, confirmacion: ConfirmacionPago): Promise<ResultadoConfirmacionPago> {
    const ahora = this.reloj.ahora();

    // Pago tardío: el bloqueo de 10 minutos ya venció.
    if (orden.estaVencida(ahora)) {
      orden.expirar();
      await this.gestorAsientos.liberar(orden);
      await this.ordenes.guardar(orden);
      return this.resultado(orden, {
        requiereReembolso: true,
        advertencias: ['El pago llegó después de los 10 minutos de bloqueo: la orden expiró y debe reembolsarse.'],
      });
    }

    if (confirmacion.montoPagado !== orden.montoTotal) {
      throw new PagoNoVerificadoError(
        `El monto pagado (${confirmacion.montoPagado}) no coincide con el total de la orden (${orden.montoTotal}).`
      );
    }

    const evento = await this.eventos.buscarPorId(orden.eventoId);
    if (!evento) throw new RecursoNoEncontradoError('Evento', orden.eventoId);
    const cliente = await this.clientes.buscarPorId(orden.clienteId);
    if (!cliente) throw new RecursoNoEncontradoError('Cliente', orden.clienteId);

    orden.aprobar(confirmacion.idTransaccion, ahora);
    await this.gestorAsientos.vender(orden);
    const boletos = this.emitirBoletos(orden, evento, ahora);
    await this.boletos.guardarTodos(boletos);
    await this.ordenes.guardar(orden);
    await this.marcarAgotadoSiCorresponde(evento);

    // Efectos secundarios: si fallan, la compra ya es válida; se reportan como advertencias.
    const advertencias: string[] = [];
    let factura: FacturaElectronica | null = null;
    try {
      factura = await this.facturador.emitirFactura(orden, cliente, evento);
    } catch (error) {
      advertencias.push(`Factura electrónica pendiente: ${mensajeDe(error)}`);
    }
    const notificaciones: ResultadoNotificacion[] = [];
    for (const notificador of this.notificadores) {
      try {
        notificaciones.push(await notificador.notificarCompraAprobada(cliente, evento, orden, boletos));
      } catch (error) {
        notificaciones.push({ canal: notificador.canal, enviado: false, detalle: mensajeDe(error) });
      }
    }
    return this.resultado(orden, { boletos, factura, notificaciones, advertencias });
  }

  private emitirBoletos(orden: Orden, evento: Evento, fechaEmision: Date): Boleto[] {
    return orden.asientos.map((asiento) => {
      const codigoRedencion = this.generadorCredenciales.generarCodigoRedencion();
      const contenido = ContenidoFirmableBoleto.construir({
        ordenId: orden.id,
        clienteId: orden.clienteId,
        eventoId: orden.eventoId,
        asientoId: asiento.asientoId,
        codigoUbicacion: asiento.codigoUbicacion,
        montoTotalOrden: orden.montoTotal,
        codigoRedencion,
        fechaEmision,
      });
      return Boleto.emitir({
        id: this.identificadores.nuevoId('BOL'),
        orden,
        asientoId: asiento.asientoId,
        codigoRedencion,
        firmaHash: this.generadorCredenciales.calcularFirma(contenido, evento.claveSecreta),
        fechaEmision,
      });
    });
  }

  private async marcarAgotadoSiCorresponde(evento: Evento): Promise<void> {
    const asientos = await this.asientos.listarPorEvento(evento.id);
    if (asientos.length > 0 && asientos.every((a) => a.estado === EstadoAsiento.VENDIDO) && evento.permiteVenta(this.reloj.ahora())) {
      evento.marcarAgotado();
      await this.eventos.guardar(evento);
    }
  }

  /** Reintentos de la pasarela o pagos que llegan para órdenes ya cerradas. */
  private async procesarOrdenYaCerrada(orden: Orden, confirmacion: ConfirmacionPago): Promise<ResultadoConfirmacionPago> {
    const mismaTransaccion = orden.idTransaccion !== null && orden.idTransaccion === confirmacion.idTransaccion;
    if (mismaTransaccion || (orden.estado === EstadoOrden.RECHAZADA && confirmacion.estado !== EstadoTransaccion.APROBADA)) {
      return this.resultado(orden, {
        boletos: await this.boletos.listarPorOrden(orden.id),
        duplicada: true,
        advertencias: ['Notificación repetida: no se emitieron boletas nuevas.'],
      });
    }
    const pagoAprobado = confirmacion.estado === EstadoTransaccion.APROBADA;
    return this.resultado(orden, {
      requiereReembolso: pagoAprobado,
      advertencias: [
        pagoAprobado
          ? `Se recibió un pago aprobado para la orden en estado "${orden.estado}": debe reembolsarse.`
          : `Notificación ignorada: la orden ya está "${orden.estado}".`,
      ],
    });
  }

  private resultado(orden: Orden, parcial: Partial<ResultadoConfirmacionPago>): ResultadoConfirmacionPago {
    return {
      orden,
      boletos: parcial.boletos ?? [],
      factura: parcial.factura ?? null,
      notificaciones: parcial.notificaciones ?? [],
      requiereReembolso: parcial.requiereReembolso ?? false,
      duplicada: parcial.duplicada ?? false,
      advertencias: parcial.advertencias ?? [],
    };
  }
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
