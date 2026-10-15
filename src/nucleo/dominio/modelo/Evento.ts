/**
 * NÚCLEO › DOMINIO — Evento / Función.
 */
import { EstadoEvento, TipoEvento } from './enumeraciones';
import { DatosInvalidosError, EventoNoDisponibleError, TransicionEstadoInvalidaError } from '../excepciones/errores';

export class Evento {
  private _estado: EstadoEvento;

  /**
   * @param claveSecreta Clave privada del evento con la que se firman sus boletas.
   *                     Nunca se expone fuera del núcleo ni del adaptador de persistencia.
   */
  constructor(
    readonly id: string,
    readonly nombre: string,
    readonly tipo: TipoEvento,
    readonly recintoId: string,
    readonly fechaHora: Date,
    estado: EstadoEvento,
    readonly claveSecreta: string
  ) {
    if (!id || !nombre.trim() || !recintoId) throw new DatosInvalidosError('El evento requiere id, nombre y recinto.');
    if (Number.isNaN(fechaHora.getTime())) throw new DatosInvalidosError('La fecha/hora del evento no es válida.');
    if (!claveSecreta || claveSecreta.length < 16) {
      throw new DatosInvalidosError('La clave secreta del evento debe tener al menos 16 caracteres.');
    }
    this._estado = estado;
  }

  get estado(): EstadoEvento {
    return this._estado;
  }

  /** Solo se vende si está Programado y la función aún no ha ocurrido. */
  permiteVenta(ahora: Date): boolean {
    return this._estado === EstadoEvento.PROGRAMADO && this.fechaHora.getTime() > ahora.getTime();
  }

  validarDisponibleParaVenta(ahora: Date): void {
    if (this._estado !== EstadoEvento.PROGRAMADO) {
      throw new EventoNoDisponibleError(`El evento "${this.nombre}" está ${this._estado.toLowerCase()}.`);
    }
    if (this.fechaHora.getTime() <= ahora.getTime()) {
      throw new EventoNoDisponibleError(`El evento "${this.nombre}" ya se realizó.`);
    }
  }

  marcarAgotado(): void {
    if (this._estado !== EstadoEvento.PROGRAMADO) {
      throw new TransicionEstadoInvalidaError('Evento', this._estado, 'marcar agotado');
    }
    this._estado = EstadoEvento.AGOTADO;
  }

  cancelar(): void {
    if (this._estado === EstadoEvento.CANCELADO) {
      throw new TransicionEstadoInvalidaError('Evento', this._estado, 'cancelar');
    }
    this._estado = EstadoEvento.CANCELADO;
  }
}
