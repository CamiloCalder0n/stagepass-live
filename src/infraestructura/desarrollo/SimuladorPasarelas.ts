/**
 * HERRAMIENTA DE DESARROLLO (fuera del hexágono) — Simulador de pasarelas.
 *
 * Hace el papel de Wompi, PayPal o PSE: arma la notificación con el formato exacto de
 * cada pasarela, la firma y la envía por HTTP al endpoint real de webhooks.
 * Así se prueba el flujo completo sin cuentas de comercio ni URL pública.
 * Se desactiva en producción con SIMULADOR_PASARELAS=false.
 */
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { FIRMA_PRUEBA_PAYPAL, WebhookPayPal } from '../salida/pagos/paypal/AdaptadorPayPalDummy';
import { ConfirmacionPse, TOKEN_PRUEBA_PSE } from '../salida/pagos/pse/AdaptadorPseDummy';
import { checksumEvento } from '../salida/pagos/wompi/firmasWompi';
import { EventoWompi } from '../salida/pagos/wompi/modelosWompi';
import { asincrono, SolicitudInvalidaError } from '../entrada/rest/http';

type Resultado = 'aprobado' | 'rechazado' | 'pendiente';

export interface NotificacionSimulada {
  ruta: string;
  cabeceras: Record<string, string>;
  cuerpo: string;
}

export function construirNotificacion(
  medio: string,
  referencia: string,
  monto: number,
  resultado: Resultado,
  secretoEventosWompi: string,
  opciones: { firmaInvalida?: boolean } = {}
): NotificacionSimulada {
  const idTransaccion = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  switch (medio.toLowerCase()) {
    case 'wompi': {
      const estado = { aprobado: 'APPROVED', rechazado: 'DECLINED', pendiente: 'PENDING' }[resultado] as EventoWompi['data']['transaction']['status'];
      const evento: EventoWompi = {
        event: 'transaction.updated',
        data: {
          transaction: {
            id: idTransaccion,
            amount_in_cents: monto * 100,
            reference: referencia,
            currency: 'COP',
            payment_method_type: 'CARD',
            status: estado,
          },
        },
        environment: 'test',
        signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum: '' },
        timestamp: Math.floor(Date.now() / 1000),
        sent_at: new Date().toISOString(),
      };
      evento.signature.checksum = opciones.firmaInvalida ? 'F'.repeat(64) : checksumEvento(evento, secretoEventosWompi).toUpperCase();
      return { ruta: 'wompi', cabeceras: { 'content-type': 'application/json' }, cuerpo: JSON.stringify(evento) };
    }
    case 'paypal': {
      const tipo = { aprobado: 'COMPLETED', rechazado: 'DENIED', pendiente: 'PENDING' }[resultado];
      const webhook: WebhookPayPal = {
        event_type: `PAYMENT.CAPTURE.${tipo}` as WebhookPayPal['event_type'],
        resource: { id: `PP-${idTransaccion}`, custom_id: referencia, status: tipo, amount: { currency_code: 'COP', value: `${monto}.00` } },
      };
      return {
        ruta: 'paypal',
        cabeceras: { 'content-type': 'application/json', 'paypal-transmission-sig': opciones.firmaInvalida ? 'x' : FIRMA_PRUEBA_PAYPAL },
        cuerpo: JSON.stringify(webhook),
      };
    }
    case 'pse': {
      const confirmacion: ConfirmacionPse = {
        referencia1: referencia,
        cus: idTransaccion.replace(/\D/g, '').slice(0, 10),
        estado: ({ aprobado: 'OK', rechazado: 'NOT_AUTHORIZED', pendiente: 'PENDING' } as const)[resultado],
        valor: monto,
      };
      return {
        ruta: 'pse',
        cabeceras: { 'content-type': 'application/json', 'x-pse-token': opciones.firmaInvalida ? 'x' : TOKEN_PRUEBA_PSE },
        cuerpo: JSON.stringify(confirmacion),
      };
    }
    default:
      throw new SolicitudInvalidaError([`Medio de pago desconocido: ${medio}`]);
  }
}

export function rutasSimulador(secretoEventosWompi: string): Router {
  return Router().post(
    '/simulador/notificar',
    asincrono(async (req, res) => {
      const { medio, referencia, monto, resultado, firmaInvalida } = req.body ?? {};
      if (typeof medio !== 'string' || typeof referencia !== 'string' || !Number.isInteger(monto)) {
        throw new SolicitudInvalidaError(['Se requieren medio, referencia y monto (entero).']);
      }
      if (!['aprobado', 'rechazado', 'pendiente'].includes(resultado)) {
        throw new SolicitudInvalidaError(['"resultado" debe ser aprobado, rechazado o pendiente.']);
      }
      const n = construirNotificacion(medio, referencia, monto, resultado, secretoEventosWompi, { firmaInvalida: firmaInvalida === true });

      // La notificación viaja por HTTP real hasta el adaptador primario de webhooks.
      const respuesta = await fetch(`${req.protocol}://${req.get('host')}/api/webhooks/pagos/${n.ruta}`, {
        method: 'POST',
        headers: n.cabeceras,
        body: n.cuerpo,
      });
      res.status(200).json({
        enviado: { ruta: `/api/webhooks/pagos/${n.ruta}`, cabeceras: n.cabeceras, cuerpo: JSON.parse(n.cuerpo) },
        respuestaWebhook: { estado: respuesta.status, cuerpo: await respuesta.json() },
      });
    })
  );
}
