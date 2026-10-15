/**
 * ADAPTADORES SECUNDARIOS DE SOPORTE — Reloj e identificadores.
 * Utilidades técnicas mínimas (no cuentan como adaptadores de negocio).
 */
import { randomUUID } from 'node:crypto';
import { GeneradorIdentificadores } from '../../../nucleo/puertos/salida/GeneradorIdentificadores';
import { Reloj } from '../../../nucleo/puertos/salida/Reloj';

export class RelojSistema implements Reloj {
  ahora(): Date {
    return new Date();
  }
}

export class GeneradorIdentificadoresUuid implements GeneradorIdentificadores {
  nuevoId(prefijo: string): string {
    return `${prefijo}-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }
}
