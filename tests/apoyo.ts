/**
 * Utilidades de prueba: reloj controlable, IDs secuenciales y notificaciones firmadas.
 * Para el núcleo, las pruebas son un actor externo más (adaptador primario).
 */
import { cargarConfiguracion } from '../src/infraestructura/configuracion/configuracion';
import { construirContenedor } from '../src/infraestructura/configuracion/contenedor';
import { construirNotificacion } from '../src/infraestructura/desarrollo/SimuladorPasarelas';
import { MedioPago } from '../src/nucleo/dominio/modelo/enumeraciones';
import { NotificacionPago } from '../src/nucleo/dominio/modelo/objetosValor';
import { GeneradorIdentificadores } from '../src/nucleo/puertos/salida/GeneradorIdentificadores';
import { Reloj } from '../src/nucleo/puertos/salida/Reloj';

export class RelojControlado implements Reloj {
  constructor(private actual = new Date('2026-10-15T15:00:00Z')) {}
  ahora(): Date {
    return new Date(this.actual);
  }
  avanzarMinutos(minutos: number): void {
    this.actual = new Date(this.actual.getTime() + minutos * 60_000);
  }
}

export class IdsSecuenciales implements GeneradorIdentificadores {
  private n = 0;
  nuevoId(prefijo: string): string {
    return `${prefijo}-${String(++this.n).padStart(4, '0')}`;
  }
}

export const configuracionPrueba = cargarConfiguracion({ LOG_NOTIFICACIONES: 'false', URL_BASE: 'http://localhost:9999' });

export function crearEntorno() {
  const reloj = new RelojControlado();
  const contenedor = construirContenedor(configuracionPrueba, { reloj, identificadores: new IdsSecuenciales() });
  return { reloj, ...contenedor, casos: contenedor.casosDeUso };
}

export type Resultado = 'aprobado' | 'rechazado' | 'pendiente';

/** Notificación con el formato y la firma reales de cada pasarela. */
export function notificacion(
  medio: MedioPago,
  referencia: string,
  monto: number,
  resultado: Resultado = 'aprobado',
  firmaInvalida = false
): NotificacionPago {
  const n = construirNotificacion(medio, referencia, monto, resultado, configuracionPrueba.wompi.secretoEventos, { firmaInvalida });
  return { medioPago: medio, contenido: n.cuerpo, metadatos: n.cabeceras };
}

export const ANDES = 'EVT-ANDES26';
export const asiento = (codigo: string) => `REC-ARENA-${codigo}`;
