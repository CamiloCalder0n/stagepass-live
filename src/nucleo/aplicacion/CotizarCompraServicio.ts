/**
 * NÚCLEO › APLICACIÓN — Caso de uso: cotizar una compra.
 * La interfaz nunca calcula tarifas: siempre pregunta al núcleo.
 */
import { RecursoNoEncontradoError } from '../dominio/excepciones/errores';
import { LiquidacionCompra } from '../dominio/modelo/objetosValor';
import { PoliticaTarifas } from '../dominio/servicios/PoliticaTarifas';
import { ComandoCotizarCompra, CotizarCompraCasoUso } from '../puertos/entrada/CotizarCompraCasoUso';
import { LiberarReservasExpiradasCasoUso } from '../puertos/entrada/LiberarReservasExpiradasCasoUso';
import { Reloj } from '../puertos/salida/Reloj';
import { RepositorioAsientos } from '../puertos/salida/RepositorioAsientos';
import { RepositorioEventos } from '../puertos/salida/RepositorioEventos';
import { aSeleccion, cargarAsientosDisponibles, exigirIdsUnicos } from './utilidades';

export class CotizarCompraServicio implements CotizarCompraCasoUso {
  constructor(
    private readonly eventos: RepositorioEventos,
    private readonly asientos: RepositorioAsientos,
    private readonly liberarReservas: LiberarReservasExpiradasCasoUso,
    private readonly reloj: Reloj
  ) {}

  async ejecutar(comando: ComandoCotizarCompra): Promise<LiquidacionCompra> {
    const asientoIds = exigirIdsUnicos(comando.asientoIds);
    const evento = await this.eventos.buscarPorId(comando.eventoId);
    if (!evento) throw new RecursoNoEncontradoError('Evento', comando.eventoId);
    evento.validarDisponibleParaVenta(this.reloj.ahora());

    await this.liberarReservas.ejecutar(evento.id);
    const asientos = await cargarAsientosDisponibles(this.asientos, evento.id, asientoIds);
    return PoliticaTarifas.liquidar(aSeleccion(asientos));
  }
}
