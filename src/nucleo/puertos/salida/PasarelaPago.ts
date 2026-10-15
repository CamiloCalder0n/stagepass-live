/**
 * PUERTO SECUNDARIO (driven) — Puerto común para todas las pasarelas de pago.
 * Define las dos operaciones abstractas del negocio: registrar un cobro y
 * recibir (interpretar y autenticar) la confirmación del pago.
 * Implementaciones: Wompi (real), PayPal (dummy), PSE (dummy).
 */
import { MedioPago } from '../../dominio/modelo/enumeraciones';
import { ConfirmacionPago, NotificacionPago, RegistroPago, SolicitudPago } from '../../dominio/modelo/objetosValor';

export interface PasarelaPago {
  readonly medioPago: MedioPago;

  /** Registra el cobro en la pasarela y devuelve la referencia y la URL de pago. */
  registrarPago(solicitud: SolicitudPago): Promise<RegistroPago>;

  /**
   * Traduce la notificación asíncrona de la pasarela a una confirmación del dominio,
   * verificando su firma criptográfica.
   */
  recibirConfirmacion(notificacion: NotificacionPago): Promise<ConfirmacionPago>;
}
