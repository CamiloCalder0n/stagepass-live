/**
 * NÚCLEO › DOMINIO — Localidad / Asiento.
 * El estado (Disponible, Bloqueado, Vendido) corresponde a una función específica:
 * el repositorio entrega el asiento ya contextualizado en el evento consultado.
 */
import { EstadoAsiento } from './enumeraciones';
import { DatosInvalidosError, TransicionEstadoInvalidaError } from '../excepciones/errores';

export class Asiento {
  private _estado: EstadoAsiento;

  constructor(
    readonly id: string,
    readonly recintoId: string,
    readonly codigoUbicacion: string,
    readonly precioBase: number,
    estado: EstadoAsiento
  ) {
    if (!id || !recintoId || !codigoUbicacion.trim()) {
      throw new DatosInvalidosError('El asiento requiere id, recinto y código de ubicación.');
    }
    if (!Number.isInteger(precioBase) || precioBase <= 0) {
      throw new DatosInvalidosError(`El precio base de ${codigoUbicacion} debe ser un entero positivo (COP).`);
    }
    this._estado = estado;
  }

  get estado(): EstadoAsiento {
    return this._estado;
  }

  estaDisponible(): boolean {
    return this._estado === EstadoAsiento.DISPONIBLE;
  }

  /** Disponible → Bloqueado (inicio del proceso de compra). */
  bloquear(): void {
    this.transicionar(EstadoAsiento.DISPONIBLE, EstadoAsiento.BLOQUEADO, 'bloquear');
  }

  /** Bloqueado → Disponible (pago rechazado o bloqueo vencido). */
  liberar(): void {
    this.transicionar(EstadoAsiento.BLOQUEADO, EstadoAsiento.DISPONIBLE, 'liberar');
  }

  /** Bloqueado → Vendido (pago aprobado y verificado). */
  vender(): void {
    this.transicionar(EstadoAsiento.BLOQUEADO, EstadoAsiento.VENDIDO, 'vender');
  }

  private transicionar(desde: EstadoAsiento, hacia: EstadoAsiento, accion: string): void {
    if (this._estado !== desde) {
      throw new TransicionEstadoInvalidaError(`Asiento ${this.codigoUbicacion}`, this._estado, accion);
    }
    this._estado = hacia;
  }
}
