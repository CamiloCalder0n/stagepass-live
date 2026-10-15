/**
 * ADAPTADOR SECUNDARIO (REAL) — Pasarela de pagos Wompi.
 * Implementa el puerto PasarelaPago.
 *
 *  • registrarPago: arma la URL del Web Checkout de Wompi con la firma de integridad,
 *    de modo que el monto y la referencia no puedan alterarse en el navegador.
 *  • recibirConfirmacion: interpreta el evento `transaction.updated`, verifica su
 *    checksum con el secreto de eventos y lo traduce a ConfirmacionPago del dominio.
 *
 * El adaptador solo traduce: no decide si la orden se aprueba ni calcula montos.
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
import { checksumEvento, firmaIntegridad, sonIgualesHex } from './firmasWompi';
import { ConfiguracionWompi, EstadoTransaccionWompi, EventoWompi } from './modelosWompi';

const ESTADOS: Record<EstadoTransaccionWompi, EstadoTransaccion> = {
  APPROVED: EstadoTransaccion.APROBADA,
  DECLINED: EstadoTransaccion.RECHAZADA,
  VOIDED: EstadoTransaccion.RECHAZADA,
  ERROR: EstadoTransaccion.RECHAZADA,
  PENDING: EstadoTransaccion.PENDIENTE,
};

export class AdaptadorPasarelaWompi implements PasarelaPago {
  readonly medioPago = MedioPago.WOMPI;

  constructor(private readonly configuracion: ConfiguracionWompi) {
    if (!configuracion.llavePublica || !configuracion.secretoIntegridad || !configuracion.secretoEventos) {
      throw new Error('Wompi requiere llave pública, secreto de integridad y secreto de eventos.');
    }
  }

  async registrarPago(solicitud: SolicitudPago): Promise<RegistroPago> {
    const montoEnCentavos = solicitud.montoTotal * 100;
    const parametros = new URLSearchParams({
      'public-key': this.configuracion.llavePublica,
      currency: solicitud.moneda,
      'amount-in-cents': String(montoEnCentavos),
      reference: solicitud.referencia,
      'signature:integrity': firmaIntegridad(
        solicitud.referencia,
        montoEnCentavos,
        solicitud.moneda,
        this.configuracion.secretoIntegridad
      ),
      'redirect-url': this.configuracion.urlRedireccion,
      'customer-data:email': solicitud.correoCliente,
      'customer-data:full-name': solicitud.nombreCliente,
      'customer-data:phone-number': solicitud.telefonoCliente.replace(/^\+57/, ''),
    });
    return {
      medioPago: this.medioPago,
      referencia: solicitud.referencia,
      urlPago: `${this.configuracion.urlCheckout}?${parametros.toString()}`,
    };
  }

  async recibirConfirmacion(notificacion: NotificacionPago): Promise<ConfirmacionPago> {
    const evento = this.interpretar(notificacion.contenido);
    const transaccion = evento.data.transaction;

    let firmaVerificada = false;
    try {
      firmaVerificada = sonIgualesHex(checksumEvento(evento, this.configuracion.secretoEventos), evento.signature.checksum);
    } catch {
      firmaVerificada = false; // propiedades firmadas ausentes ⇒ notificación no confiable
    }

    return {
      medioPago: this.medioPago,
      referencia: transaccion.reference,
      idTransaccion: transaccion.id,
      estado: ESTADOS[transaccion.status],
      montoPagado: transaccion.amount_in_cents / 100,
      firmaVerificada,
    };
  }

  /** Valida la forma del JSON de Wompi y lo convierte en su modelo técnico. */
  private interpretar(contenido: string): EventoWompi {
    let evento: EventoWompi;
    try {
      evento = JSON.parse(contenido) as EventoWompi;
    } catch {
      throw new DatosInvalidosError('La notificación de Wompi no es un JSON válido.');
    }
    if (evento?.event !== 'transaction.updated') {
      throw new DatosInvalidosError(`Evento de Wompi no soportado: "${String(evento?.event)}".`);
    }
    const t = evento.data?.transaction;
    const valido =
      t &&
      typeof t.id === 'string' &&
      typeof t.reference === 'string' &&
      Number.isInteger(t.amount_in_cents) &&
      t.status in ESTADOS &&
      Array.isArray(evento.signature?.properties) &&
      typeof evento.signature?.checksum === 'string' &&
      Number.isFinite(evento.timestamp);
    if (!valido) throw new DatosInvalidosError('La notificación de Wompi está incompleta.');
    if (t.currency !== 'COP') throw new DatosInvalidosError(`Moneda no soportada: ${t.currency}.`);
    return evento;
  }
}
