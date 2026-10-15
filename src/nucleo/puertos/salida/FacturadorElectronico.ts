/**
 * PUERTO SECUNDARIO (driven) — Emisión de factura electrónica ante la autoridad tributaria.
 * Implementación: DIAN (dummy).
 */
import { Cliente } from '../../dominio/modelo/Cliente';
import { Evento } from '../../dominio/modelo/Evento';
import { Orden } from '../../dominio/modelo/Orden';
import { FacturaElectronica } from '../../dominio/modelo/objetosValor';

export interface FacturadorElectronico {
  emitirFactura(orden: Orden, cliente: Cliente, evento: Evento): Promise<FacturaElectronica>;
}
