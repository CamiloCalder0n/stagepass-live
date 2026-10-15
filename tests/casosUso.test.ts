/**
 * Pruebas de los casos de uso con los adaptadores conectados (dummies + los 2 reales).
 * El reloj controlable permite probar el bloqueo de 10 minutos sin esperar.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AsientoNoDisponibleError,
  EventoNoDisponibleError,
  LimiteBoletasExcedidoError,
  PagoNoVerificadoError,
  ServicioExternoError,
} from '../src/nucleo/dominio/excepciones/errores';
import { EstadoAsiento, EstadoEvento, EstadoOrden, MedioPago } from '../src/nucleo/dominio/modelo/enumeraciones';
import { PasarelaPago } from '../src/nucleo/puertos/salida/PasarelaPago';
import { ANDES, asiento, crearEntorno, notificacion } from './apoyo';

async function estadoAsiento(e: ReturnType<typeof crearEntorno>, eventoId: string, id: string) {
  const d = await e.casos.catalogo.consultarDisponibilidad(eventoId);
  return d.asientos.find((a) => a.id === id)!.estado;
}

async function comprar(e: ReturnType<typeof crearEntorno>, codigos: string[], clienteId = 'CLI-0001', medio = MedioPago.WOMPI) {
  return e.casos.iniciarCompra.ejecutar({ clienteId, eventoId: ANDES, asientoIds: codigos.map(asiento), medioPago: medio });
}

test('Iniciar compra: bloquea los asientos, liquida la tarifa y registra el pago en Wompi', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['VIP-A03', 'VIP-A04']);
  assert.equal(r.orden.estado, EstadoOrden.PENDIENTE_PAGO);
  assert.equal(r.orden.montoTotal, 990_000); // 900.000 + 10 %
  assert.equal(r.orden.referenciaPago, r.orden.id);
  assert.match(r.registroPago.urlPago, /^https:\/\/checkout\.wompi\.co\/p\/\?.*signature%3Aintegrity=[0-9a-f]{64}/);
  assert.equal(await estadoAsiento(e, ANDES, asiento('VIP-A03')), EstadoAsiento.BLOQUEADO);
});

test('Iniciar compra: un asiento bloqueado o vendido no se puede comprar', async () => {
  const e = crearEntorno();
  await comprar(e, ['VIP-A03']);
  await assert.rejects(comprar(e, ['VIP-A03'], 'CLI-0002'), AsientoNoDisponibleError);
  await assert.rejects(comprar(e, ['VIP-A01'], 'CLI-0002'), AsientoNoDisponibleError); // vendido en la semilla
});

test('Iniciar compra: no se vende para un evento cancelado', async () => {
  const e = crearEntorno();
  await assert.rejects(
    e.casos.iniciarCompra.ejecutar({
      clienteId: 'CLI-0001', eventoId: 'EVT-SINFONICA', asientoIds: ['REC-TEATRO-PLATEA-01'], medioPago: MedioPago.PSE,
    }),
    EventoNoDisponibleError
  );
});

test('Límite: un cliente no supera 6 boletas por evento sumando órdenes aprobadas y pendientes', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['GEN-01', 'GEN-02', 'GEN-03', 'GEN-04']);
  await e.casos.confirmarPago.ejecutar(notificacion(MedioPago.WOMPI, r.orden.id, r.orden.montoTotal));
  await comprar(e, ['GEN-06', 'GEN-07']); // 4 aprobadas + 2 pendientes = 6
  await assert.rejects(comprar(e, ['GEN-08']), LimiteBoletasExcedidoError);
  // Otro cliente no se ve afectado.
  await assert.doesNotReject(comprar(e, ['GEN-08'], 'CLI-0002'));
});

test('Pago aprobado y verificado: aprueba la orden, vende asientos, emite boletas, factura y notifica', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['PREF-B01', 'PREF-B02', 'PREF-B03']);
  const c = await e.casos.confirmarPago.ejecutar(notificacion(MedioPago.WOMPI, r.orden.id, r.orden.montoTotal));

  assert.equal(c.orden.estado, EstadoOrden.APROBADA);
  assert.equal(c.boletos.length, 3);
  assert.ok(c.boletos.every((b) => /^SPL-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(b.codigoRedencion)));
  assert.ok(c.boletos.every((b) => /^[0-9a-f]{64}$/.test(b.firmaHash)));
  assert.match(c.factura!.numero, /^SETP\d+$/);
  assert.equal(e.adaptadores.whatsapp.bandejaSalida.length, 1);
  assert.equal(e.adaptadores.correo.bandejaSalida.length, 1);
  assert.equal(await estadoAsiento(e, ANDES, asiento('PREF-B02')), EstadoAsiento.VENDIDO);
});

test('Pago con firma inválida: se rechaza y no se emiten boletas', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['VIP-A05']);
  await assert.rejects(
    e.casos.confirmarPago.ejecutar(notificacion(MedioPago.WOMPI, r.orden.id, r.orden.montoTotal, 'aprobado', true)),
    PagoNoVerificadoError
  );
  const d = await e.casos.consultarOrden.ejecutar(r.orden.id);
  assert.equal(d.orden.estado, EstadoOrden.PENDIENTE_PAGO);
  assert.equal(d.boletos.length, 0);
});

test('Pago con monto distinto al total de la orden: no se verifica', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['VIP-A05']);
  await assert.rejects(e.casos.confirmarPago.ejecutar(notificacion(MedioPago.WOMPI, r.orden.id, 1_000)), PagoNoVerificadoError);
});

test('Pago rechazado: la orden queda Rechazada y los asientos se liberan', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['VIP-A06'], 'CLI-0002', MedioPago.PSE);
  const c = await e.casos.confirmarPago.ejecutar(notificacion(MedioPago.PSE, r.orden.id, r.orden.montoTotal, 'rechazado'));
  assert.equal(c.orden.estado, EstadoOrden.RECHAZADA);
  assert.equal(await estadoAsiento(e, ANDES, asiento('VIP-A06')), EstadoAsiento.DISPONIBLE);
});

test('Bloqueo de 10 minutos: al vencer, la orden expira y los asientos se liberan automáticamente', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['VIP-A07', 'VIP-A08']);
  e.reloj.avanzarMinutos(9);
  assert.equal(await e.casos.liberarReservas.ejecutar(), 0);
  e.reloj.avanzarMinutos(1);
  assert.equal(await e.casos.liberarReservas.ejecutar(), 1);
  assert.equal((await e.casos.consultarOrden.ejecutar(r.orden.id)).orden.estado, EstadoOrden.EXPIRADA);
  assert.equal(await estadoAsiento(e, ANDES, asiento('VIP-A07')), EstadoAsiento.DISPONIBLE);
});

test('Pago tardío: si llega después de los 10 minutos, no emite boletas y marca reembolso', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['GEN-10'], 'CLI-0003', MedioPago.PAYPAL);
  e.reloj.avanzarMinutos(12);
  const c = await e.casos.confirmarPago.ejecutar(notificacion(MedioPago.PAYPAL, r.orden.id, r.orden.montoTotal));
  assert.equal(c.orden.estado, EstadoOrden.EXPIRADA);
  assert.equal(c.boletos.length, 0);
  assert.equal(c.requiereReembolso, true);
});

test('Notificación repetida (reintento de la pasarela): no duplica boletas', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['GEN-11']);
  const n = notificacion(MedioPago.WOMPI, r.orden.id, r.orden.montoTotal);
  const primera = await e.casos.confirmarPago.ejecutar(n);
  const segunda = await e.casos.confirmarPago.ejecutar(n);
  assert.equal(segunda.duplicada, true);
  assert.deepEqual(segunda.boletos.map((b) => b.id), primera.boletos.map((b) => b.id));
});

test('Validación criptográfica: un boleto auténtico pasa; uno alterado no', async () => {
  const e = crearEntorno();
  const r = await comprar(e, ['GEN-12']);
  const [boleto] = (await e.casos.confirmarPago.ejecutar(notificacion(MedioPago.WOMPI, r.orden.id, r.orden.montoTotal))).boletos;

  assert.equal((await e.casos.boletos.validar(boleto.codigoRedencion)).valido, true);
  assert.equal((await e.casos.boletos.validar('SPL-FALS-OCOD-IGO2')).valido, false);
  const svg = await e.casos.boletos.obtenerRepresentacion(boleto.id);
  assert.equal(svg.tipoContenido, 'image/svg+xml');
  assert.match(svg.contenido, /<svg[\s\S]*GEN-12[\s\S]*<\/svg>/);
});

test('Evento agotado: al venderse el último asiento el evento pasa a Agotado', async () => {
  const e = crearEntorno();
  const disp = (await e.casos.catalogo.consultarDisponibilidad('EVT-CORDILLERA')).asientos;
  const clientes = ['CLI-0001', 'CLI-0002'];
  for (let i = 0; i < 2; i++) {
    const ids = disp.slice(i * 5, i * 5 + 5).map((a) => a.id);
    const r = await e.casos.iniciarCompra.ejecutar({ clienteId: clientes[i], eventoId: 'EVT-CORDILLERA', asientoIds: ids, medioPago: MedioPago.WOMPI });
    await e.casos.confirmarPago.ejecutar(notificacion(MedioPago.WOMPI, r.orden.id, r.orden.montoTotal));
  }
  const d = await e.casos.catalogo.consultarDisponibilidad('EVT-CORDILLERA');
  assert.equal(d.evento.estado, EstadoEvento.AGOTADO);
});

test('Compensación: si la pasarela falla al registrar el pago, se liberan los asientos', async () => {
  const e = crearEntorno();
  const wompi = e.adaptadores.pasarelas.find((p) => p.medioPago === MedioPago.WOMPI) as PasarelaPago;
  const original = wompi.registrarPago.bind(wompi);
  wompi.registrarPago = async () => {
    throw new Error('tiempo de espera agotado');
  };
  await assert.rejects(comprar(e, ['VIP-A03']), ServicioExternoError);
  wompi.registrarPago = original;
  assert.equal(await estadoAsiento(e, ANDES, asiento('VIP-A03')), EstadoAsiento.DISPONIBLE);
});

test('Clientes: registra uno nuevo y rechaza correos duplicados', async () => {
  const e = crearEntorno();
  const c = await e.casos.clientes.registrar({
    nombreCompleto: 'Camilo Prueba', correo: 'camilo@prueba.co', telefonoMovil: '+573009998877', nacionalidad: 'Colombiana',
  });
  assert.ok(c.id.startsWith('CLI-'));
  await assert.rejects(
    e.casos.clientes.registrar({ nombreCompleto: 'Otro', correo: 'CAMILO@prueba.co', telefonoMovil: '3001234567', nacionalidad: 'X' }),
    /Ya existe/
  );
});
