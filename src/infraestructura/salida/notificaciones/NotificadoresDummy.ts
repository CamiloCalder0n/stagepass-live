/**
 * ADAPTADORES SECUNDARIOS (DUMMY) — Notificaciones por WhatsApp y correo (SendGrid).
 * Implementan el puerto Notificador. Arman el mensaje con el formato de cada proveedor
 * y lo guardan en una bandeja en memoria en lugar de enviarlo.
 */
import { Boleto } from '../../../nucleo/dominio/modelo/Boleto';
import { Cliente } from '../../../nucleo/dominio/modelo/Cliente';
import { CanalNotificacion } from '../../../nucleo/dominio/modelo/enumeraciones';
import { Evento } from '../../../nucleo/dominio/modelo/Evento';
import { ResultadoNotificacion } from '../../../nucleo/dominio/modelo/objetosValor';
import { Orden } from '../../../nucleo/dominio/modelo/Orden';
import { Notificador } from '../../../nucleo/puertos/salida/Notificador';

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** Payload de la API de WhatsApp Business Cloud (simplificado). */
export interface MensajeWhatsApp {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string };
}

/** Payload de SendGrid v3 /mail/send (simplificado). */
export interface CorreoSendGrid {
  personalizations: { to: { email: string; name: string }[] }[];
  from: { email: string; name: string };
  subject: string;
  content: { type: 'text/html'; value: string }[];
}

export class NotificadorWhatsAppDummy implements Notificador {
  readonly canal = CanalNotificacion.WHATSAPP;
  readonly bandejaSalida: MensajeWhatsApp[] = [];

  constructor(private readonly mostrarEnConsola = false) {}

  async notificarCompraAprobada(cliente: Cliente, evento: Evento, orden: Orden, boletos: readonly Boleto[]): Promise<ResultadoNotificacion> {
    const cuerpo = [
      `🎟️ ¡Hola ${cliente.nombreCompleto.split(' ')[0]}! Tu compra en StagePass Live fue aprobada.`,
      `${evento.nombre} · ${boletos.length} boleta(s) · ${pesos.format(orden.montoTotal)}`,
      ...boletos.map((b) => `• ${b.codigoUbicacion}: ${b.codigoRedencion}`),
    ].join('\n');
    const mensaje: MensajeWhatsApp = { messaging_product: 'whatsapp', to: cliente.telefonoMovil, type: 'text', text: { body: cuerpo } };
    this.bandejaSalida.push(mensaje);
    if (this.mostrarEnConsola) console.log(`[WhatsApp dummy] → ${cliente.telefonoMovil}\n${cuerpo}`);
    return { canal: this.canal, enviado: true, detalle: `Simulado: mensaje a ${cliente.telefonoMovil}` };
  }
}

export class NotificadorSendGridDummy implements Notificador {
  readonly canal = CanalNotificacion.CORREO;
  readonly bandejaSalida: CorreoSendGrid[] = [];

  constructor(private readonly remitente: string, private readonly mostrarEnConsola = false) {}

  async notificarCompraAprobada(cliente: Cliente, evento: Evento, orden: Orden, boletos: readonly Boleto[]): Promise<ResultadoNotificacion> {
    const filas = boletos.map((b) => `<li><b>${b.codigoUbicacion}</b> — código <code>${b.codigoRedencion}</code></li>`).join('');
    const correo: CorreoSendGrid = {
      personalizations: [{ to: [{ email: cliente.correo, name: cliente.nombreCompleto }] }],
      from: { email: this.remitente, name: 'StagePass Live' },
      subject: `Tus boletas para ${evento.nombre}`,
      content: [
        {
          type: 'text/html',
          value: `<h1>¡Compra aprobada!</h1><p>Orden ${orden.id} por ${pesos.format(orden.montoTotal)}.</p><ul>${filas}</ul>`,
        },
      ],
    };
    this.bandejaSalida.push(correo);
    if (this.mostrarEnConsola) console.log(`[SendGrid dummy] → ${cliente.correo}: ${correo.subject}`);
    return { canal: this.canal, enviado: true, detalle: `Simulado: correo a ${cliente.correo}` };
  }
}
