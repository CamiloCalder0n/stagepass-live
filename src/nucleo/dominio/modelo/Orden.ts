/**
 * NÚCLEO › DOMINIO — Reserva / Orden de compra (raíz de agregado).
 *
 * Ciclo de vida:
 *   Pendiente de Pago ──aprobar──▶ Aprobada
 *          │──rechazar──▶ Rechazada
 *          └──expirar───▶ Expirada   (pasados 10 minutos sin pago)
 */
import { EstadoOrden, MedioPago } from './enumeraciones';
import { AsientoSeleccionado, LiquidacionCompra } from './objetosValor';
import { DatosInvalidosError, TransicionEstadoInvalidaError } from '../excepciones/errores';
import { PoliticaBloqueoAsientos } from '../servicios/PoliticaBloqueoAsientos';

export interface PropiedadesOrden {
  id: string;
  clienteId: string;
  eventoId: string;
  asientos: AsientoSeleccionado[];
  valorBase: number;
  tarifaServicio: number;
  descuento: number;
  montoTotal: number;
  medioPago: MedioPago;
  fechaCreacion: Date;
  tiempoExpiracion: Date;
  estado: EstadoOrden;
  referenciaPago: string | null;
  idTransaccion: string | null;
}

/** Datos para crear una orden nueva. */
export interface DatosCreacionOrden {
  id: string;
  clienteId: string;
  eventoId: string;
  asientos: AsientoSeleccionado[];
  liquidacion: LiquidacionCompra;
  medioPago: MedioPago;
  ahora: Date;
}

export class Orden {
  readonly id: string;
  readonly clienteId: string;
  readonly eventoId: string;
  readonly asientos: readonly AsientoSeleccionado[];
  readonly valorBase: number;
  readonly tarifaServicio: number;
  readonly descuento: number;
  readonly montoTotal: number;
  readonly medioPago: MedioPago;
  readonly fechaCreacion: Date;
  readonly tiempoExpiracion: Date;
  private _estado: EstadoOrden;
  private _referenciaPago: string | null;
  private _idTransaccion: string | null;

  private constructor(p: PropiedadesOrden) {
    if (p.asientos.length === 0) throw new DatosInvalidosError('La orden debe incluir al menos un asiento.');
    if (p.montoTotal !== p.valorBase + p.tarifaServicio - p.descuento) {
      throw new DatosInvalidosError('El monto total no coincide con la liquidación de la orden.');
    }
    this.id = p.id;
    this.clienteId = p.clienteId;
    this.eventoId = p.eventoId;
    this.asientos = Object.freeze([...p.asientos]);
    this.valorBase = p.valorBase;
    this.tarifaServicio = p.tarifaServicio;
    this.descuento = p.descuento;
    this.montoTotal = p.montoTotal;
    this.medioPago = p.medioPago;
    this.fechaCreacion = p.fechaCreacion;
    this.tiempoExpiracion = p.tiempoExpiracion;
    this._estado = p.estado;
    this._referenciaPago = p.referenciaPago;
    this._idTransaccion = p.idTransaccion;
  }

  /** Crea una orden nueva: Pendiente de Pago y con bloqueo de 10 minutos. */
  static crear(datos: DatosCreacionOrden): Orden {
    return new Orden({
      id: datos.id,
      clienteId: datos.clienteId,
      eventoId: datos.eventoId,
      asientos: datos.asientos,
      valorBase: datos.liquidacion.valorBase,
      tarifaServicio: datos.liquidacion.tarifaServicio,
      descuento: datos.liquidacion.descuento,
      montoTotal: datos.liquidacion.montoTotal,
      medioPago: datos.medioPago,
      fechaCreacion: datos.ahora,
      tiempoExpiracion: PoliticaBloqueoAsientos.calcularExpiracion(datos.ahora),
      estado: EstadoOrden.PENDIENTE_PAGO,
      referenciaPago: null,
      idTransaccion: null,
    });
  }

  /** Reconstruye una orden existente (usado por los adaptadores de persistencia). */
  static reconstituir(propiedades: PropiedadesOrden): Orden {
    return new Orden(propiedades);
  }

  get estado(): EstadoOrden {
    return this._estado;
  }

  get referenciaPago(): string | null {
    return this._referenciaPago;
  }

  get idTransaccion(): string | null {
    return this._idTransaccion;
  }

  get cantidadBoletas(): number {
    return this.asientos.length;
  }

  asientoIds(): string[] {
    return this.asientos.map((a) => a.asientoId);
  }

  estaPendiente(): boolean {
    return this._estado === EstadoOrden.PENDIENTE_PAGO;
  }

  /** Pendiente y con el bloqueo de 10 minutos vencido. */
  estaVencida(ahora: Date): boolean {
    return this.estaPendiente() && PoliticaBloqueoAsientos.estaVencido(this.tiempoExpiracion, ahora);
  }

  /** Cuenta para el límite de 6 boletas: aprobada o pendiente aún vigente. */
  ocupaCupoDelCliente(ahora: Date): boolean {
    return this._estado === EstadoOrden.APROBADA || (this.estaPendiente() && !this.estaVencida(ahora));
  }

  asignarReferenciaPago(referencia: string): void {
    if (!this.estaPendiente()) throw new TransicionEstadoInvalidaError('Orden', this._estado, 'asignar referencia de pago');
    if (!referencia) throw new DatosInvalidosError('La referencia de pago no puede estar vacía.');
    this._referenciaPago = referencia;
  }

  aprobar(idTransaccion: string, ahora: Date): void {
    if (!this.estaPendiente()) throw new TransicionEstadoInvalidaError('Orden', this._estado, 'aprobar');
    if (this.estaVencida(ahora)) throw new TransicionEstadoInvalidaError('Orden', 'vencida', 'aprobar');
    this._estado = EstadoOrden.APROBADA;
    this._idTransaccion = idTransaccion;
  }

  rechazar(idTransaccion: string | null = null): void {
    if (!this.estaPendiente()) throw new TransicionEstadoInvalidaError('Orden', this._estado, 'rechazar');
    this._estado = EstadoOrden.RECHAZADA;
    this._idTransaccion = idTransaccion;
  }

  expirar(): void {
    if (!this.estaPendiente()) throw new TransicionEstadoInvalidaError('Orden', this._estado, 'expirar');
    this._estado = EstadoOrden.EXPIRADA;
  }
}
