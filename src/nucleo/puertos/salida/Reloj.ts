/**
 * PUERTO SECUNDARIO (driven) — Fuente de tiempo.
 * Permite probar el bloqueo de 10 minutos sin esperar: en pruebas se inyecta un reloj controlado.
 */
export interface Reloj {
  ahora(): Date;
}
