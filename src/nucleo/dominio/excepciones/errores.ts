/**
 * NÚCLEO › DOMINIO — Excepciones de negocio.
 * El núcleo solo lanza estas excepciones; cada adaptador primario decide
 * cómo traducirlas a su tecnología (código HTTP, mensaje de consola, etc.).
 */

export abstract class ErrorDominio extends Error {
  protected constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

/** Datos que violan una invariante del dominio. */
export class DatosInvalidosError extends ErrorDominio {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

export class RecursoNoEncontradoError extends ErrorDominio {
  constructor(recurso: string, id: string) {
    super(`${recurso} "${id}" no existe.`);
  }
}

export class EventoNoDisponibleError extends ErrorDominio {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

export class AsientoNoDisponibleError extends ErrorDominio {
  constructor(codigos: string[]) {
    super(`Los asientos ${codigos.join(', ')} no están disponibles.`);
  }
}

export class LimiteBoletasExcedidoError extends ErrorDominio {
  constructor(acumuladas: number, solicitadas: number, maximo: number) {
    super(
      `Límite excedido: el cliente ya tiene ${acumuladas} boletas para este evento y solicita ${solicitadas}; ` +
        `el máximo por evento es ${maximo}.`
    );
  }
}

/** Cambio de estado no permitido por el ciclo de vida de una entidad. */
export class TransicionEstadoInvalidaError extends ErrorDominio {
  constructor(entidad: string, desde: string, accion: string) {
    super(`${entidad} en estado "${desde}" no permite la acción "${accion}".`);
  }
}

/** La confirmación de pago no es auténtica o no coincide con la orden. */
export class PagoNoVerificadoError extends ErrorDominio {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

/** Otro proceso modificó los datos al mismo tiempo (ej. dos compradores del mismo asiento). */
export class ConflictoConcurrenciaError extends ErrorDominio {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

/** Un servicio externo (pasarela, facturador…) no respondió como se esperaba. */
export class ServicioExternoError extends ErrorDominio {
  constructor(servicio: string, detalle: string) {
    super(`El servicio ${servicio} falló: ${detalle}`);
  }
}
