/**
 * ADAPTADOR PRIMARIO (driving) — Tarea programada.
 * Cada cierto intervalo invoca el puerto LiberarReservasExpiradasCasoUso para liberar
 * los asientos de órdenes cuyo bloqueo de 10 minutos venció sin pago.
 * Para el núcleo, este temporizador es un actor externo igual que el navegador.
 */
import { LiberarReservasExpiradasCasoUso } from '../../../nucleo/puertos/entrada/LiberarReservasExpiradasCasoUso';

export class ProgramadorLiberacionReservas {
  private temporizador: NodeJS.Timeout | null = null;

  constructor(
    private readonly liberarReservas: LiberarReservasExpiradasCasoUso,
    private readonly intervaloMs: number,
    private readonly registrar: (mensaje: string) => void = console.log
  ) {}

  iniciar(): void {
    if (this.temporizador) return;
    this.temporizador = setInterval(() => void this.ejecutarUnaVez(), this.intervaloMs);
    this.temporizador.unref();
  }

  async ejecutarUnaVez(): Promise<number> {
    try {
      const expiradas = await this.liberarReservas.ejecutar();
      if (expiradas > 0) this.registrar(`[Programador] ${expiradas} orden(es) expirada(s); asientos liberados.`);
      return expiradas;
    } catch (error) {
      this.registrar(`[Programador] Error liberando reservas: ${(error as Error).message}`);
      return 0;
    }
  }

  detener(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
  }
}
