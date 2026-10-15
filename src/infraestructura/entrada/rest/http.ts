/**
 * ADAPTADOR PRIMARIO › REST — Utilidades HTTP: validación sintáctica de entradas
 * y traducción de excepciones del dominio a códigos de estado HTTP.
 */
import { NextFunction, Request, Response } from 'express';
import {
  AsientoNoDisponibleError,
  ConflictoConcurrenciaError,
  DatosInvalidosError,
  ErrorDominio,
  EventoNoDisponibleError,
  LimiteBoletasExcedidoError,
  PagoNoVerificadoError,
  RecursoNoEncontradoError,
  ServicioExternoError,
  TransicionEstadoInvalidaError,
} from '../../../nucleo/dominio/excepciones/errores';
import { MedioPago } from '../../../nucleo/dominio/modelo/enumeraciones';

/** Error de forma de la petición (antes de llegar al núcleo). */
export class SolicitudInvalidaError extends Error {
  constructor(readonly detalles: string[]) {
    super('La solicitud tiene datos inválidos.');
  }
}

export function exigirTexto(cuerpo: Record<string, unknown>, campo: string, errores: string[]): string {
  const valor = cuerpo[campo];
  if (typeof valor !== 'string' || valor.trim() === '') {
    errores.push(`"${campo}" es obligatorio y debe ser texto.`);
    return '';
  }
  if (valor.length > 200) errores.push(`"${campo}" admite máximo 200 caracteres.`);
  return valor;
}

export function exigirListaTextos(cuerpo: Record<string, unknown>, campo: string, errores: string[]): string[] {
  const valor = cuerpo[campo];
  if (!Array.isArray(valor) || valor.length === 0 || !valor.every((v) => typeof v === 'string' && v.trim() !== '')) {
    errores.push(`"${campo}" debe ser una lista no vacía de identificadores.`);
    return [];
  }
  return valor as string[];
}

const MEDIOS_POR_TEXTO: Record<string, MedioPago> = {
  wompi: MedioPago.WOMPI,
  paypal: MedioPago.PAYPAL,
  pse: MedioPago.PSE,
};

export function interpretarMedioPago(texto: string): MedioPago | null {
  return MEDIOS_POR_TEXTO[texto.trim().toLowerCase()] ?? null;
}

export function lanzarSiHayErrores(errores: string[]): void {
  if (errores.length > 0) throw new SolicitudInvalidaError(errores);
}

/** Envuelve un controlador async para que sus errores lleguen al manejador central. */
export const asincrono =
  (manejador: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    manejador(req, res).catch(next);

/** Excepción del dominio → código HTTP. */
export function codigoHttpPara(error: unknown): number {
  if (error instanceof SolicitudInvalidaError || error instanceof DatosInvalidosError) return 400;
  if (error instanceof PagoNoVerificadoError) return 401;
  if (error instanceof RecursoNoEncontradoError) return 404;
  if (
    error instanceof AsientoNoDisponibleError ||
    error instanceof LimiteBoletasExcedidoError ||
    error instanceof EventoNoDisponibleError ||
    error instanceof ConflictoConcurrenciaError ||
    error instanceof TransicionEstadoInvalidaError
  ) {
    return 409;
  }
  if (error instanceof ServicioExternoError) return 502;
  if (error instanceof ErrorDominio) return 422;
  return 500;
}

export function manejadorErrores(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const estado = codigoHttpPara(error);
  if (estado === 500) console.error(error);
  const cuerpo: Record<string, unknown> = {
    error: estado === 500 ? 'Error interno del servidor.' : (error as Error).message,
    tipo: estado === 500 ? 'ErrorInterno' : (error as Error).name,
  };
  if (error instanceof SolicitudInvalidaError) cuerpo.detalles = error.detalles;
  res.status(estado).json(cuerpo);
}
