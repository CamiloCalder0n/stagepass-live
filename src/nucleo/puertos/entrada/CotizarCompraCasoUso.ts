/**
 * PUERTO PRIMARIO (driving) — Calcular tarifa, descuento y total antes de comprar.
 */
import { LiquidacionCompra } from '../../dominio/modelo/objetosValor';

export interface ComandoCotizarCompra {
  readonly eventoId: string;
  readonly asientoIds: readonly string[];
}

export interface CotizarCompraCasoUso {
  ejecutar(comando: ComandoCotizarCompra): Promise<LiquidacionCompra>;
}
