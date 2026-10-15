/**
 * NÚCLEO › APLICACIÓN — Caso de uso: liberar reservas expiradas.
 * Lo invocan el programador periódico (adaptador primario) y, de forma perezosa,
 * los casos de uso que necesitan disponibilidad exacta.
 */
import { LiberarReservasExpiradasCasoUso } from '../puertos/entrada/LiberarReservasExpiradasCasoUso';
import { RepositorioOrdenes } from '../puertos/salida/RepositorioOrdenes';
import { Reloj } from '../puertos/salida/Reloj';
import { GestorAsientosOrden } from './GestorAsientosOrden';

export class LiberarReservasExpiradasServicio implements LiberarReservasExpiradasCasoUso {
  constructor(
    private readonly ordenes: RepositorioOrdenes,
    private readonly gestorAsientos: GestorAsientosOrden,
    private readonly reloj: Reloj
  ) {}

  async ejecutar(eventoId?: string): Promise<number> {
    const ahora = this.reloj.ahora();
    const vencidas = await this.ordenes.listarPendientesVencidas(ahora, eventoId);
    for (const orden of vencidas) {
      orden.expirar();
      await this.gestorAsientos.liberar(orden);
      await this.ordenes.guardar(orden);
    }
    return vencidas.length;
  }
}
