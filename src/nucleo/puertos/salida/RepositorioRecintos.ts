/**
 * PUERTO SECUNDARIO (driven) — Consulta de recintos y aforos.
 * Origen actual: base de datos relacional legacy (MySQL).
 */
import { Recinto } from '../../dominio/modelo/Recinto';

export interface RepositorioRecintos {
  listar(): Promise<Recinto[]>;
  buscarPorId(recintoId: string): Promise<Recinto | null>;
}
