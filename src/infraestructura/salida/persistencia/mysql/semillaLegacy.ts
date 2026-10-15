/**
 * Datos de ejemplo del catálogo legacy (recintos, eventos y asientos).
 * Nombres de eventos ficticios. Precios en COP.
 */
import { FilaAsiento, FilaEstadoAsientoFuncion, FilaEvento, TablasLegacy } from './BaseDatosMySqlDummy';

interface Zona {
  prefijo: string;
  cantidad: number;
  precio: number;
}

function generarAsientos(idRecinto: string, zonas: Zona[]): FilaAsiento[] {
  return zonas.flatMap((z) =>
    Array.from({ length: z.cantidad }, (_, i) => {
      const numero = String(i + 1).padStart(2, '0');
      return {
        id_asiento: `${idRecinto}-${z.prefijo}${numero}`,
        id_recinto: idRecinto,
        codigo_ubicacion: `${z.prefijo}${numero}`,
        precio_base: `${z.precio}.00`,
      };
    })
  );
}

const ASIENTOS_ARENA = generarAsientos('REC-ARENA', [
  { prefijo: 'VIP-A', cantidad: 8, precio: 450_000 },
  { prefijo: 'PREF-B', cantidad: 12, precio: 250_000 },
  { prefijo: 'GEN-', cantidad: 16, precio: 120_000 },
]);

const ASIENTOS_TEATRO = generarAsientos('REC-TEATRO', [
  { prefijo: 'PALCO-', cantidad: 6, precio: 300_000 },
  { prefijo: 'PLATEA-', cantidad: 18, precio: 180_000 },
]);

const ASIENTOS_PARQUE = generarAsientos('REC-PARQUE', [
  { prefijo: 'VIP-F', cantidad: 6, precio: 520_000 },
  { prefijo: 'GEN-F', cantidad: 4, precio: 210_000 },
]);

const EVENTOS: FilaEvento[] = [
  {
    id_evento: 'EVT-ANDES26',
    nombre: 'Andes Sonic Tour 2026',
    tipo: 'CONC',
    id_recinto: 'REC-ARENA',
    fecha_hora: '2026-12-05 20:00:00',
    estado: 'PROG',
    clave_secreta: 'k9$AndesSonic#2026-sec-firma',
  },
  {
    id_evento: 'EVT-ECOS',
    nombre: 'Ecos del Silencio',
    tipo: 'TEAT',
    id_recinto: 'REC-TEATRO',
    fecha_hora: '2026-11-28 19:30:00',
    estado: 'PROG',
    clave_secreta: 'teatro!EcosDelSilencio*2026',
  },
  {
    id_evento: 'EVT-CORDILLERA',
    nombre: 'Festival Cordillera Live',
    tipo: 'FEST',
    id_recinto: 'REC-PARQUE',
    fecha_hora: '2027-01-23 14:00:00',
    estado: 'PROG',
    clave_secreta: 'fest#Cordillera.Live/2027',
  },
  {
    id_evento: 'EVT-SINFONICA',
    nombre: 'Noche Sinfónica de Gala',
    tipo: 'TEAT',
    id_recinto: 'REC-TEATRO',
    fecha_hora: '2026-12-12 20:00:00',
    estado: 'CANC',
    clave_secreta: 'gala$Sinfonica#2026!clave',
  },
];

const ASIENTOS_POR_RECINTO: Record<string, FilaAsiento[]> = {
  'REC-ARENA': ASIENTOS_ARENA,
  'REC-TEATRO': ASIENTOS_TEATRO,
  'REC-PARQUE': ASIENTOS_PARQUE,
};

/** Algunos asientos ya vendidos para que el mapa no arranque vacío. */
const VENDIDOS_INICIALES = new Set(['REC-ARENA-VIP-A01', 'REC-ARENA-VIP-A02', 'REC-ARENA-GEN-05', 'REC-TEATRO-PLATEA-07']);

function estadosIniciales(): FilaEstadoAsientoFuncion[] {
  return EVENTOS.flatMap((e) =>
    ASIENTOS_POR_RECINTO[e.id_recinto].map((a) => ({
      id_evento: e.id_evento,
      id_asiento: a.id_asiento,
      estado: VENDIDOS_INICIALES.has(a.id_asiento) ? ('V' as const) : ('D' as const),
      version: 1,
    }))
  );
}

export function semillaLegacy(): TablasLegacy {
  return {
    recintos: [
      { id_recinto: 'REC-ARENA', nombre: 'Arena Cumbre', ciudad: 'Bogotá', aforo_total: ASIENTOS_ARENA.length },
      { id_recinto: 'REC-TEATRO', nombre: 'Teatro Mirador', ciudad: 'Bucaramanga', aforo_total: ASIENTOS_TEATRO.length },
      { id_recinto: 'REC-PARQUE', nombre: 'Parque Ecológico La Ceja', ciudad: 'Medellín', aforo_total: ASIENTOS_PARQUE.length },
    ],
    eventos: EVENTOS,
    asientos: [...ASIENTOS_ARENA, ...ASIENTOS_TEATRO, ...ASIENTOS_PARQUE],
    estado_asiento_funcion: estadosIniciales(),
  };
}
