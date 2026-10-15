/**
 * NÚCLEO › APLICACIÓN — Caso de uso: consultar una orden y sus boletas.
 */
import { RecursoNoEncontradoError } from '../dominio/excepciones/errores';
import { ConsultarOrdenCasoUso, DetalleOrden } from '../puertos/entrada/ConsultarOrdenCasoUso';
import { LiberarReservasExpiradasCasoUso } from '../puertos/entrada/LiberarReservasExpiradasCasoUso';
import { RepositorioBoletos } from '../puertos/salida/RepositorioBoletos';
import { RepositorioOrdenes } from '../puertos/salida/RepositorioOrdenes';

export class ConsultarOrdenServicio implements ConsultarOrdenCasoUso {
  constructor(
    private readonly ordenes: RepositorioOrdenes,
    private readonly boletos: RepositorioBoletos,
    private readonly liberarReservas: LiberarReservasExpiradasCasoUso
  ) {}

  async ejecutar(ordenId: string): Promise<DetalleOrden> {
    const previa = await this.ordenes.buscarPorId(ordenId);
    if (!previa) throw new RecursoNoEncontradoError('Orden', ordenId);
    await this.liberarReservas.ejecutar(previa.eventoId);

    const orden = (await this.ordenes.buscarPorId(ordenId)) ?? previa;
    return { orden, boletos: await this.boletos.listarPorOrden(orden.id) };
  }
}
