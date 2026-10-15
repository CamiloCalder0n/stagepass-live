/**
 * PUERTO PRIMARIO (driving) — Consultar eventos y disponibilidad de asientos.
 */
import { Asiento } from '../../dominio/modelo/Asiento';
import { Evento } from '../../dominio/modelo/Evento';
import { Recinto } from '../../dominio/modelo/Recinto';

export interface EventoEnCartelera {
  readonly evento: Evento;
  readonly recinto: Recinto;
  readonly asientosDisponibles: number;
}

export interface DisponibilidadEvento {
  readonly evento: Evento;
  readonly recinto: Recinto;
  readonly asientos: Asiento[];
}

export interface ConsultarCatalogoCasoUso {
  listarEventos(): Promise<EventoEnCartelera[]>;
  consultarDisponibilidad(eventoId: string): Promise<DisponibilidadEvento>;
}
