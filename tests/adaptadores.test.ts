/**
 * Pruebas de los dos adaptadores reales, aislados del núcleo.
 */
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { test } from 'node:test';
import { GeneradorCredencialesHmacQr } from '../src/infraestructura/salida/boletos/GeneradorCredencialesHmacQr';
import { AdaptadorPasarelaWompi } from '../src/infraestructura/salida/pagos/wompi/AdaptadorPasarelaWompi';
import { DatosInvalidosError } from '../src/nucleo/dominio/excepciones/errores';
import { EstadoTransaccion, MedioPago } from '../src/nucleo/dominio/modelo/enumeraciones';

const config = {
  llavePublica: 'pub_test_ABC',
  secretoIntegridad: 'test_integrity_XYZ',
  secretoEventos: 'test_events_123',
  urlCheckout: 'https://checkout.wompi.co/p/',
  urlRedireccion: 'http://localhost:3000/',
};
const wompi = new AdaptadorPasarelaWompi(config);
const sha256 = (t: string) => createHash('sha256').update(t).digest('hex');

function eventoWompi(status = 'APPROVED', monto = 495_000) {
  const transaction = { id: '1234-1610641025-49201', amount_in_cents: monto * 100, reference: 'ORD-1', currency: 'COP', status };
  const timestamp = 1_760_540_000;
  const checksum = sha256(`${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${config.secretoEventos}`);
  return {
    event: 'transaction.updated',
    data: { transaction },
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum: checksum.toUpperCase() },
    timestamp,
  };
}

test('Wompi: la URL de checkout incluye la firma de integridad SHA256(ref+centavos+moneda+secreto)', async () => {
  const r = await wompi.registrarPago({
    referencia: 'ORD-1', montoTotal: 495_000, moneda: 'COP', descripcion: 'x',
    nombreCliente: 'Ana', correoCliente: 'ana@correo.co', telefonoCliente: '+573001112233',
  });
  const url = new URL(r.urlPago);
  assert.equal(url.origin + url.pathname, 'https://checkout.wompi.co/p/');
  assert.equal(url.searchParams.get('amount-in-cents'), '49500000');
  assert.equal(url.searchParams.get('signature:integrity'), sha256(`ORD-149500000COP${config.secretoIntegridad}`));
  assert.equal(url.searchParams.get('customer-data:phone-number'), '3001112233');
});

test('Wompi: traduce un evento auténtico a ConfirmacionPago del dominio', async () => {
  const c = await wompi.recibirConfirmacion({ medioPago: MedioPago.WOMPI, contenido: JSON.stringify(eventoWompi()), metadatos: {} });
  assert.deepEqual(c, {
    medioPago: MedioPago.WOMPI,
    referencia: 'ORD-1',
    idTransaccion: '1234-1610641025-49201',
    estado: EstadoTransaccion.APROBADA,
    montoPagado: 495_000,
    firmaVerificada: true,
  });
});

test('Wompi: un evento alterado (monto cambiado) no pasa la verificación del checksum', async () => {
  const e = eventoWompi();
  e.data.transaction.amount_in_cents = 100;
  const c = await wompi.recibirConfirmacion({ medioPago: MedioPago.WOMPI, contenido: JSON.stringify(e), metadatos: {} });
  assert.equal(c.firmaVerificada, false);
});

test('Wompi: mapea DECLINED, VOIDED y ERROR a Rechazada y PENDING a Pendiente', async () => {
  for (const [status, esperado] of [
    ['DECLINED', EstadoTransaccion.RECHAZADA], ['VOIDED', EstadoTransaccion.RECHAZADA],
    ['ERROR', EstadoTransaccion.RECHAZADA], ['PENDING', EstadoTransaccion.PENDIENTE],
  ] as const) {
    const c = await wompi.recibirConfirmacion({ medioPago: MedioPago.WOMPI, contenido: JSON.stringify(eventoWompi(status)), metadatos: {} });
    assert.equal(c.estado, esperado);
  }
});

test('Wompi: rechaza JSON inválido o eventos no soportados', async () => {
  await assert.rejects(wompi.recibirConfirmacion({ medioPago: MedioPago.WOMPI, contenido: '{x', metadatos: {} }), DatosInvalidosError);
  await assert.rejects(
    wompi.recibirConfirmacion({ medioPago: MedioPago.WOMPI, contenido: JSON.stringify({ ...eventoWompi(), event: 'nequi_token.updated' }), metadatos: {} }),
    DatosInvalidosError
  );
});

const generador = new GeneradorCredencialesHmacQr();

test('Credenciales: la firma es HMAC-SHA256 con la clave del evento', () => {
  const firma = generador.calcularFirma('contenido', 'clave-secreta-del-evento');
  assert.equal(firma, createHmac('sha256', 'clave-secreta-del-evento').update('contenido').digest('hex'));
  assert.equal(generador.verificarFirma('contenido', 'clave-secreta-del-evento', firma), true);
  assert.equal(generador.verificarFirma('contenido alterado', 'clave-secreta-del-evento', firma), false);
  assert.equal(generador.verificarFirma('contenido', 'otra-clave-cualquiera!!', firma), false);
  assert.equal(generador.verificarFirma('contenido', 'clave-secreta-del-evento', 'no-hex'), false);
});

test('Credenciales: códigos de redención con formato SPL-XXXX-XXXX-XXXX y sin repetirse', () => {
  const codigos = new Set(Array.from({ length: 2000 }, () => generador.generarCodigoRedencion()));
  assert.equal(codigos.size, 2000);
  for (const c of codigos) assert.match(c, /^SPL-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
});
