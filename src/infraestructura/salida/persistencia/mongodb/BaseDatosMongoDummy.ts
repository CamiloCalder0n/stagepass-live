/**
 * ADAPTADOR SECUNDARIO (DUMMY) — Base de datos MongoDB emulada en memoria.
 * Colecciones de documentos con `_id`, como las que manejaría el driver oficial `mongodb`.
 */

export interface DocumentoCliente {
  _id: string;
  nombre_completo: string;
  email: string;
  celular: string;
  nacionalidad: string;
  creado_en: Date;
}

export interface DocumentoOrden {
  _id: string;
  cliente_id: string;
  evento_id: string;
  asientos: { asiento_id: string; ubicacion: string; precio_base: number }[];
  liquidacion: { valor_base: number; tarifa_servicio: number; descuento: number; total: number };
  medio_pago: string;
  estado: string;
  creada_en: Date;
  expira_en: Date;
  pago: { referencia: string | null; transaccion: string | null };
}

export interface DocumentoBoleto {
  _id: string;
  orden_id: string;
  asiento_id: string;
  ubicacion: string;
  codigo_redencion: string;
  firma_hmac: string;
  emitido_en: Date;
}

export interface Colecciones {
  clientes: DocumentoCliente;
  ordenes: DocumentoOrden;
  boletos: DocumentoBoleto;
}

export class BaseDatosMongoDummy {
  private readonly colecciones: { [K in keyof Colecciones]: Map<string, Colecciones[K]> } = {
    clientes: new Map(),
    ordenes: new Map(),
    boletos: new Map(),
  };

  /** db.coleccion.find(filtro) */
  buscar<K extends keyof Colecciones>(coleccion: K, filtro: (doc: Colecciones[K]) => boolean = () => true): Colecciones[K][] {
    return [...this.colecciones[coleccion].values()].filter(filtro).map((d) => structuredClone(d));
  }

  /** db.coleccion.findOne(filtro) */
  buscarUno<K extends keyof Colecciones>(coleccion: K, filtro: (doc: Colecciones[K]) => boolean): Colecciones[K] | null {
    return this.buscar(coleccion, filtro)[0] ?? null;
  }

  /** db.coleccion.replaceOne({ _id }, doc, { upsert: true }) */
  reemplazar<K extends keyof Colecciones>(coleccion: K, documento: Colecciones[K]): void {
    this.colecciones[coleccion].set(documento._id, structuredClone(documento));
  }

  /** db.coleccion.insertMany(docs) */
  insertarVarios<K extends keyof Colecciones>(coleccion: K, documentos: Colecciones[K][]): void {
    for (const d of documentos) {
      if (this.colecciones[coleccion].has(d._id)) throw new Error(`E11000 duplicate key: ${d._id}`);
    }
    documentos.forEach((d) => this.colecciones[coleccion].set(d._id, structuredClone(d)));
  }
}
