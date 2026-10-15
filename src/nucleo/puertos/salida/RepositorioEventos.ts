/**
 * PUERTO SECUNDARIO (driven) — Catálogo de eventos.
 * Origen actual: base de datos relacional legacy (MySQL).
 */
import { Evento } from '../../dominio/modelo/Evento';

export interface RepositorioEventos {
  listar(): Promise<Evento[]>;
  buscarPorId(eventoId: string): Promise<Evento | null>;
  guardar(evento: Evento): Promise<void>;
}
