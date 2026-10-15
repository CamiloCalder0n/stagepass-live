/**
 * PUERTO PRIMARIO (driving) — Registro y consulta de clientes.
 */
import { Cliente, DatosCliente } from '../../dominio/modelo/Cliente';

export interface GestionarClientesCasoUso {
  registrar(datos: DatosCliente): Promise<Cliente>;
  obtener(clienteId: string): Promise<Cliente>;
  listar(): Promise<Cliente[]>;
}
