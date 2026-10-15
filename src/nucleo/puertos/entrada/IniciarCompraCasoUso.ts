/**
 * PUERTO PRIMARIO (driving) — Iniciar compra: seleccionar asientos, bloquearlos
 * 10 minutos, liquidar la orden y registrar el cobro en la pasarela elegida.
 */
import { MedioPago } from '../../dominio/modelo/enumeraciones';
import { LiquidacionCompra, RegistroPago } from '../../dominio/modelo/objetosValor';
import { Orden } from '../../dominio/modelo/Orden';

export interface ComandoIniciarCompra {
  readonly clienteId: string;
  readonly eventoId: string;
  readonly asientoIds: readonly string[];
  readonly medioPago: MedioPago;
}

export interface ResultadoInicioCompra {
  readonly orden: Orden;
  readonly liquidacion: LiquidacionCompra;
  readonly registroPago: RegistroPago;
}

export interface IniciarCompraCasoUso {
  ejecutar(comando: ComandoIniciarCompra): Promise<ResultadoInicioCompra>;
}
