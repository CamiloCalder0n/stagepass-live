/**
 * NÚCLEO › DOMINIO — Enumeraciones del lenguaje ubicuo de StagePass Live.
 * Objetos puros del lenguaje: sin anotaciones ni dependencias externas.
 */

export enum TipoEvento {
  CONCIERTO = 'Concierto',
  TEATRO = 'Teatro',
  FESTIVAL = 'Festival',
}

export enum EstadoEvento {
  PROGRAMADO = 'Programado',
  AGOTADO = 'Agotado',
  CANCELADO = 'Cancelado',
}

export enum EstadoAsiento {
  DISPONIBLE = 'Disponible',
  BLOQUEADO = 'Bloqueado',
  VENDIDO = 'Vendido',
}

export enum EstadoOrden {
  PENDIENTE_PAGO = 'Pendiente de Pago',
  APROBADA = 'Aprobada',
  RECHAZADA = 'Rechazada',
  EXPIRADA = 'Expirada',
}

/** Pasarelas con las que el negocio acepta pagos. */
export enum MedioPago {
  WOMPI = 'Wompi',
  PAYPAL = 'PayPal',
  PSE = 'PSE',
}

/** Resultado de una transacción, ya traducido al lenguaje del dominio. */
export enum EstadoTransaccion {
  APROBADA = 'Aprobada',
  RECHAZADA = 'Rechazada',
  PENDIENTE = 'Pendiente',
}

export enum CanalNotificacion {
  WHATSAPP = 'WhatsApp',
  CORREO = 'Correo electrónico',
}
