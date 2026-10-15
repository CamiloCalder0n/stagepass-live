/**
 * NÚCLEO › DOMINIO › SERVICIO — Regla "Validación de identidad y límites".
 * Un cliente no puede acumular más de 6 boletas para un mismo evento.
 *
 * Se cuentan las órdenes aprobadas y las pendientes que siguen vigentes,
 * para que nadie evada el límite abriendo varias compras en paralelo.
 */
import { Orden } from '../modelo/Orden';
import { LimiteBoletasExcedidoError } from '../excepciones/errores';

export class PoliticaLimiteBoletas {
  static readonly MAXIMO_POR_EVENTO = 6;

  static boletasAcumuladas(ordenesDelClienteEnEvento: readonly Orden[], ahora: Date): number {
    return ordenesDelClienteEnEvento
      .filter((o) => o.ocupaCupoDelCliente(ahora))
      .reduce((suma, o) => suma + o.cantidadBoletas, 0);
  }

  static verificar(ordenesDelClienteEnEvento: readonly Orden[], solicitadas: number, ahora: Date): void {
    const acumuladas = PoliticaLimiteBoletas.boletasAcumuladas(ordenesDelClienteEnEvento, ahora);
    if (acumuladas + solicitadas > PoliticaLimiteBoletas.MAXIMO_POR_EVENTO) {
      throw new LimiteBoletasExcedidoError(acumuladas, solicitadas, PoliticaLimiteBoletas.MAXIMO_POR_EVENTO);
    }
  }
}
