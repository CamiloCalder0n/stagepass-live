/**
 * PUERTO SECUNDARIO (driven) — Localidades y su estado por función.
 * Origen actual: base de datos relacional legacy (MySQL).
 */
import { Asiento } from '../../dominio/modelo/Asiento';
import { EstadoAsiento } from '../../dominio/modelo/enumeraciones';

export interface RepositorioAsientos {
  /** Todos los asientos del recinto del evento, con su estado para esa función. */
  listarPorEvento(eventoId: string): Promise<Asiento[]>;

  buscarPorIds(eventoId: string, asientoIds: readonly string[]): Promise<Asiento[]>;

  /**
   * Persiste el nuevo estado de los asientos solo si su estado guardado sigue siendo
   * `estadoAnteriorEsperado` (control de concurrencia optimista).
   * @throws ConflictoConcurrenciaError si otro proceso los cambió primero.
   */
  actualizarEstados(eventoId: string, asientos: readonly Asiento[], estadoAnteriorEsperado: EstadoAsiento): Promise<void>;
}
