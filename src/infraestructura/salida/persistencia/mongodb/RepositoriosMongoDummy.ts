/**
 * ADAPTADORES SECUNDARIOS (DUMMY) — Repositorios de MongoDB.
 * Implementan RepositorioClientes, RepositorioOrdenes y RepositorioBoletos,
 * mapeando documentos ↔ entidades del dominio. Cada método indica la operación
 * equivalente del driver oficial `mongodb`.
 */
import { Boleto } from '../../../../nucleo/dominio/modelo/Boleto';
import { Cliente } from '../../../../nucleo/dominio/modelo/Cliente';
import { EstadoOrden, MedioPago } from '../../../../nucleo/dominio/modelo/enumeraciones';
import { Orden } from '../../../../nucleo/dominio/modelo/Orden';
import { RepositorioBoletos } from '../../../../nucleo/puertos/salida/RepositorioBoletos';
import { RepositorioClientes } from '../../../../nucleo/puertos/salida/RepositorioClientes';
import { RepositorioOrdenes } from '../../../../nucleo/puertos/salida/RepositorioOrdenes';
import { BaseDatosMongoDummy, DocumentoBoleto, DocumentoCliente, DocumentoOrden } from './BaseDatosMongoDummy';

export class RepositorioClientesMongoDummy implements RepositorioClientes {
  constructor(private readonly bd: BaseDatosMongoDummy) {}

  // db.clientes.find().sort({ nombre_completo: 1 })
  async listar(): Promise<Cliente[]> {
    return this.bd
      .buscar('clientes')
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
      .map(aCliente);
  }

  // db.clientes.findOne({ _id })
  async buscarPorId(clienteId: string): Promise<Cliente | null> {
    const doc = this.bd.buscarUno('clientes', (d) => d._id === clienteId);
    return doc ? aCliente(doc) : null;
  }

  // db.clientes.findOne({ email })   — índice único sobre email
  async buscarPorCorreo(correo: string): Promise<Cliente | null> {
    const doc = this.bd.buscarUno('clientes', (d) => d.email === correo.trim().toLowerCase());
    return doc ? aCliente(doc) : null;
  }

  // db.clientes.replaceOne({ _id }, doc, { upsert: true })
  async guardar(cliente: Cliente): Promise<void> {
    const previo = this.bd.buscarUno('clientes', (d) => d._id === cliente.id);
    this.bd.reemplazar('clientes', {
      _id: cliente.id,
      nombre_completo: cliente.nombreCompleto,
      email: cliente.correo,
      celular: cliente.telefonoMovil,
      nacionalidad: cliente.nacionalidad,
      creado_en: previo?.creado_en ?? new Date(),
    });
  }
}

export class RepositorioOrdenesMongoDummy implements RepositorioOrdenes {
  constructor(private readonly bd: BaseDatosMongoDummy) {}

  // db.ordenes.replaceOne({ _id }, doc, { upsert: true })
  async guardar(orden: Orden): Promise<void> {
    this.bd.reemplazar('ordenes', aDocumentoOrden(orden));
  }

  // db.ordenes.findOne({ _id })
  async buscarPorId(ordenId: string): Promise<Orden | null> {
    const doc = this.bd.buscarUno('ordenes', (d) => d._id === ordenId);
    return doc ? aOrden(doc) : null;
  }

  // db.ordenes.findOne({ 'pago.referencia': referencia })
  async buscarPorReferenciaPago(referencia: string): Promise<Orden | null> {
    const doc = this.bd.buscarUno('ordenes', (d) => d.pago.referencia === referencia);
    return doc ? aOrden(doc) : null;
  }

  // db.ordenes.find({ cliente_id, evento_id })
  async listarPorClienteYEvento(clienteId: string, eventoId: string): Promise<Orden[]> {
    return this.bd.buscar('ordenes', (d) => d.cliente_id === clienteId && d.evento_id === eventoId).map(aOrden);
  }

  // db.ordenes.find({ estado: 'Pendiente de Pago', expira_en: { $lte: ahora }, [evento_id] })
  async listarPendientesVencidas(ahora: Date, eventoId?: string): Promise<Orden[]> {
    return this.bd
      .buscar(
        'ordenes',
        (d) =>
          d.estado === EstadoOrden.PENDIENTE_PAGO &&
          d.expira_en.getTime() <= ahora.getTime() &&
          (eventoId === undefined || d.evento_id === eventoId)
      )
      .map(aOrden);
  }
}

export class RepositorioBoletosMongoDummy implements RepositorioBoletos {
  constructor(private readonly bd: BaseDatosMongoDummy) {}

  // db.boletos.insertMany(docs)   — índice único sobre codigo_redencion
  async guardarTodos(boletos: readonly Boleto[]): Promise<void> {
    this.bd.insertarVarios(
      'boletos',
      boletos.map((b) => ({
        _id: b.id,
        orden_id: b.ordenId,
        asiento_id: b.asientoId,
        ubicacion: b.codigoUbicacion,
        codigo_redencion: b.codigoRedencion,
        firma_hmac: b.firmaHash,
        emitido_en: b.fechaEmision,
      }))
    );
  }

  async buscarPorId(boletoId: string): Promise<Boleto | null> {
    const doc = this.bd.buscarUno('boletos', (d) => d._id === boletoId);
    return doc ? aBoleto(doc) : null;
  }

  // db.boletos.findOne({ codigo_redencion })
  async buscarPorCodigoRedencion(codigo: string): Promise<Boleto | null> {
    const doc = this.bd.buscarUno('boletos', (d) => d.codigo_redencion === codigo);
    return doc ? aBoleto(doc) : null;
  }

  // db.boletos.find({ orden_id }).sort({ ubicacion: 1 })
  async listarPorOrden(ordenId: string): Promise<Boleto[]> {
    return this.bd
      .buscar('boletos', (d) => d.orden_id === ordenId)
      .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion, 'es', { numeric: true }))
      .map(aBoleto);
  }
}

// ---- Mapeadores documento ↔ dominio -------------------------------------------

function aCliente(d: DocumentoCliente): Cliente {
  return new Cliente(d._id, {
    nombreCompleto: d.nombre_completo,
    correo: d.email,
    telefonoMovil: d.celular,
    nacionalidad: d.nacionalidad,
  });
}

function aDocumentoOrden(o: Orden): DocumentoOrden {
  return {
    _id: o.id,
    cliente_id: o.clienteId,
    evento_id: o.eventoId,
    asientos: o.asientos.map((a) => ({ asiento_id: a.asientoId, ubicacion: a.codigoUbicacion, precio_base: a.precioBase })),
    liquidacion: { valor_base: o.valorBase, tarifa_servicio: o.tarifaServicio, descuento: o.descuento, total: o.montoTotal },
    medio_pago: o.medioPago,
    estado: o.estado,
    creada_en: o.fechaCreacion,
    expira_en: o.tiempoExpiracion,
    pago: { referencia: o.referenciaPago, transaccion: o.idTransaccion },
  };
}

function aOrden(d: DocumentoOrden): Orden {
  return Orden.reconstituir({
    id: d._id,
    clienteId: d.cliente_id,
    eventoId: d.evento_id,
    asientos: d.asientos.map((a) => ({ asientoId: a.asiento_id, codigoUbicacion: a.ubicacion, precioBase: a.precio_base })),
    valorBase: d.liquidacion.valor_base,
    tarifaServicio: d.liquidacion.tarifa_servicio,
    descuento: d.liquidacion.descuento,
    montoTotal: d.liquidacion.total,
    medioPago: d.medio_pago as MedioPago,
    fechaCreacion: d.creada_en,
    tiempoExpiracion: d.expira_en,
    estado: d.estado as EstadoOrden,
    referenciaPago: d.pago.referencia,
    idTransaccion: d.pago.transaccion,
  });
}

function aBoleto(d: DocumentoBoleto): Boleto {
  return Boleto.reconstituir({
    id: d._id,
    ordenId: d.orden_id,
    asientoId: d.asiento_id,
    codigoUbicacion: d.ubicacion,
    codigoRedencion: d.codigo_redencion,
    firmaHash: d.firma_hmac,
    fechaEmision: d.emitido_en,
  });
}
