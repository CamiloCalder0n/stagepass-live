/**
 * PUERTO PRIMARIO (driving) — Validar criptográficamente un boleto (control de acceso)
 * y obtener su representación gráfica.
 */
import { Boleto } from '../../dominio/modelo/Boleto';
import { Evento } from '../../dominio/modelo/Evento';
import { RepresentacionGrafica } from '../../dominio/modelo/objetosValor';

export interface ResultadoValidacionBoleto {
  readonly valido: boolean;
  readonly motivo: string;
  readonly boleto: Boleto | null;
  readonly evento: Evento | null;
}

export interface ValidarBoletoCasoUso {
  validar(codigoRedencion: string): Promise<ResultadoValidacionBoleto>;
  obtenerRepresentacion(boletoId: string): Promise<RepresentacionGrafica>;
}
