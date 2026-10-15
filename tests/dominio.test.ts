/**
 * Pruebas del dominio puro: no usan adaptadores, solo objetos del lenguaje.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Asiento } from '../src/nucleo/dominio/modelo/Asiento';
import { Boleto } from '../src/nucleo/dominio/modelo/Boleto';
import { Cliente } from '../src/nucleo/dominio/modelo/Cliente';
import { EstadoAsiento, EstadoOrden, MedioPago } from '../src/nucleo/dominio/modelo/enumeraciones';
import { AsientoSeleccionado } from '../src/nucleo/dominio/modelo/objetosValor';
import { Orden } from '../src/nucleo/dominio/modelo/Orden';
import {
  DatosInvalidosError,
  LimiteBoletasExcedidoError,
  PagoNoVerificadoError,
  TransicionEstadoInvalidaError,
} from '../src/nucleo/dominio/excepciones/errores';
import { ContenidoFirmableBoleto } from '../src/nucleo/dominio/servicios/ContenidoFirmableBoleto';
import { PoliticaBloqueoAsientos } from '../src/nucleo/dominio/servicios/PoliticaBloqueoAsientos';
import { PoliticaLimiteBoletas } from '../src/nucleo/dominio/servicios/PoliticaLimiteBoletas';
import { PoliticaTarifas } from '../src/nucleo/dominio/servicios/PoliticaTarifas';

const sel = (n: number, precio = 100_000): AsientoSeleccionado[] =>
  Array.from({ length: n }, (_, i) => ({ asientoId: `A${i}`, codigoUbicacion: `GEN-${i}`, precioBase: precio }));

const AHORA = new Date('2026-10-15T15:00:00Z');

function ordenDe(n: number, ahora = AHORA): Orden {
  return Orden.crear({
    id: `ORD-${n}-${Math.random()}`,
    clienteId: 'CLI-1',
    eventoId: 'EVT-1',
    asientos: sel(n),
    liquidacion: PoliticaTarifas.liquidar(sel(n)),
    medioPago: MedioPago.WOMPI,
    ahora,
  });
}

test('Tarifas: 1 a 2 boletos → 10 % de tarifa y 0 % de descuento', () => {
  for (const n of [1, 2]) {
    const l = PoliticaTarifas.liquidar(sel(n));
    assert.equal(l.tarifaServicio, n * 10_000);
    assert.equal(l.descuento, 0);
    assert.equal(l.montoTotal, n * 110_000);
  }
});

test('Tarifas: 3 a 5 boletos → 8 % de tarifa y 5 % de descuento', () => {
  for (const n of [3, 4, 5]) {
    const l = PoliticaTarifas.liquidar(sel(n));
    assert.deepEqual([l.porcentajeTarifa, l.porcentajeDescuento], [0.08, 0.05]);
    assert.equal(l.montoTotal, n * 100_000 + n * 8_000 - n * 5_000);
  }
});

test('Tarifas: más de 5 boletos (corporativa) → 5 % de tarifa y 10 % de descuento', () => {
  const l = PoliticaTarifas.liquidar(sel(6));
  assert.equal(l.tarifaServicio, 30_000);
  assert.equal(l.descuento, 60_000);
  assert.equal(l.montoTotal, 570_000);
});

test('Tarifas: rechaza una compra sin boletos', () => {
  assert.throws(() => PoliticaTarifas.liquidar([]), DatosInvalidosError);
});

test('Bloqueo: la orden expira exactamente 10 minutos después de crearse', () => {
  const orden = ordenDe(2);
  assert.equal(orden.tiempoExpiracion.getTime() - orden.fechaCreacion.getTime(), 10 * 60_000);
  assert.equal(orden.estaVencida(new Date(AHORA.getTime() + 9 * 60_000 + 59_999)), false);
  assert.equal(orden.estaVencida(PoliticaBloqueoAsientos.calcularExpiracion(AHORA)), true);
});

test('Orden: no se aprueba si el bloqueo ya venció', () => {
  const orden = ordenDe(1);
  assert.throws(() => orden.aprobar('TX-1', new Date(AHORA.getTime() + 11 * 60_000)), TransicionEstadoInvalidaError);
  assert.equal(orden.estado, EstadoOrden.PENDIENTE_PAGO);
});

test('Orden: una orden aprobada no puede rechazarse ni expirarse', () => {
  const orden = ordenDe(1);
  orden.aprobar('TX-1', AHORA);
  assert.throws(() => orden.rechazar(), TransicionEstadoInvalidaError);
  assert.throws(() => orden.expirar(), TransicionEstadoInvalidaError);
});

test('Asiento: Disponible → Bloqueado → Vendido; no se puede vender sin bloquear', () => {
  const a = new Asiento('A1', 'R1', 'VIP-A01', 450_000, EstadoAsiento.DISPONIBLE);
  assert.throws(() => a.vender(), TransicionEstadoInvalidaError);
  a.bloquear();
  assert.throws(() => a.bloquear(), TransicionEstadoInvalidaError);
  a.vender();
  assert.equal(a.estado, EstadoAsiento.VENDIDO);
  assert.throws(() => a.liberar(), TransicionEstadoInvalidaError);
});

test('Límite: un cliente no puede acumular más de 6 boletas por evento', () => {
  const aprobada = ordenDe(4);
  aprobada.aprobar('TX', AHORA);
  const pendiente = ordenDe(2);
  assert.doesNotThrow(() => PoliticaLimiteBoletas.verificar([aprobada], 2, AHORA));
  assert.throws(() => PoliticaLimiteBoletas.verificar([aprobada, pendiente], 1, AHORA), LimiteBoletasExcedidoError);
});

test('Límite: las órdenes vencidas, rechazadas o expiradas no ocupan cupo', () => {
  const vencida = ordenDe(3);
  const rechazada = ordenDe(3);
  rechazada.rechazar();
  const mas11min = new Date(AHORA.getTime() + 11 * 60_000);
  assert.equal(PoliticaLimiteBoletas.boletasAcumuladas([vencida, rechazada], mas11min), 0);
  assert.doesNotThrow(() => PoliticaLimiteBoletas.verificar([vencida, rechazada], 6, mas11min));
});

test('Boleto: solo se emite si la orden está aprobada (pago exitoso y verificado)', () => {
  const orden = ordenDe(1);
  const datos = { id: 'B1', orden, asientoId: 'A0', codigoRedencion: 'SPL-X', firmaHash: 'f'.repeat(64), fechaEmision: AHORA };
  assert.throws(() => Boleto.emitir(datos), PagoNoVerificadoError);
  orden.aprobar('TX', AHORA);
  assert.equal(Boleto.emitir(datos).codigoUbicacion, 'GEN-0');
});

test('Firma: el contenido firmable cambia si cambia cualquier dato inmutable', () => {
  const base = {
    ordenId: 'O1', clienteId: 'C1', eventoId: 'E1', asientoId: 'A1', codigoUbicacion: 'VIP-A01',
    montoTotalOrden: 495_000, codigoRedencion: 'SPL-AAAA', fechaEmision: AHORA,
  };
  const original = ContenidoFirmableBoleto.construir(base);
  assert.notEqual(original, ContenidoFirmableBoleto.construir({ ...base, codigoUbicacion: 'VIP-A02' }));
  assert.notEqual(original, ContenidoFirmableBoleto.construir({ ...base, montoTotalOrden: 1 }));
});

test('Cliente: valida correo, teléfono y campos obligatorios', () => {
  const ok = { nombreCompleto: 'Ana Gómez', correo: 'ANA@Correo.co', telefonoMovil: '+57 300 111 2233', nacionalidad: 'Colombiana' };
  const c = new Cliente('C1', ok);
  assert.equal(c.correo, 'ana@correo.co');
  assert.equal(c.telefonoMovil, '+573001112233');
  assert.throws(() => new Cliente('C2', { ...ok, correo: 'sin-arroba' }), DatosInvalidosError);
  assert.throws(() => new Cliente('C3', { ...ok, telefonoMovil: '12' }), DatosInvalidosError);
});
