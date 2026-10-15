/**
 * NÚCLEO › APLICACIÓN — Caso de uso: iniciar compra.
 *
 *  1. Validar cliente, evento disponible y asientos seleccionados.
 *  2. Liberar bloqueos vencidos del evento (para ver disponibilidad real).
 *  3. Verificar el límite de 6 boletas por cliente y evento.
 *  4. Liquidar tarifa y descuento por volumen.
 *  5. Bloquear los asientos 10 minutos y crear la orden "Pendiente de Pago".
 *  6. Registrar el cobro en la pasarela elegida.
 *     Si la pasarela falla, compensa: libera los asientos y rechaza la orden.
 */
import { RecursoNoEncontradoError, ServicioExternoError } from '../dominio/excepciones/errores';
import { EstadoAsiento } from '../dominio/modelo/enumeraciones';
import { Orden } from '../dominio/modelo/Orden';
import { PoliticaLimiteBoletas } from '../dominio/servicios/PoliticaLimiteBoletas';
import { PoliticaTarifas } from '../dominio/servicios/PoliticaTarifas';
import {
  ComandoIniciarCompra,
  IniciarCompraCasoUso,
  ResultadoInicioCompra,
} from '../puertos/entrada/IniciarCompraCasoUso';
import { LiberarReservasExpiradasCasoUso } from '../puertos/entrada/LiberarReservasExpiradasCasoUso';
import { GeneradorIdentificadores } from '../puertos/salida/GeneradorIdentificadores';
import { PasarelaPago } from '../puertos/salida/PasarelaPago';
import { Reloj } from '../puertos/salida/Reloj';
import { RepositorioAsientos } from '../puertos/salida/RepositorioAsientos';
import { RepositorioClientes } from '../puertos/salida/RepositorioClientes';
import { RepositorioEventos } from '../puertos/salida/RepositorioEventos';
import { RepositorioOrdenes } from '../puertos/salida/RepositorioOrdenes';
import { GestorAsientosOrden } from './GestorAsientosOrden';
import { aSeleccion, cargarAsientosDisponibles, exigirIdsUnicos, seleccionarPasarela } from './utilidades';

export class IniciarCompraServicio implements IniciarCompraCasoUso {
  constructor(
    private readonly clientes: RepositorioClientes,
    private readonly eventos: RepositorioEventos,
    private readonly asientos: RepositorioAsientos,
    private readonly ordenes: RepositorioOrdenes,
    private readonly pasarelas: readonly PasarelaPago[],
    private readonly gestorAsientos: GestorAsientosOrden,
    private readonly liberarReservas: LiberarReservasExpiradasCasoUso,
    private readonly identificadores: GeneradorIdentificadores,
    private readonly reloj: Reloj
  ) {}

  async ejecutar(comando: ComandoIniciarCompra): Promise<ResultadoInicioCompra> {
    const asientoIds = exigirIdsUnicos(comando.asientoIds);
    const pasarela = seleccionarPasarela(this.pasarelas, comando.medioPago);

    const cliente = await this.clientes.buscarPorId(comando.clienteId);
    if (!cliente) throw new RecursoNoEncontradoError('Cliente', comando.clienteId);
    const evento = await this.eventos.buscarPorId(comando.eventoId);
    if (!evento) throw new RecursoNoEncontradoError('Evento', comando.eventoId);

    const ahora = this.reloj.ahora();
    evento.validarDisponibleParaVenta(ahora);
    await this.liberarReservas.ejecutar(evento.id);

    // Regla: máximo 6 boletas acumuladas por cliente y evento.
    const ordenesPrevias = await this.ordenes.listarPorClienteYEvento(cliente.id, evento.id);
    PoliticaLimiteBoletas.verificar(ordenesPrevias, asientoIds.length, ahora);

    // Regla: tarifa y descuento por volumen.
    const asientos = await cargarAsientosDisponibles(this.asientos, evento.id, asientoIds);
    const seleccion = aSeleccion(asientos);
    const liquidacion = PoliticaTarifas.liquidar(seleccion);

    // Regla: bloqueo temporal de 10 minutos.
    asientos.forEach((a) => a.bloquear());
    await this.asientos.actualizarEstados(evento.id, asientos, EstadoAsiento.DISPONIBLE);

    const orden = Orden.crear({
      id: this.identificadores.nuevoId('ORD'),
      clienteId: cliente.id,
      eventoId: evento.id,
      asientos: seleccion,
      liquidacion,
      medioPago: pasarela.medioPago,
      ahora,
    });
    await this.ordenes.guardar(orden);

    try {
      const registroPago = await pasarela.registrarPago({
        referencia: orden.id,
        montoTotal: orden.montoTotal,
        moneda: 'COP',
        descripcion: `${evento.nombre} — ${orden.cantidadBoletas} boleta(s)`,
        nombreCliente: cliente.nombreCompleto,
        correoCliente: cliente.correo,
        telefonoCliente: cliente.telefonoMovil,
      });
      orden.asignarReferenciaPago(registroPago.referencia);
      await this.ordenes.guardar(orden);
      return { orden, liquidacion, registroPago };
    } catch (error) {
      // Compensación: no dejar asientos bloqueados por una orden que no se pudo cobrar.
      orden.rechazar();
      await this.gestorAsientos.liberar(orden);
      await this.ordenes.guardar(orden);
      const detalle = error instanceof Error ? error.message : String(error);
      throw new ServicioExternoError(pasarela.medioPago, detalle);
    }
  }
}
