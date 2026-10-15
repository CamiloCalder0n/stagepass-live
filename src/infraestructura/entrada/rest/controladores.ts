/**
 * ADAPTADORES PRIMARIOS (driving) — Controladores REST.
 *
 * Reciben las solicitudes del navegador o de la app móvil, validan la forma del JSON,
 * llaman al puerto primario correspondiente y traducen la respuesta a JSON.
 * No contienen reglas de negocio: no calculan tarifas, descuentos ni límites.
 */
import { Router } from 'express';
import { ConfirmarPagoCasoUso } from '../../../nucleo/puertos/entrada/ConfirmarPagoCasoUso';
import { ConsultarCatalogoCasoUso } from '../../../nucleo/puertos/entrada/ConsultarCatalogoCasoUso';
import { ConsultarOrdenCasoUso } from '../../../nucleo/puertos/entrada/ConsultarOrdenCasoUso';
import { CotizarCompraCasoUso } from '../../../nucleo/puertos/entrada/CotizarCompraCasoUso';
import { GestionarClientesCasoUso } from '../../../nucleo/puertos/entrada/GestionarClientesCasoUso';
import { IniciarCompraCasoUso } from '../../../nucleo/puertos/entrada/IniciarCompraCasoUso';
import { ValidarBoletoCasoUso } from '../../../nucleo/puertos/entrada/ValidarBoletoCasoUso';
import {
  asincrono,
  exigirListaTextos,
  exigirTexto,
  interpretarMedioPago,
  lanzarSiHayErrores,
  SolicitudInvalidaError,
} from './http';
import {
  asientoJson,
  boletoJson,
  carteleraJson,
  clienteJson,
  confirmacionJson,
  eventoJson,
  liquidacionJson,
  ordenJson,
  recintoJson,
  validacionJson,
} from './mapeadoresJson';

export class ControladorCatalogo {
  constructor(private readonly catalogo: ConsultarCatalogoCasoUso) {}

  rutas(): Router {
    return Router()
      .get(
        '/eventos',
        asincrono(async (_req, res) => {
          res.json((await this.catalogo.listarEventos()).map(carteleraJson));
        })
      )
      .get(
        '/eventos/:eventoId/asientos',
        asincrono(async (req, res) => {
          const d = await this.catalogo.consultarDisponibilidad(req.params.eventoId);
          res.json({ evento: eventoJson(d.evento), recinto: recintoJson(d.recinto), asientos: d.asientos.map(asientoJson) });
        })
      );
  }
}

export class ControladorClientes {
  constructor(private readonly clientes: GestionarClientesCasoUso) {}

  rutas(): Router {
    return Router()
      .get(
        '/clientes',
        asincrono(async (_req, res) => {
          res.json((await this.clientes.listar()).map(clienteJson));
        })
      )
      .post(
        '/clientes',
        asincrono(async (req, res) => {
          const errores: string[] = [];
          const datos = {
            nombreCompleto: exigirTexto(req.body, 'nombreCompleto', errores),
            correo: exigirTexto(req.body, 'correo', errores),
            telefonoMovil: exigirTexto(req.body, 'telefonoMovil', errores),
            nacionalidad: exigirTexto(req.body, 'nacionalidad', errores),
          };
          lanzarSiHayErrores(errores);
          res.status(201).json(clienteJson(await this.clientes.registrar(datos)));
        })
      );
  }
}

export class ControladorCompras {
  constructor(
    private readonly cotizar: CotizarCompraCasoUso,
    private readonly iniciar: IniciarCompraCasoUso,
    private readonly consultar: ConsultarOrdenCasoUso
  ) {}

  rutas(): Router {
    return Router()
      .post(
        '/cotizaciones',
        asincrono(async (req, res) => {
          const errores: string[] = [];
          const eventoId = exigirTexto(req.body, 'eventoId', errores);
          const asientoIds = exigirListaTextos(req.body, 'asientoIds', errores);
          lanzarSiHayErrores(errores);
          res.json(liquidacionJson(await this.cotizar.ejecutar({ eventoId, asientoIds })));
        })
      )
      .post(
        '/ordenes',
        asincrono(async (req, res) => {
          const errores: string[] = [];
          const clienteId = exigirTexto(req.body, 'clienteId', errores);
          const eventoId = exigirTexto(req.body, 'eventoId', errores);
          const asientoIds = exigirListaTextos(req.body, 'asientoIds', errores);
          const medioPago = interpretarMedioPago(exigirTexto(req.body, 'medioPago', errores));
          if (!medioPago) errores.push('"medioPago" debe ser Wompi, PayPal o PSE.');
          lanzarSiHayErrores(errores);

          const r = await this.iniciar.ejecutar({ clienteId, eventoId, asientoIds, medioPago: medioPago! });
          res.status(201).json({
            orden: ordenJson(r.orden),
            liquidacion: liquidacionJson(r.liquidacion),
            pago: { ...r.registroPago },
          });
        })
      )
      .get(
        '/ordenes/:ordenId',
        asincrono(async (req, res) => {
          const d = await this.consultar.ejecutar(req.params.ordenId);
          res.json({ orden: ordenJson(d.orden), boletos: d.boletos.map(boletoJson) });
        })
      );
  }
}

export class ControladorBoletos {
  constructor(private readonly boletos: ValidarBoletoCasoUso) {}

  rutas(): Router {
    return Router()
      .get(
        '/boletos/validar/:codigo',
        asincrono(async (req, res) => {
          res.json(validacionJson(await this.boletos.validar(req.params.codigo)));
        })
      )
      .get(
        '/boletos/:boletoId/representacion',
        asincrono(async (req, res) => {
          const r = await this.boletos.obtenerRepresentacion(req.params.boletoId);
          res.type(r.tipoContenido).send(r.contenido);
        })
      );
  }
}

/**
 * ADAPTADOR PRIMARIO — Endpoint expuesto para las notificaciones asíncronas de las pasarelas.
 * Conserva el cuerpo crudo (texto) porque las firmas se calculan sobre el contenido original.
 */
export class ControladorWebhooksPago {
  constructor(private readonly confirmarPago: ConfirmarPagoCasoUso) {}

  rutas(): Router {
    return Router().post(
      '/webhooks/pagos/:pasarela',
      asincrono(async (req, res) => {
        const medioPago = interpretarMedioPago(req.params.pasarela);
        if (!medioPago) throw new SolicitudInvalidaError([`Pasarela desconocida: "${req.params.pasarela}".`]);
        if (typeof req.body !== 'string' || req.body.length === 0) {
          throw new SolicitudInvalidaError(['La notificación llegó sin cuerpo.']);
        }
        const metadatos: Record<string, string> = {};
        for (const [clave, valor] of Object.entries(req.headers)) {
          if (typeof valor === 'string') metadatos[clave.toLowerCase()] = valor;
        }
        const resultado = await this.confirmarPago.ejecutar({ medioPago, contenido: req.body, metadatos });
        res.status(200).json(confirmacionJson(resultado));
      })
    );
  }
}
