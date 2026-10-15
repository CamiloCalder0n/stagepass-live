/**
 * ADAPTADOR SECUNDARIO › WOMPI — Modelos técnicos propios de Wompi.
 * Estos tipos NUNCA cruzan el puerto: el adaptador los traduce a objetos del dominio.
 * Referencia: https://docs.wompi.co (Widget & Web Checkout, Eventos).
 */

/** Estados de transacción que reporta Wompi. */
export type EstadoTransaccionWompi = 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';

export interface TransaccionWompi {
  id: string;
  amount_in_cents: number;
  reference: string;
  customer_email?: string;
  currency: string;
  payment_method_type?: string;
  status: EstadoTransaccionWompi;
  [otro: string]: unknown;
}

/** Cuerpo del evento `transaction.updated` que Wompi envía al webhook. */
export interface EventoWompi {
  event: string;
  data: { transaction: TransaccionWompi; [otro: string]: unknown };
  environment?: 'test' | 'prod';
  signature: { properties: string[]; checksum: string };
  timestamp: number;
  sent_at?: string;
}

export interface ConfiguracionWompi {
  /** Llave pública del comercio (pub_test_… o pub_prod_…). */
  llavePublica: string;
  /** Secreto de integridad: firma los datos del checkout para que no se alteren. */
  secretoIntegridad: string;
  /** Secreto de eventos: verifica que las notificaciones vengan realmente de Wompi. */
  secretoEventos: string;
  /** URL base del Web Checkout de Wompi. */
  urlCheckout: string;
  /** Página a la que Wompi devuelve al comprador al terminar. */
  urlRedireccion: string;
}
