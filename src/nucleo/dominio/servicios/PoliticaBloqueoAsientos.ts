/**
 * NÚCLEO › DOMINIO › SERVICIO — Regla "Bloqueo temporal de asientos".
 * Al iniciar la compra los asientos quedan bloqueados exactamente 10 minutos.
 */
export class PoliticaBloqueoAsientos {
  static readonly MINUTOS_BLOQUEO = 10;

  static calcularExpiracion(inicio: Date): Date {
    return new Date(inicio.getTime() + PoliticaBloqueoAsientos.MINUTOS_BLOQUEO * 60_000);
  }

  /** El bloqueo vence en el instante exacto de la expiración (límite incluido). */
  static estaVencido(expiracion: Date, ahora: Date): boolean {
    return ahora.getTime() >= expiracion.getTime();
  }
}
