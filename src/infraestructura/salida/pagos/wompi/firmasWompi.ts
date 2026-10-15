/**
 * ADAPTADOR SECUNDARIO › WOMPI — Algoritmos de firma documentados por Wompi.
 *
 * 1. Firma de integridad del checkout:
 *      SHA256( referencia + montoEnCentavos + moneda + secretoIntegridad )
 * 2. Checksum de eventos (webhook):
 *      SHA256( valores de signature.properties concatenados + timestamp + secretoEventos )
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { EventoWompi } from './modelosWompi';

export function sha256Hex(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

export function firmaIntegridad(referencia: string, montoEnCentavos: number, moneda: string, secretoIntegridad: string): string {
  return sha256Hex(`${referencia}${montoEnCentavos}${moneda}${secretoIntegridad}`);
}

/** Lee una propiedad como "transaction.amount_in_cents" dentro de `data`. */
export function valorPropiedad(data: Record<string, unknown>, ruta: string): string {
  const valor = ruta.split('.').reduce<unknown>((actual, clave) => {
    if (actual && typeof actual === 'object') return (actual as Record<string, unknown>)[clave];
    return undefined;
  }, data);
  if (valor === undefined || valor === null) throw new Error(`La propiedad firmada "${ruta}" no existe en el evento.`);
  return String(valor);
}

export function checksumEvento(evento: Pick<EventoWompi, 'data' | 'signature' | 'timestamp'>, secretoEventos: string): string {
  const valores = evento.signature.properties.map((ruta) => valorPropiedad(evento.data, ruta)).join('');
  return sha256Hex(`${valores}${evento.timestamp}${secretoEventos}`);
}

/** Comparación en tiempo constante (evita ataques de temporización). */
export function sonIgualesHex(a: string, b: string): boolean {
  const x = Buffer.from(a.toLowerCase(), 'utf8');
  const y = Buffer.from(b.toLowerCase(), 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}
