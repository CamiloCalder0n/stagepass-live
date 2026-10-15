/**
 * ADAPTADOR SECUNDARIO (DUMMY) — PSE (débito bancario, ACH Colombia).
 * Implementa el puerto PasarelaPago simulando el flujo de PSE: crear transacción
 * (devuelve la URL del banco) y recibir la confirmación con el CUS.
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

/** Forma (simplificada) de la confirmación de PSE. */
export interface ConfirmacionPse {
  referencia1: string;
  cus: string;
  estado: 'OK' | 'NOT_AUTHORIZED' | 'FAILED' | 'PENDING';
  valor: number;
}

export const TOKEN_PRUEBA_PSE = 'DUMMY-PSE-TOKEN';

const ESTADOS: Record<ConfirmacionPse['estado'], EstadoTransaccion> = {
  OK: EstadoTransaccion.APROBADA,
  NOT_AUTHORIZED: EstadoTransaccion.RECHAZADA,
  FAILED: EstadoTransaccion.RECHAZADA,
  PENDING: EstadoTransaccion.PENDIENTE,
};

export class AdaptadorPseDummy implements PasarelaPago {
  readonly medioPago = MedioPago.PSE;

  constructor(private readonly urlSimulador: string) {}

  async registrarPago(solicitud: SolicitudPago): Promise<RegistroPago> {
    // Real: createTransactionPayment → bankURL
    return {
      medioPago: this.medioPago,
      referencia: solicitud.referencia,
      urlPago: `${this.urlSimulador}?medio=PSE&ref=${encodeURIComponent(solicitud.referencia)}`,
    };
  }

  async recibirConfirmacion(notificacion: NotificacionPago): Promise<ConfirmacionPago> {
    let datos: ConfirmacionPse;
    try {
      datos = JSON.parse(notificacion.contenido) as ConfirmacionPse;
    } catch {
      throw new DatosInvalidosError('La notificación de PSE no es un JSON válido.');
    }
    if (!datos?.referencia1 || !datos.cus || !(datos.estado in ESTADOS)) {
      throw new DatosInvalidosError('Notificación de PSE incompleta o no soportada.');
    }
    // Real: getTransactionInformation(ticketId) para confirmar contra ACH
    const firmaVerificada = notificacion.metadatos['x-pse-token'] === TOKEN_PRUEBA_PSE;

    return {
      medioPago: this.medioPago,
      referencia: datos.referencia1,
      idTransaccion: `CUS-${datos.cus}`,
      estado: ESTADOS[datos.estado],
      montoPagado: datos.valor,
      firmaVerificada,
    };
  }
}
