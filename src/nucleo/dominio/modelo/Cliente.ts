/**
 * NÚCLEO › DOMINIO — Cliente comprador.
 * Las invariantes (campos obligatorios y formato básico) viven aquí;
 * los adaptadores pueden validar sintaxis adicional antes de llamar al núcleo.
 */
import { DatosInvalidosError } from '../excepciones/errores';

export interface DatosCliente {
  nombreCompleto: string;
  correo: string;
  telefonoMovil: string;
  nacionalidad: string;
}

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PATRON_TELEFONO = /^\+?[0-9]{7,15}$/;

export class Cliente {
  readonly nombreCompleto: string;
  readonly correo: string;
  readonly telefonoMovil: string;
  readonly nacionalidad: string;

  constructor(readonly id: string, datos: DatosCliente) {
    const nombre = datos.nombreCompleto?.trim();
    const correo = datos.correo?.trim().toLowerCase();
    const telefono = datos.telefonoMovil?.replace(/[\s-]/g, '');
    const nacionalidad = datos.nacionalidad?.trim();

    if (!id) throw new DatosInvalidosError('El cliente requiere un identificador.');
    if (!nombre) throw new DatosInvalidosError('El nombre completo es obligatorio.');
    if (!correo || !PATRON_CORREO.test(correo)) throw new DatosInvalidosError('El correo electrónico no es válido.');
    if (!telefono || !PATRON_TELEFONO.test(telefono)) {
      throw new DatosInvalidosError('El teléfono móvil debe tener entre 7 y 15 dígitos (puede iniciar con +).');
    }
    if (!nacionalidad) throw new DatosInvalidosError('La nacionalidad es obligatoria.');

    this.nombreCompleto = nombre;
    this.correo = correo;
    this.telefonoMovil = telefono;
    this.nacionalidad = nacionalidad;
  }
}
