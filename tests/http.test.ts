/**
 * Prueba de punta a punta por HTTP: navegador → REST → núcleo → adaptadores,
 * y pasarela → webhook → núcleo → boletas.
 */
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { Server } from 'node:http';
import { crearAplicacionWeb } from '../src/infraestructura/entrada/rest/aplicacionWeb';
import { configuracionPrueba, crearEntorno } from './apoyo';

let servidor: Server;
let base = '';

before(async () => {
  const { casos } = crearEntorno();
  const app = crearAplicacionWeb(casos, { habilitarSimulador: true, secretoEventosWompi: configuracionPrueba.wompi.secretoEventos });
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});
after(() => servidor.close());

async function llamar(metodo: string, ruta: string, cuerpo?: unknown, cabeceras: Record<string, string> = {}) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: cuerpo !== undefined ? { 'Content-Type': 'application/json', ...cabeceras } : cabeceras,
    body: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
  const tipo = r.headers.get('content-type') ?? '';
  return { estado: r.status, tipo, cuerpo: tipo.includes('json') ? await r.json() : await r.text() };
}

test('HTTP: flujo completo de compra con Wompi y validación del boleto', async () => {
  const eventos = await llamar('GET', '/api/eventos');
  assert.equal(eventos.estado, 200);
  assert.ok(eventos.cuerpo.every((e: Record<string, unknown>) => !('claveSecreta' in e)), 'la clave secreta no se expone');

  const orden = await llamar('POST', '/api/ordenes', {
    clienteId: 'CLI-0002', eventoId: 'EVT-ECOS', asientoIds: ['REC-TEATRO-PALCO-01', 'REC-TEATRO-PALCO-02', 'REC-TEATRO-PALCO-03'], medioPago: 'wompi',
  });
  assert.equal(orden.estado, 201);
  assert.equal(orden.cuerpo.orden.montoTotal, 900_000 + 72_000 - 45_000);

  const sim = await llamar('POST', '/api/simulador/notificar', {
    medio: 'wompi', referencia: orden.cuerpo.orden.id, monto: orden.cuerpo.orden.montoTotal, resultado: 'aprobado',
  });
  assert.equal(sim.cuerpo.respuestaWebhook.estado, 200);
  assert.equal(sim.cuerpo.respuestaWebhook.cuerpo.orden.estado, 'Aprobada');

  const detalle = await llamar('GET', `/api/ordenes/${orden.cuerpo.orden.id}`);
  assert.equal(detalle.cuerpo.boletos.length, 3);

  const validacion = await llamar('GET', `/api/boletos/validar/${detalle.cuerpo.boletos[0].codigoRedencion}`);
  assert.equal(validacion.cuerpo.valido, true);

  const imagen = await llamar('GET', detalle.cuerpo.boletos[0].representacionUrl);
  assert.equal(imagen.estado, 200);
  assert.match(imagen.tipo, /image\/svg\+xml/);
});

test('HTTP: el webhook rechaza notificaciones con firma falsa (401)', async () => {
  const orden = await llamar('POST', '/api/ordenes', {
    clienteId: 'CLI-0003', eventoId: 'EVT-ECOS', asientoIds: ['REC-TEATRO-PLATEA-10'], medioPago: 'wompi',
  });
  const falso = JSON.stringify({
    event: 'transaction.updated',
    data: { transaction: { id: 'x', amount_in_cents: orden.cuerpo.orden.montoTotal * 100, reference: orden.cuerpo.orden.id, currency: 'COP', status: 'APPROVED' } },
    signature: { properties: ['transaction.id'], checksum: 'ABC' },
    timestamp: 1,
  });
  const r = await llamar('POST', '/api/webhooks/pagos/wompi', falso);
  assert.equal(r.estado, 401);
});

test('HTTP: traduce errores del dominio a códigos HTTP', async () => {
  assert.equal((await llamar('POST', '/api/ordenes', { clienteId: 'CLI-0001' })).estado, 400);
  assert.equal((await llamar('GET', '/api/eventos/NO-EXISTE/asientos')).estado, 404);
  const vendido = await llamar('POST', '/api/ordenes', {
    clienteId: 'CLI-0001', eventoId: 'EVT-ANDES26', asientoIds: ['REC-ARENA-VIP-A01'], medioPago: 'pse',
  });
  assert.equal(vendido.estado, 409);
  assert.equal(vendido.cuerpo.tipo, 'AsientoNoDisponibleError');
});
