/**
 * PUERTO SECUNDARIO (driven) — Envío de notificaciones al cliente.
 * Implementaciones: WhatsApp (dummy) y correo electrónico SendGrid (dummy).
 */
import { Boleto } from '../../dominio/modelo/Boleto';
import { Cliente } from '../../dominio/modelo/Cliente';
import { Evento } from '../../dominio/modelo/Evento';
import { Orden } from '../../dominio/modelo/Orden';
import { CanalNotificacion } from '../../dominio/modelo/enumeraciones';
import { ResultadoNotificacion } from '../../dominio/modelo/objetosValor';

export interface Notificador {
  readonly canal: CanalNotificacion;
  notificarCompraAprobada(cliente: Cliente, evento: Evento, orden: Orden, boletos: readonly Boleto[]): Promise<ResultadoNotificacion>;
}
