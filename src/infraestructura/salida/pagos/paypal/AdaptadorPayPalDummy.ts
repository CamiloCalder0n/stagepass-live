/**
 * ADAPTADOR SECUNDARIO (DUMMY) — PayPal.
 * Implementa el puerto PasarelaPago simulando el SDK de PayPal (Orders v2 + webhooks).
 * No llama a PayPal: devuelve una URL del simulador local y acepta notificaciones
 * con el formato de webhook PAYMENT.CAPTURE.* firmadas con un token de prueba.
 */
import { DatosInvalidosError } from '../../../../nucleo/dominio/excepciones/errores';
import { EstadoTransaccion, MedioPago } from '../../../../nucleo/dominio/modelo/enumeraciones';
import {
  ConfirmacionPago,
  NotificacionPago,
  RegistroPago,
  SolicitudPago,
} from '../../../../nucleo/dominio/modelo/objetosValor';
import { PasarelaPago } from '../../../../nucleo/puertos/salida/PasarelaPago';

/** Forma (simplificada) del webhook real de PayPal. */
export interface WebhookPayPal {
  event_type: 'PAYMENT.CAPTURE.COMPLETED' | 'PAYMENT.CAPTURE.DENIED' | 'PAYMENT.CAPTURE.PENDING';
  resource: { id: string; custom_id: string; status: string; amount: { currency_code: string; value: string } };
}

export const FIRMA_PRUEBA_PAYPAL = 'DUMMY-PAYPAL-TRANSMISSION-SIG';

const ESTADOS: Record<WebhookPayPal['event_type'], EstadoTransaccion> = {
  'PAYMENT.CAPTURE.COMPLETED': EstadoTransaccion.APROBADA,
  'PAYMENT.CAPTURE.DENIED': EstadoTransaccion.RECHAZADA,
  'PAYMENT.CAPTURE.PENDING': EstadoTransaccion.PENDIENTE,
};

export class AdaptadorPayPalDummy implements PasarelaPago {
  readonly medioPago = MedioPago.PAYPAL;

  constructor(private readonly urlSimulador: string) {}

  async registrarPago(solicitud: SolicitudPago): Promise<RegistroPago> {
    // Real: POST /v2/checkout/orders  → link "approve"
    return {
      medioPago: this.medioPago,
      referencia: solicitud.referencia,
      urlPago: `${this.urlSimulador}?medio=PayPal&ref=${encodeURIComponent(solicitud.referencia)}`,
    };
  }

  async recibirConfirmacion(notificacion: NotificacionPago): Promise<ConfirmacionPago> {
    let webhook: WebhookPayPal;
    try {
      webhook = JSON.parse(notificacion.contenido) as WebhookPayPal;
    } catch {
      throw new DatosInvalidosError('La notificación de PayPal no es un JSON válido.');
    }
    if (!(webhook?.event_type in ESTADOS) || !webhook.resource?.custom_id) {
      throw new DatosInvalidosError('Notificación de PayPal incompleta o no soportada.');
    }
    // Real: POST /v1/notifications/verify-webhook-signature
    const firmaVerificada = notificacion.metadatos['paypal-transmission-sig'] === FIRMA_PRUEBA_PAYPAL;

    return {
      medioPago: this.medioPago,
      referencia: webhook.resource.custom_id,
      idTransaccion: webhook.resource.id,
      estado: ESTADOS[webhook.event_type],
      montoPagado: Math.round(Number(webhook.resource.amount.value)),
      firmaVerificada,
    };
  }
}
