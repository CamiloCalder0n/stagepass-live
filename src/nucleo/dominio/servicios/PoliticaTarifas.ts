/**
 * NÚCLEO › DOMINIO › SERVICIO — Regla "Cálculo de descuento por volumen y tarifa de emisión".
 *
 *   Boletos   Tarifa administrativa   Descuento comercial
 *   1 – 2            10 %                    0 %
 *   3 – 5             8 %                    5 %
 *   > 5 (corp.)       5 %                   10 %
 *
 * Ambos porcentajes se aplican sobre el valor base de las boletas.
 * Total = valor base + tarifa − descuento. Valores en pesos (COP), redondeados al peso.
 */
import { AsientoSeleccionado, LiquidacionCompra } from '../modelo/objetosValor';
import { DatosInvalidosError } from '../excepciones/errores';

export interface TramoTarifa {
  readonly desde: number;
  readonly hasta: number;
  readonly porcentajeTarifa: number;
  readonly porcentajeDescuento: number;
  readonly nombre: string;
}

export class PoliticaTarifas {
  static readonly TRAMOS: readonly TramoTarifa[] = Object.freeze([
    { desde: 1, hasta: 2, porcentajeTarifa: 0.1, porcentajeDescuento: 0, nombre: 'Individual' },
    { desde: 3, hasta: 5, porcentajeTarifa: 0.08, porcentajeDescuento: 0.05, nombre: 'Grupo' },
    { desde: 6, hasta: Number.POSITIVE_INFINITY, porcentajeTarifa: 0.05, porcentajeDescuento: 0.1, nombre: 'Corporativa' },
  ]);

  static tramoPara(cantidad: number): TramoTarifa {
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw new DatosInvalidosError('La compra debe incluir al menos un boleto.');
    }
    const tramo = PoliticaTarifas.TRAMOS.find((t) => cantidad >= t.desde && cantidad <= t.hasta);
    if (!tramo) throw new DatosInvalidosError(`No hay tramo de tarifa para ${cantidad} boletos.`);
    return tramo;
  }

  static liquidar(asientos: readonly AsientoSeleccionado[]): LiquidacionCompra {
    const tramo = PoliticaTarifas.tramoPara(asientos.length);
    const valorBase = asientos.reduce((suma, a) => suma + a.precioBase, 0);
    const tarifaServicio = Math.round(valorBase * tramo.porcentajeTarifa);
    const descuento = Math.round(valorBase * tramo.porcentajeDescuento);

    return Object.freeze({
      cantidadBoletas: asientos.length,
      valorBase,
      porcentajeTarifa: tramo.porcentajeTarifa,
      tarifaServicio,
      porcentajeDescuento: tramo.porcentajeDescuento,
      descuento,
      montoTotal: valorBase + tarifaServicio - descuento,
    });
  }
}
