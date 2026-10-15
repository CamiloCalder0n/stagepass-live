/**
 * PUERTO SECUNDARIO (driven) — Generación de credenciales criptográficas y
 * representación gráfica de los boletos.
 * Implementación: GeneradorCredencialesHmacQr (real: HMAC-SHA256 + QR en SVG).
 */
import { Boleto } from '../../dominio/modelo/Boleto';
import { Evento } from '../../dominio/modelo/Evento';
import { RepresentacionGrafica } from '../../dominio/modelo/objetosValor';

export interface GeneradorCredencialesBoleto {
  /** Código alfanumérico único y aleatorio para redimir el boleto. */
  generarCodigoRedencion(): string;

  /** Firma hash de seguridad del contenido con la clave secreta del evento. */
  calcularFirma(contenido: string, claveSecreta: string): string;

  /** Compara una firma recibida contra el contenido (en tiempo constante). */
  verificarFirma(contenido: string, claveSecreta: string, firma: string): boolean;

  /** Imagen del boleto con su código QR. */
  generarRepresentacionGrafica(boleto: Boleto, evento: Evento): Promise<RepresentacionGrafica>;
}
