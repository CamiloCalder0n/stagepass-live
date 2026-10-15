/**
 * PUERTO PRIMARIO (driving) — Consultar el estado de una orden y sus boletas.
 */
import { Boleto } from '../../dominio/modelo/Boleto';
import { Orden } from '../../dominio/modelo/Orden';

export interface DetalleOrden {
  readonly orden: Orden;
  readonly boletos: Boleto[];
}

export interface ConsultarOrdenCasoUso {
  ejecutar(ordenId: string): Promise<DetalleOrden>;
}
