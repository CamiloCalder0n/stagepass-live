/**
 * PUERTO SECUNDARIO (driven) — Reservas / órdenes de compra.
 * Origen actual: base de datos documental (MongoDB).
 */
import { Orden } from '../../dominio/modelo/Orden';

export interface RepositorioOrdenes {
  guardar(orden: Orden): Promise<void>;
  buscarPorId(ordenId: string): Promise<Orden | null>;
  buscarPorReferenciaPago(referencia: string): Promise<Orden | null>;
  listarPorClienteYEvento(clienteId: string, eventoId: string): Promise<Orden[]>;
  /** Órdenes en "Pendiente de Pago" cuyo bloqueo venció en `ahora` (opcionalmente de un evento). */
  listarPendientesVencidas(ahora: Date, eventoId?: string): Promise<Orden[]>;
}
