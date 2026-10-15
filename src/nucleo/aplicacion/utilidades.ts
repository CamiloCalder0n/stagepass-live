/**
 * NÚCLEO › APLICACIÓN — Funciones auxiliares compartidas por los casos de uso.
 */
import { Asiento } from '../dominio/modelo/Asiento';
import { MedioPago } from '../dominio/modelo/enumeraciones';
import { AsientoSeleccionado } from '../dominio/modelo/objetosValor';
import { AsientoNoDisponibleError, DatosInvalidosError, RecursoNoEncontradoError } from '../dominio/excepciones/errores';
import { PasarelaPago } from '../puertos/salida/PasarelaPago';
import { RepositorioAsientos } from '../puertos/salida/RepositorioAsientos';

export function exigirIdsUnicos(asientoIds: readonly string[]): string[] {
  if (!Array.isArray(asientoIds) || asientoIds.length === 0) {
    throw new DatosInvalidosError('Debe seleccionar al menos un asiento.');
  }
  const unicos = [...new Set(asientoIds)];
  if (unicos.length !== asientoIds.length) throw new DatosInvalidosError('Hay asientos repetidos en la selección.');
  return unicos;
}

/** Carga los asientos pedidos del evento y exige que existan y estén disponibles. */
export async function cargarAsientosDisponibles(
  repositorio: RepositorioAsientos,
  eventoId: string,
  asientoIds: readonly string[]
): Promise<Asiento[]> {
  const asientos = await repositorio.buscarPorIds(eventoId, asientoIds);
  const encontrados = new Set(asientos.map((a) => a.id));
  const faltante = asientoIds.find((id) => !encontrados.has(id));
  if (faltante) throw new RecursoNoEncontradoError('Asiento del evento', faltante);

  const ocupados = asientos.filter((a) => !a.estaDisponible()).map((a) => a.codigoUbicacion);
  if (ocupados.length > 0) throw new AsientoNoDisponibleError(ocupados);
  return asientos;
}

export function aSeleccion(asientos: readonly Asiento[]): AsientoSeleccionado[] {
  return asientos.map((a) => ({ asientoId: a.id, codigoUbicacion: a.codigoUbicacion, precioBase: a.precioBase }));
}

export function seleccionarPasarela(pasarelas: readonly PasarelaPago[], medio: MedioPago): PasarelaPago {
  const pasarela = pasarelas.find((p) => p.medioPago === medio);
  if (!pasarela) throw new DatosInvalidosError(`El medio de pago "${medio}" no está disponible.`);
  return pasarela;
}
