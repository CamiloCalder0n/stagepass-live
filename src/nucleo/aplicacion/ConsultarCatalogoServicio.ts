/**
 * NÚCLEO › APLICACIÓN — Caso de uso: consultar cartelera y disponibilidad de asientos.
 */
import { RecursoNoEncontradoError } from '../dominio/excepciones/errores';
import { Evento } from '../dominio/modelo/Evento';
import { Recinto } from '../dominio/modelo/Recinto';
import {
  ConsultarCatalogoCasoUso,
  DisponibilidadEvento,
  EventoEnCartelera,
} from '../puertos/entrada/ConsultarCatalogoCasoUso';
import { LiberarReservasExpiradasCasoUso } from '../puertos/entrada/LiberarReservasExpiradasCasoUso';
import { RepositorioAsientos } from '../puertos/salida/RepositorioAsientos';
import { RepositorioEventos } from '../puertos/salida/RepositorioEventos';
import { RepositorioRecintos } from '../puertos/salida/RepositorioRecintos';

export class ConsultarCatalogoServicio implements ConsultarCatalogoCasoUso {
  constructor(
    private readonly eventos: RepositorioEventos,
    private readonly recintos: RepositorioRecintos,
    private readonly asientos: RepositorioAsientos,
    private readonly liberarReservas: LiberarReservasExpiradasCasoUso
  ) {}

  async listarEventos(): Promise<EventoEnCartelera[]> {
    await this.liberarReservas.ejecutar();
    const eventos = await this.eventos.listar();
    const resultado: EventoEnCartelera[] = [];
    for (const evento of eventos) {
      const recinto = await this.recintoDe(evento);
      const asientos = await this.asientos.listarPorEvento(evento.id);
      resultado.push({ evento, recinto, asientosDisponibles: asientos.filter((a) => a.estaDisponible()).length });
    }
    return resultado.sort((a, b) => a.evento.fechaHora.getTime() - b.evento.fechaHora.getTime());
  }

  async consultarDisponibilidad(eventoId: string): Promise<DisponibilidadEvento> {
    const evento = await this.eventos.buscarPorId(eventoId);
    if (!evento) throw new RecursoNoEncontradoError('Evento', eventoId);
    await this.liberarReservas.ejecutar(eventoId);
    return {
      evento,
      recinto: await this.recintoDe(evento),
      asientos: await this.asientos.listarPorEvento(eventoId),
    };
  }

  private async recintoDe(evento: Evento): Promise<Recinto> {
    const recinto = await this.recintos.buscarPorId(evento.recintoId);
    if (!recinto) throw new RecursoNoEncontradoError('Recinto', evento.recintoId);
    return recinto;
  }
}
