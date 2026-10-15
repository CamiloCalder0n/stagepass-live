/**
 * PUERTO SECUNDARIO (driven) — Boletas emitidas.
 * Origen actual: base de datos documental (MongoDB).
 */
import { Boleto } from '../../dominio/modelo/Boleto';

export interface RepositorioBoletos {
  guardarTodos(boletos: readonly Boleto[]): Promise<void>;
  buscarPorId(boletoId: string): Promise<Boleto | null>;
  buscarPorCodigoRedencion(codigo: string): Promise<Boleto | null>;
  listarPorOrden(ordenId: string): Promise<Boleto[]>;
}
