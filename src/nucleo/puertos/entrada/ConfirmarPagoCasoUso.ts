/**
 * PUERTO PRIMARIO (driving) — Procesar la notificación asíncrona de una pasarela:
 * aprobar o rechazar la orden y, si el pago es válido, emitir las boletas.
 */
import { Boleto } from '../../dominio/modelo/Boleto';
import { FacturaElectronica, NotificacionPago, ResultadoNotificacion } from '../../dominio/modelo/objetosValor';
import { Orden } from '../../dominio/modelo/Orden';

export interface ResultadoConfirmacionPago {
  readonly orden: Orden;
  readonly boletos: Boleto[];
  readonly factura: FacturaElectronica | null;
  readonly notificaciones: ResultadoNotificacion[];
  /** El pago llegó aprobado pero la orden ya había expirado: debe devolverse el dinero. */
  readonly requiereReembolso: boolean;
  /** true si la notificación ya se había procesado antes (reintento de la pasarela). */
  readonly duplicada: boolean;
  readonly advertencias: string[];
}

export interface ConfirmarPagoCasoUso {
  ejecutar(notificacion: NotificacionPago): Promise<ResultadoConfirmacionPago>;
}
