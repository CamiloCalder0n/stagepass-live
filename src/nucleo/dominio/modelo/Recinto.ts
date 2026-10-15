/**
 * NÚCLEO › DOMINIO — Recinto (lugar físico de un evento).
 * Proviene del sistema legacy, pero el dominio lo modela como objeto puro.
 */
import { DatosInvalidosError } from '../excepciones/errores';

export class Recinto {
  constructor(
    readonly id: string,
    readonly nombre: string,
    readonly ciudad: string,
    readonly aforo: number
  ) {
    if (!id || !nombre.trim()) throw new DatosInvalidosError('El recinto requiere id y nombre.');
    if (!Number.isInteger(aforo) || aforo <= 0) throw new DatosInvalidosError('El aforo debe ser un entero positivo.');
  }
}
