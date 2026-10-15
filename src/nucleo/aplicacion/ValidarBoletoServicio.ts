/**
 * NÚCLEO › APLICACIÓN — Caso de uso: validar un boleto en el acceso al evento.
 * Recalcula la firma con los datos inmutables de la orden y la clave del evento:
 * si alguien altera el boleto (asiento, orden, código o fecha), la firma no coincide.
 */
import { RecursoNoEncontradoError } from '../dominio/excepciones/errores';
import { EstadoEvento, EstadoOrden } from '../dominio/modelo/enumeraciones';
import { RepresentacionGrafica } from '../dominio/modelo/objetosValor';
import { ContenidoFirmableBoleto } from '../dominio/servicios/ContenidoFirmableBoleto';
import { ResultadoValidacionBoleto, ValidarBoletoCasoUso } from '../puertos/entrada/ValidarBoletoCasoUso';
import { GeneradorCredencialesBoleto } from '../puertos/salida/GeneradorCredencialesBoleto';
import { RepositorioBoletos } from '../puertos/salida/RepositorioBoletos';
import { RepositorioEventos } from '../puertos/salida/RepositorioEventos';
import { RepositorioOrdenes } from '../puertos/salida/RepositorioOrdenes';

export class ValidarBoletoServicio implements ValidarBoletoCasoUso {
  constructor(
    private readonly boletos: RepositorioBoletos,
    private readonly ordenes: RepositorioOrdenes,
    private readonly eventos: RepositorioEventos,
    private readonly generadorCredenciales: GeneradorCredencialesBoleto
  ) {}

  async validar(codigoRedencion: string): Promise<ResultadoValidacionBoleto> {
    const boleto = await this.boletos.buscarPorCodigoRedencion(codigoRedencion.trim().toUpperCase());
    if (!boleto) return { valido: false, motivo: 'El código no corresponde a ningún boleto emitido.', boleto: null, evento: null };

    const orden = await this.ordenes.buscarPorId(boleto.ordenId);
    const evento = orden ? await this.eventos.buscarPorId(orden.eventoId) : null;
    if (!orden || !evento) return { valido: false, motivo: 'La orden o el evento del boleto no existen.', boleto, evento };
    if (orden.estado !== EstadoOrden.APROBADA) {
      return { valido: false, motivo: `La orden del boleto está "${orden.estado}".`, boleto, evento };
    }
    if (evento.estado === EstadoEvento.CANCELADO) return { valido: false, motivo: 'El evento fue cancelado.', boleto, evento };

    const contenido = ContenidoFirmableBoleto.desdeBoleto(boleto, orden);
    const firmaValida = this.generadorCredenciales.verificarFirma(contenido, evento.claveSecreta, boleto.firmaHash);
    return firmaValida
      ? { valido: true, motivo: 'Boleto auténtico: la firma de seguridad coincide.', boleto, evento }
      : { valido: false, motivo: 'Firma inválida: el boleto fue alterado o no lo emitió StagePass.', boleto, evento };
  }

  async obtenerRepresentacion(boletoId: string): Promise<RepresentacionGrafica> {
    const boleto = await this.boletos.buscarPorId(boletoId);
    if (!boleto) throw new RecursoNoEncontradoError('Boleto', boletoId);
    const orden = await this.ordenes.buscarPorId(boleto.ordenId);
    if (!orden) throw new RecursoNoEncontradoError('Orden', boleto.ordenId);
    const evento = await this.eventos.buscarPorId(orden.eventoId);
    if (!evento) throw new RecursoNoEncontradoError('Evento', orden.eventoId);
    return this.generadorCredenciales.generarRepresentacionGrafica(boleto, evento);
  }
}
