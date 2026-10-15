/**
 * ADAPTADOR SECUNDARIO (DUMMY) — Base de datos MySQL legacy emulada en memoria.
 *
 * Reproduce el esquema relacional heredado (nombres en snake_case, códigos de estado
 * abreviados, fechas como texto y precios DECIMAL como texto) para que los repositorios
 * dummy hagan el mismo mapeo técnico ↔ dominio que haría un adaptador con `mysql2`.
 * Ver docs/sql/legacy-mysql.sql para el DDL equivalente.
 */

export interface FilaRecinto {
  id_recinto: string;
  nombre: string;
  ciudad: string;
  aforo_total: number;
}

export interface FilaEvento {
  id_evento: string;
  nombre: string;
  tipo: 'CONC' | 'TEAT' | 'FEST';
  id_recinto: string;
  fecha_hora: string; // 'YYYY-MM-DD HH:MM:SS' hora de Bogotá
  estado: 'PROG' | 'AGOT' | 'CANC';
  clave_secreta: string;
}

export interface FilaAsiento {
  id_asiento: string;
  id_recinto: string;
  codigo_ubicacion: string;
  precio_base: string; // DECIMAL(12,2)
}

export interface FilaEstadoAsientoFuncion {
  id_evento: string;
  id_asiento: string;
  estado: 'D' | 'B' | 'V';
  version: number;
}

export interface TablasLegacy {
  recintos: FilaRecinto[];
  eventos: FilaEvento[];
  asientos: FilaAsiento[];
  estado_asiento_funcion: FilaEstadoAsientoFuncion[];
}

export class BaseDatosMySqlDummy {
  private readonly tablas: TablasLegacy;

  constructor(semilla: TablasLegacy) {
    this.tablas = structuredClone(semilla);
  }

  /** SELECT … — devuelve copias, como lo haría un driver real. */
  seleccionar<T extends keyof TablasLegacy>(tabla: T, filtro: (fila: TablasLegacy[T][number]) => boolean = () => true): TablasLegacy[T] {
    return structuredClone((this.tablas[tabla] as Array<TablasLegacy[T][number]>).filter(filtro)) as TablasLegacy[T];
  }

  /** UPDATE … SET … WHERE … — devuelve las filas afectadas. */
  actualizar<T extends keyof TablasLegacy>(
    tabla: T,
    filtro: (fila: TablasLegacy[T][number]) => boolean,
    cambios: (fila: TablasLegacy[T][number]) => Partial<TablasLegacy[T][number]>
  ): number {
    let afectadas = 0;
    for (const fila of this.tablas[tabla] as Array<TablasLegacy[T][number]>) {
      if (filtro(fila)) {
        Object.assign(fila, cambios(fila));
        afectadas++;
      }
    }
    return afectadas;
  }

  /** Ejecuta un bloque como transacción: si falla, restaura el estado anterior (ROLLBACK). */
  transaccion<R>(bloque: () => R): R {
    const respaldo = structuredClone(this.tablas);
    try {
      return bloque();
    } catch (error) {
      Object.assign(this.tablas, respaldo);
      throw error;
    }
  }
}
