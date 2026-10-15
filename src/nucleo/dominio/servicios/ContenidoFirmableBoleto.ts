/**
 * NÚCLEO › DOMINIO › SERVICIO — Regla "Emisión y validación criptográfica".
 *
 * Define QUÉ se firma: los datos inmutables de la orden y del boleto, en un orden
 * canónico fijo. CÓMO se firma (HMAC-SHA256) es un detalle técnico del adaptador
 * que implementa el puerto GeneradorCredencialesBoleto, junto con la clave secreta del evento.
 */
import { Boleto } from '../modelo/Boleto';
import { Orden } from '../modelo/Orden';

export interface DatosFirmablesBoleto {
  readonly ordenId: string;
  readonly clienteId: string;
  readonly eventoId: string;
  readonly asientoId: string;
  readonly codigoUbicacion: string;
  readonly montoTotalOrden: number;
  readonly codigoRedencion: string;
  readonly fechaEmision: Date;
}

export class ContenidoFirmableBoleto {
  static readonly VERSION = 'STAGEPASS-v1';

  static construir(d: DatosFirmablesBoleto): string {
    return [
      ContenidoFirmableBoleto.VERSION,
      d.ordenId,
      d.clienteId,
      d.eventoId,
      d.asientoId,
      d.codigoUbicacion,
      String(d.montoTotalOrden),
      d.codigoRedencion,
      d.fechaEmision.toISOString(),
    ].join('|');
  }

  /** Reconstruye el contenido de un boleto ya emitido (para validarlo en la entrada al evento). */
  static desdeBoleto(boleto: Boleto, orden: Orden): string {
    return ContenidoFirmableBoleto.construir({
      ordenId: orden.id,
      clienteId: orden.clienteId,
      eventoId: orden.eventoId,
      asientoId: boleto.asientoId,
      codigoUbicacion: boleto.codigoUbicacion,
      montoTotalOrden: orden.montoTotal,
      codigoRedencion: boleto.codigoRedencion,
      fechaEmision: boleto.fechaEmision,
    });
  }
}
