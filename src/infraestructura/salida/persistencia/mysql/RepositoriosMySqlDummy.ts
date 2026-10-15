/**
 * ADAPTADORES SECUNDARIOS (DUMMY) — Repositorios del catálogo legacy MySQL.
 * Implementan RepositorioRecintos, RepositorioEventos y RepositorioAsientos.
 * Cada método indica la consulta SQL que ejecutaría la versión real con `mysql2`.
 */
import { ConflictoConcurrenciaError } from '../../../../nucleo/dominio/excepciones/errores';
import { Asiento } from '../../../../nucleo/dominio/modelo/Asiento';
import { EstadoAsiento, EstadoEvento, TipoEvento } from '../../../../nucleo/dominio/modelo/enumeraciones';
import { Evento } from '../../../../nucleo/dominio/modelo/Evento';
import { Recinto } from '../../../../nucleo/dominio/modelo/Recinto';
import { RepositorioAsientos } from '../../../../nucleo/puertos/salida/RepositorioAsientos';
import { RepositorioEventos } from '../../../../nucleo/puertos/salida/RepositorioEventos';
import { RepositorioRecintos } from '../../../../nucleo/puertos/salida/RepositorioRecintos';
import { BaseDatosMySqlDummy, FilaAsiento, FilaEvento, FilaRecinto } from './BaseDatosMySqlDummy';

// ---- Mapeo de códigos legacy ↔ enumeraciones del dominio ------------------
const TIPO_A_DOMINIO: Record<FilaEvento['tipo'], TipoEvento> = {
  CONC: TipoEvento.CONCIERTO,
  TEAT: TipoEvento.TEATRO,
  FEST: TipoEvento.FESTIVAL,
};
const ESTADO_EVENTO_A_DOMINIO: Record<FilaEvento['estado'], EstadoEvento> = {
  PROG: EstadoEvento.PROGRAMADO,
  AGOT: EstadoEvento.AGOTADO,
  CANC: EstadoEvento.CANCELADO,
};
const ESTADO_EVENTO_A_FILA: Record<EstadoEvento, FilaEvento['estado']> = {
  [EstadoEvento.PROGRAMADO]: 'PROG',
  [EstadoEvento.AGOTADO]: 'AGOT',
  [EstadoEvento.CANCELADO]: 'CANC',
};
const ESTADO_ASIENTO_A_DOMINIO = { D: EstadoAsiento.DISPONIBLE, B: EstadoAsiento.BLOQUEADO, V: EstadoAsiento.VENDIDO } as const;
const ESTADO_ASIENTO_A_FILA: Record<EstadoAsiento, 'D' | 'B' | 'V'> = {
  [EstadoAsiento.DISPONIBLE]: 'D',
  [EstadoAsiento.BLOQUEADO]: 'B',
  [EstadoAsiento.VENDIDO]: 'V',
};

/** '2026-12-05 20:00:00' (hora Colombia) → Date */
function fechaLegacyADate(texto: string): Date {
  return new Date(`${texto.replace(' ', 'T')}-05:00`);
}

export class RepositorioRecintosMySqlDummy implements RepositorioRecintos {
  constructor(private readonly bd: BaseDatosMySqlDummy) {}

  // SELECT id_recinto, nombre, ciudad, aforo_total FROM recintos
  async listar(): Promise<Recinto[]> {
    return this.bd.seleccionar('recintos').map(aRecinto);
  }

  // SELECT … FROM recintos WHERE id_recinto = ?
  async buscarPorId(recintoId: string): Promise<Recinto | null> {
    const [fila] = this.bd.seleccionar('recintos', (r) => r.id_recinto === recintoId);
    return fila ? aRecinto(fila) : null;
  }
}

export class RepositorioEventosMySqlDummy implements RepositorioEventos {
  constructor(private readonly bd: BaseDatosMySqlDummy) {}

  // SELECT … FROM eventos
  async listar(): Promise<Evento[]> {
    return this.bd.seleccionar('eventos').map(aEvento);
  }

  // SELECT … FROM eventos WHERE id_evento = ?
  async buscarPorId(eventoId: string): Promise<Evento | null> {
    const [fila] = this.bd.seleccionar('eventos', (e) => e.id_evento === eventoId);
    return fila ? aEvento(fila) : null;
  }

  // UPDATE eventos SET estado = ? WHERE id_evento = ?
  async guardar(evento: Evento): Promise<void> {
    this.bd.actualizar('eventos', (e) => e.id_evento === evento.id, () => ({ estado: ESTADO_EVENTO_A_FILA[evento.estado] }));
  }
}

export class RepositorioAsientosMySqlDummy implements RepositorioAsientos {
  constructor(private readonly bd: BaseDatosMySqlDummy) {}

  // SELECT a.*, e.estado FROM asientos a
  //   JOIN estado_asiento_funcion e ON e.id_asiento = a.id_asiento
  //  WHERE e.id_evento = ? ORDER BY a.codigo_ubicacion
  async listarPorEvento(eventoId: string): Promise<Asiento[]> {
    return this.consultar(eventoId);
  }

  // … AND a.id_asiento IN (?, ?, …)
  async buscarPorIds(eventoId: string, asientoIds: readonly string[]): Promise<Asiento[]> {
    const ids = new Set(asientoIds);
    return this.consultar(eventoId, (f) => ids.has(f.id_asiento));
  }

  // START TRANSACTION;
  // UPDATE estado_asiento_funcion SET estado = ?, version = version + 1
  //  WHERE id_evento = ? AND id_asiento = ? AND estado = ?;   -- concurrencia optimista
  // COMMIT;  (ROLLBACK si alguna fila no se afectó)
  async actualizarEstados(eventoId: string, asientos: readonly Asiento[], estadoAnteriorEsperado: EstadoAsiento): Promise<void> {
    const esperado = ESTADO_ASIENTO_A_FILA[estadoAnteriorEsperado];
    this.bd.transaccion(() => {
      for (const asiento of asientos) {
        const afectadas = this.bd.actualizar(
          'estado_asiento_funcion',
          (f) => f.id_evento === eventoId && f.id_asiento === asiento.id && f.estado === esperado,
          (f) => ({ estado: ESTADO_ASIENTO_A_FILA[asiento.estado], version: f.version + 1 })
        );
        if (afectadas !== 1) {
          throw new ConflictoConcurrenciaError(
            `El asiento ${asiento.codigoUbicacion} cambió de estado mientras se procesaba la solicitud. Intenta de nuevo.`
          );
        }
      }
    });
  }

  private consultar(eventoId: string, filtroAsiento: (f: FilaAsiento) => boolean = () => true): Asiento[] {
    const estados = new Map(
      this.bd.seleccionar('estado_asiento_funcion', (f) => f.id_evento === eventoId).map((f) => [f.id_asiento, f.estado])
    );
    return this.bd
      .seleccionar('asientos', (a) => estados.has(a.id_asiento) && filtroAsiento(a))
      .sort((a, b) => a.codigo_ubicacion.localeCompare(b.codigo_ubicacion, 'es', { numeric: true }))
      .map(
        (f) =>
          new Asiento(
            f.id_asiento,
            f.id_recinto,
            f.codigo_ubicacion,
            Math.round(Number(f.precio_base)),
            ESTADO_ASIENTO_A_DOMINIO[estados.get(f.id_asiento)!]
          )
      );
  }
}

function aRecinto(f: FilaRecinto): Recinto {
  return new Recinto(f.id_recinto, f.nombre, f.ciudad, f.aforo_total);
}

function aEvento(f: FilaEvento): Evento {
  return new Evento(
    f.id_evento,
    f.nombre,
    TIPO_A_DOMINIO[f.tipo],
    f.id_recinto,
    fechaLegacyADate(f.fecha_hora),
    ESTADO_EVENTO_A_DOMINIO[f.estado],
    f.clave_secreta
  );
}
