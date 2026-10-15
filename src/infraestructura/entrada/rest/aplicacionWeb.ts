/**
 * ADAPTADOR PRIMARIO › REST — Servidor web Express.
 * El framework web vive solo aquí, fuera del hexágono.
 */
import express, { Express } from 'express';
import path from 'node:path';
import { CasosDeUso } from '../../configuracion/contenedor';
import { rutasSimulador } from '../../desarrollo/SimuladorPasarelas';
import {
  ControladorBoletos,
  ControladorCatalogo,
  ControladorClientes,
  ControladorCompras,
  ControladorWebhooksPago,
} from './controladores';
import { manejadorErrores } from './http';

export interface OpcionesAplicacionWeb {
  habilitarSimulador: boolean;
  secretoEventosWompi: string;
}

export function crearAplicacionWeb(casos: CasosDeUso, opciones: OpcionesAplicacionWeb): Express {
  const app = express();
  app.disable('x-powered-by');

  // Webhooks: cuerpo crudo como texto (las firmas se validan sobre el contenido original).
  app.use('/api/webhooks', express.text({ type: '*/*', limit: '256kb' }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use(new ControladorCatalogo(casos.catalogo).rutas());
  api.use(new ControladorClientes(casos.clientes).rutas());
  api.use(new ControladorCompras(casos.cotizarCompra, casos.iniciarCompra, casos.consultarOrden).rutas());
  api.use(new ControladorBoletos(casos.boletos).rutas());
  api.use(new ControladorWebhooksPago(casos.confirmarPago).rutas());
  if (opciones.habilitarSimulador) api.use(rutasSimulador(opciones.secretoEventosWompi));
  api.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

  app.use('/api', api);
  app.use(express.static(path.join(__dirname, '..', '..', '..', '..', 'public')));
  app.use(manejadorErrores);
  return app;
}
