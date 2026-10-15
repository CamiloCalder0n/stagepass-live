/**
 * NÚCLEO › DOMINIO — Objetos de valor (inmutables, sin identidad).
 * Son los únicos tipos que cruzan los puertos junto con las entidades:
 * ningún DTO de PayPal, Wompi, SQL o HTTP entra al núcleo.
 */
import { CanalNotificacion, EstadoTransaccion, MedioPago } from './enumeraciones';

/** Copia del asiento al momento de la compra (precio congelado en la orden). */
export interface AsientoSeleccionado {
  readonly asientoId: string;
  readonly codigoUbicacion: string;
  readonly precioBase: number;
}

/** Resultado de aplicar la política de tarifas y descuentos por volumen. */
export interface LiquidacionCompra {
  readonly cantidadBoletas: number;
  readonly valorBase: number;
  readonly porcentajeTarifa: number;
  readonly tarifaServicio: number;
  readonly porcentajeDescuento: number;
  readonly descuento: number;
  readonly montoTotal: number;
}

/** Lo que el núcleo pide a cualquier pasarela para cobrar una orden. */
export interface SolicitudPago {
  readonly referencia: string;
  readonly montoTotal: number;
  readonly moneda: 'COP';
  readonly descripcion: string;
  readonly nombreCliente: string;
  readonly correoCliente: string;
  readonly telefonoCliente: string;
}

/** Respuesta de la pasarela al registrar el cobro. */
export interface RegistroPago {
  readonly medioPago: MedioPago;
  readonly referencia: string;
  readonly urlPago: string;
}

/**
 * Notificación asíncrona recibida desde una pasarela, en forma neutra:
 * el contenido original como texto y sus metadatos (ej. cabeceras de firma).
 * Solo el adaptador de cada pasarela sabe interpretarla.
 */
export interface NotificacionPago {
  readonly medioPago: MedioPago;
  readonly contenido: string;
  readonly metadatos: Readonly<Record<string, string>>;
}

/** Notificación ya interpretada y autenticada por el adaptador de la pasarela. */
export interface ConfirmacionPago {
  readonly medioPago: MedioPago;
  readonly referencia: string;
  readonly idTransaccion: string;
  readonly estado: EstadoTransaccion;
  readonly montoPagado: number;
  /** true solo si la firma criptográfica de la pasarela fue validada. */
  readonly firmaVerificada: boolean;
}

/** Imagen del boleto (ej. SVG con código QR). */
export interface RepresentacionGrafica {
  readonly tipoContenido: string;
  readonly contenido: string;
}

export interface FacturaElectronica {
  readonly numero: string;
  readonly cufe: string;
  readonly fechaEmision: Date;
}

export interface ResultadoNotificacion {
  readonly canal: CanalNotificacion;
  readonly enviado: boolean;
  readonly detalle: string;
}
