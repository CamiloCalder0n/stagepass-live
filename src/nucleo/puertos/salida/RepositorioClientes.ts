/**
 * PUERTO SECUNDARIO (driven) — Clientes compradores.
 * Origen actual: base de datos documental (MongoDB).
 */
import { Cliente } from '../../dominio/modelo/Cliente';

export interface RepositorioClientes {
  listar(): Promise<Cliente[]>;
  buscarPorId(clienteId: string): Promise<Cliente | null>;
  buscarPorCorreo(correo: string): Promise<Cliente | null>;
  guardar(cliente: Cliente): Promise<void>;
}
