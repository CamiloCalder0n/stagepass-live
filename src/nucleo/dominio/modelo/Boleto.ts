/**
 * NÚCLEO › DOMINIO — Boleto digital (Ticket).
 * Regla: una boleta solo puede generarse si la orden fue aprobada,
 * es decir, si el pago fue exitoso y verificado.
 */
import { EstadoOrden } from './enumeraciones';
import { Orden } from './Orden';
import { DatosInvalidosError, PagoNoVerificadoError } from '../excepciones/errores';

export interface PropiedadesBoleto {
  id: string;
  ordenId: string;
  asientoId: string;
  codigoUbicacion: string;
  codigoRedencion: string;
  firmaHash: string;
  fechaEmision: Date;
}

/** Datos para emitir un boleto a partir de una orden aprobada. */
export interface DatosEmisionBoleto {
  id: string;
  orden: Orden;
  asientoId: string;
  codigoRedencion: string;
  firmaHash: string;
  fechaEmision: Date;
}

export class Boleto {
  readonly id: string;
  readonly ordenId: string;
  readonly asientoId: string;
  readonly codigoUbicacion: string;
  readonly codigoRedencion: string;
  readonly firmaHash: string;
  readonly fechaEmision: Date;

  private constructor(p: PropiedadesBoleto) {
    if (!p.codigoRedencion || !p.firmaHash) {
      throw new DatosInvalidosError('El boleto requiere código de redención y firma de seguridad.');
    }
    this.id = p.id;
    this.ordenId = p.ordenId;
    this.asientoId = p.asientoId;
    this.codigoUbicacion = p.codigoUbicacion;
    this.codigoRedencion = p.codigoRedencion;
    this.firmaHash = p.firmaHash;
    this.fechaEmision = p.fechaEmision;
  }

  /** Emite un boleto para un asiento de la orden. Falla si la orden no está aprobada. */
  static emitir(datos: DatosEmisionBoleto): Boleto {
    if (datos.orden.estado !== EstadoOrden.APROBADA) {
      throw new PagoNoVerificadoError(
        `No se puede emitir el boleto: la orden ${datos.orden.id} está "${datos.orden.estado}" y no tiene un pago aprobado.`
      );
    }
    const asiento = datos.orden.asientos.find((a) => a.asientoId === datos.asientoId);
    if (!asiento) throw new DatosInvalidosError(`El asiento ${datos.asientoId} no pertenece a la orden ${datos.orden.id}.`);

    return new Boleto({
      id: datos.id,
      ordenId: datos.orden.id,
      asientoId: asiento.asientoId,
      codigoUbicacion: asiento.codigoUbicacion,
      codigoRedencion: datos.codigoRedencion,
      firmaHash: datos.firmaHash,
      fechaEmision: datos.fechaEmision,
    });
  }

  static reconstituir(propiedades: PropiedadesBoleto): Boleto {
    return new Boleto(propiedades);
  }
}
