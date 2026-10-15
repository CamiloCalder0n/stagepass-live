/**
 * ADAPTADOR SECUNDARIO (DUMMY) — Facturación electrónica DIAN.
 * Implementa el puerto FacturadorElectronico. Simula al proveedor tecnológico:
 * numera la factura con un prefijo de habilitación y calcula un CUFE de prueba
 * (en la DIAN real el CUFE es un SHA-384 de los datos de la factura).
 * No envía nada a la DIAN.
 */
import { createHash } from 'node:crypto';
import { Cliente } from '../../../nucleo/dominio/modelo/Cliente';
import { Evento } from '../../../nucleo/dominio/modelo/Evento';
import { FacturaElectronica } from '../../../nucleo/dominio/modelo/objetosValor';
import { Orden } from '../../../nucleo/dominio/modelo/Orden';
import { FacturadorElectronico } from '../../../nucleo/puertos/salida/FacturadorElectronico';

export class FacturadorDianDummy implements FacturadorElectronico {
  private consecutivo = 990_000_000;
  readonly facturasEmitidas: FacturaElectronica[] = [];

  async emitirFactura(orden: Orden, cliente: Cliente, evento: Evento): Promise<FacturaElectronica> {
    const numero = `SETP${++this.consecutivo}`;
    const fechaEmision = new Date();
    const cufe = createHash('sha384')
      .update(`${numero}|${fechaEmision.toISOString()}|${orden.montoTotal}|${cliente.correo}|${evento.id}|PRUEBAS`)
      .digest('hex');
    const factura = { numero, cufe, fechaEmision };
    this.facturasEmitidas.push(factura);
    return factura;
  }
}
