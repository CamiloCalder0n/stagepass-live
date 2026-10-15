/**
 * ADAPTADOR SECUNDARIO (REAL) — Credenciales criptográficas y representación gráfica de boletos.
 * Implementa el puerto GeneradorCredencialesBoleto.
 *
 *  • Código de redención: 12 caracteres aleatorios criptográficamente seguros
 *    (sin caracteres ambiguos como 0/O o 1/I), formato SPL-XXXX-XXXX-XXXX.
 *  • Firma hash: HMAC-SHA256(contenido, claveSecretaDelEvento) en hexadecimal.
 *    Es fácil de implementar (viene en node:crypto) y, a diferencia de un SHA-256 simple,
 *    nadie puede recalcular la firma sin conocer la clave del evento.
 *  • Representación gráfica: boleto en SVG con código QR (librería `qrcode`).
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { Boleto } from '../../../nucleo/dominio/modelo/Boleto';
import { Evento } from '../../../nucleo/dominio/modelo/Evento';
import { RepresentacionGrafica } from '../../../nucleo/dominio/modelo/objetosValor';
import { GeneradorCredencialesBoleto } from '../../../nucleo/puertos/salida/GeneradorCredencialesBoleto';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class GeneradorCredencialesHmacQr implements GeneradorCredencialesBoleto {
  generarCodigoRedencion(): string {
    const caracteres = Array.from({ length: 12 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
    return `SPL-${caracteres.slice(0, 4)}-${caracteres.slice(4, 8)}-${caracteres.slice(8)}`;
  }

  calcularFirma(contenido: string, claveSecreta: string): string {
    return createHmac('sha256', claveSecreta).update(contenido, 'utf8').digest('hex');
  }

  verificarFirma(contenido: string, claveSecreta: string, firma: string): boolean {
    const esperada = Buffer.from(this.calcularFirma(contenido, claveSecreta), 'hex');
    const recibida = Buffer.from(/^[0-9a-f]{64}$/i.test(firma) ? firma : '', 'hex');
    return recibida.length === esperada.length && timingSafeEqual(esperada, recibida);
  }

  async generarRepresentacionGrafica(boleto: Boleto, evento: Evento): Promise<RepresentacionGrafica> {
    // El QR lleva el código y un prefijo de la firma: suficiente para que el lector
    // consulte el boleto y detecte códigos falsificados.
    const cargaQr = `STAGEPASS:${boleto.codigoRedencion}:${boleto.firmaHash.slice(0, 16)}`;
    const qr = await QRCode.toString(cargaQr, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
    return { tipoContenido: 'image/svg+xml', contenido: this.componerBoleto(boleto, evento, qr) };
  }

  private componerBoleto(boleto: Boleto, evento: Evento, svgQr: string): string {
    const viewBox = /viewBox="([^"]+)"/.exec(svgQr)?.[1] ?? '0 0 33 33';
    const interior = svgQr.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const fecha = evento.fechaHora.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="280" viewBox="0 0 720 280" font-family="Inter, Segoe UI, Arial, sans-serif">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1033"/><stop offset="1" stop-color="#3b0d4f"/>
    </linearGradient>
  </defs>
  <rect width="720" height="280" rx="22" fill="url(#fondo)"/>
  <circle cx="500" cy="0" r="18" fill="#0f0a1f"/><circle cx="500" cy="280" r="18" fill="#0f0a1f"/>
  <line x1="500" y1="26" x2="500" y2="254" stroke="#ffffff33" stroke-width="2" stroke-dasharray="6 8"/>
  <text x="36" y="52" fill="#ff4fa3" font-size="14" font-weight="700" letter-spacing="3">STAGEPASS LIVE · ${escaparXml(evento.tipo.toUpperCase())}</text>
  <text x="36" y="96" fill="#ffffff" font-size="30" font-weight="800">${escaparXml(recortar(evento.nombre, 26))}</text>
  <text x="36" y="128" fill="#c9bfe3" font-size="15">${escaparXml(fecha)}</text>
  <text x="36" y="178" fill="#9d8fc4" font-size="12" letter-spacing="2">UBICACIÓN</text>
  <text x="36" y="206" fill="#ffffff" font-size="26" font-weight="700">${escaparXml(boleto.codigoUbicacion)}</text>
  <text x="250" y="178" fill="#9d8fc4" font-size="12" letter-spacing="2">CÓDIGO</text>
  <text x="250" y="206" fill="#ffffff" font-size="18" font-weight="700" font-family="Consolas, monospace">${escaparXml(boleto.codigoRedencion)}</text>
  <text x="36" y="250" fill="#7d71a3" font-size="11" font-family="Consolas, monospace">HMAC-SHA256 ${escaparXml(boleto.firmaHash.slice(0, 32))}…</text>
  <rect x="528" y="46" width="164" height="164" rx="10" fill="#ffffff"/>
  <svg x="540" y="58" width="140" height="140" viewBox="${viewBox}" shape-rendering="crispEdges">${interior}</svg>
  <text x="610" y="240" fill="#c9bfe3" font-size="12" text-anchor="middle">Presenta este código en el acceso</text>
</svg>`;
  }
}

function escaparXml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function recortar(texto: string, maximo: number): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}
