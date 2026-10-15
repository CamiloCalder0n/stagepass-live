/**
 * NÚCLEO › APLICACIÓN — Servicio interno compartido por los casos de uso:
 * aplica a los asientos de una orden las transiciones del dominio y las persiste.
 */
import { Orden } from '../dominio/modelo/Orden';
import { EstadoAsiento } from '../dominio/modelo/enumeraciones';
import { RepositorioAsientos } from '../puertos/salida/RepositorioAsientos';

export class GestorAsientosOrden {
  constructor(private readonly asientos: RepositorioAsientos) {}

  /** Bloqueado → Disponible para los asientos de la orden que sigan bloqueados. */
  async liberar(orden: Orden): Promise<void> {
    const asientos = (await this.asientos.buscarPorIds(orden.eventoId, orden.asientoIds())).filter(
      (a) => a.estado === EstadoAsiento.BLOQUEADO
    );
    if (asientos.length === 0) return;
    asientos.forEach((a) => a.liberar());
    await this.asientos.actualizarEstados(orden.eventoId, asientos, EstadoAsiento.BLOQUEADO);
  }

  /** Bloqueado → Vendido para todos los asientos de la orden. */
  async vender(orden: Orden): Promise<void> {
    const asientos = await this.asientos.buscarPorIds(orden.eventoId, orden.asientoIds());
    asientos.forEach((a) => a.vender());
    await this.asientos.actualizarEstados(orden.eventoId, asientos, EstadoAsiento.BLOQUEADO);
  }
}
