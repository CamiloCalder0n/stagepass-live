/**
 * PUERTO PRIMARIO (driving) — Liberar automáticamente los asientos de las órdenes
 * cuyo bloqueo de 10 minutos venció sin recibir el pago.
 */
export interface LiberarReservasExpiradasCasoUso {
  /** @returns cantidad de órdenes expiradas en esta ejecución. */
  ejecutar(eventoId?: string): Promise<number>;
}
