/**
 * ADAPTADOR PRIMARIO › REST — Traducción de objetos del dominio a JSON de respuesta.
 * Aquí, y solo aquí, se decide la forma del JSON. La clave secreta del evento nunca se expone.
 */
import { Asiento } from '../../../nucleo/dominio/modelo/Asiento';
import { Boleto } from '../../../nucleo/dominio/modelo/Boleto';
import { Cliente } from '../../../nucleo/dominio/modelo/Cliente';
import { Evento } from '../../../nucleo/dominio/modelo/Evento';
import { LiquidacionCompra } from '../../../nucleo/dominio/modelo/objetosValor';
import { Orden } from '../../../nucleo/dominio/modelo/Orden';
import { Recinto } from '../../../nucleo/dominio/modelo/Recinto';
import { ResultadoConfirmacionPago } from '../../../nucleo/puertos/entrada/ConfirmarPagoCasoUso';
import { EventoEnCartelera } from '../../../nucleo/puertos/entrada/ConsultarCatalogoCasoUso';
import { ResultadoValidacionBoleto } from '../../../nucleo/puertos/entrada/ValidarBoletoCasoUso';

export const eventoJson = (e: Evento) => ({
  id: e.id,
  nombre: e.nombre,
  tipo: e.tipo,
  recintoId: e.recintoId,
  fechaHora: e.fechaHora.toISOString(),
  estado: e.estado,
});

export const recintoJson = (r: Recinto) => ({ id: r.id, nombre: r.nombre, ciudad: r.ciudad, aforo: r.aforo });

export const carteleraJson = (c: EventoEnCartelera) => ({
  ...eventoJson(c.evento),
  recinto: recintoJson(c.recinto),
  asientosDisponibles: c.asientosDisponibles,
});

export const asientoJson = (a: Asiento) => ({
  id: a.id,
  recintoId: a.recintoId,
  codigoUbicacion: a.codigoUbicacion,
  precioBase: a.precioBase,
  estado: a.estado,
});

export const clienteJson = (c: Cliente) => ({
  id: c.id,
  nombreCompleto: c.nombreCompleto,
  correo: c.correo,
  telefonoMovil: c.telefonoMovil,
  nacionalidad: c.nacionalidad,
});

export const liquidacionJson = (l: LiquidacionCompra) => ({ ...l });

export const ordenJson = (o: Orden) => ({
  id: o.id,
  clienteId: o.clienteId,
  eventoId: o.eventoId,
  asientos: o.asientos.map((a) => ({ ...a })),
  valorBase: o.valorBase,
  tarifaServicio: o.tarifaServicio,
  descuento: o.descuento,
  montoTotal: o.montoTotal,
  medioPago: o.medioPago,
  estado: o.estado,
  fechaCreacion: o.fechaCreacion.toISOString(),
  tiempoExpiracion: o.tiempoExpiracion.toISOString(),
  referenciaPago: o.referenciaPago,
  idTransaccion: o.idTransaccion,
});

export const boletoJson = (b: Boleto) => ({
  id: b.id,
  ordenId: b.ordenId,
  asientoId: b.asientoId,
  codigoUbicacion: b.codigoUbicacion,
  codigoRedencion: b.codigoRedencion,
  firmaHash: b.firmaHash,
  fechaEmision: b.fechaEmision.toISOString(),
  representacionUrl: `/api/boletos/${encodeURIComponent(b.id)}/representacion`,
});

export const confirmacionJson = (r: ResultadoConfirmacionPago) => ({
  orden: ordenJson(r.orden),
  boletos: r.boletos.map(boletoJson),
  factura: r.factura ? { ...r.factura, fechaEmision: r.factura.fechaEmision.toISOString() } : null,
  notificaciones: r.notificaciones,
  requiereReembolso: r.requiereReembolso,
  duplicada: r.duplicada,
  advertencias: r.advertencias,
});

export const validacionJson = (v: ResultadoValidacionBoleto) => ({
  valido: v.valido,
  motivo: v.motivo,
  boleto: v.boleto ? boletoJson(v.boleto) : null,
  evento: v.evento ? eventoJson(v.evento) : null,
});
