/**
 * PUERTO SECUNDARIO (driven) — Generación de identificadores únicos.
 */
export interface GeneradorIdentificadores {
  nuevoId(prefijo: string): string;
}
