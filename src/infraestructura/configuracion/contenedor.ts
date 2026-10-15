/**
 * INFRAESTRUCTURA › CONFIGURACIÓN — Raíz de composición (Composition Root).
 *
 * Único lugar que conoce a la vez el núcleo y los adaptadores concretos.
 * Aplica la inversión de dependencias: construye los adaptadores y los inyecta,
 * por constructor, en los casos de uso que solo conocen los puertos.
 * Cambiar MySQL por PostgreSQL o Wompi por otra pasarela solo cambia este archivo.
 */
import { ConfirmarPagoServicio } from '../../nucleo/aplicacion/ConfirmarPagoServicio';
import { ConsultarCatalogoServicio } from '../../nucleo/aplicacion/ConsultarCatalogoServicio';
import { ConsultarOrdenServicio } from '../../nucleo/aplicacion/ConsultarOrdenServicio';
import { CotizarCompraServicio } from '../../nucleo/aplicacion/CotizarCompraServicio';
import { GestionarClientesServicio } from '../../nucleo/aplicacion/GestionarClientesServicio';
import { GestorAsientosOrden } from '../../nucleo/aplicacion/GestorAsientosOrden';
import { IniciarCompraServicio } from '../../nucleo/aplicacion/IniciarCompraServicio';
import { LiberarReservasExpiradasServicio } from '../../nucleo/aplicacion/LiberarReservasExpiradasServicio';
import { ValidarBoletoServicio } from '../../nucleo/aplicacion/ValidarBoletoServicio';
import { ConfirmarPagoCasoUso } from '../../nucleo/puertos/entrada/ConfirmarPagoCasoUso';
import { ConsultarCatalogoCasoUso } from '../../nucleo/puertos/entrada/ConsultarCatalogoCasoUso';
import { ConsultarOrdenCasoUso } from '../../nucleo/puertos/entrada/ConsultarOrdenCasoUso';
import { CotizarCompraCasoUso } from '../../nucleo/puertos/entrada/CotizarCompraCasoUso';
import { GestionarClientesCasoUso } from '../../nucleo/puertos/entrada/GestionarClientesCasoUso';
import { IniciarCompraCasoUso } from '../../nucleo/puertos/entrada/IniciarCompraCasoUso';
import { LiberarReservasExpiradasCasoUso } from '../../nucleo/puertos/entrada/LiberarReservasExpiradasCasoUso';
import { ValidarBoletoCasoUso } from '../../nucleo/puertos/entrada/ValidarBoletoCasoUso';
import { GeneradorIdentificadores } from '../../nucleo/puertos/salida/GeneradorIdentificadores';
import { PasarelaPago } from '../../nucleo/puertos/salida/PasarelaPago';
import { Reloj } from '../../nucleo/puertos/salida/Reloj';
import { GeneradorCredencialesHmacQr } from '../salida/boletos/GeneradorCredencialesHmacQr';
import { FacturadorDianDummy } from '../salida/facturacion/FacturadorDianDummy';
import { NotificadorSendGridDummy, NotificadorWhatsAppDummy } from '../salida/notificaciones/NotificadoresDummy';
import { AdaptadorPayPalDummy } from '../salida/pagos/paypal/AdaptadorPayPalDummy';
import { AdaptadorPseDummy } from '../salida/pagos/pse/AdaptadorPseDummy';
import { AdaptadorPasarelaWompi } from '../salida/pagos/wompi/AdaptadorPasarelaWompi';
import { BaseDatosMongoDummy } from '../salida/persistencia/mongodb/BaseDatosMongoDummy';
import {
  RepositorioBoletosMongoDummy,
  RepositorioClientesMongoDummy,
  RepositorioOrdenesMongoDummy,
} from '../salida/persistencia/mongodb/RepositoriosMongoDummy';
import { semillaClientes } from '../salida/persistencia/mongodb/semillaMongo';
import { BaseDatosMySqlDummy } from '../salida/persistencia/mysql/BaseDatosMySqlDummy';
import {
  RepositorioAsientosMySqlDummy,
  RepositorioEventosMySqlDummy,
  RepositorioRecintosMySqlDummy,
} from '../salida/persistencia/mysql/RepositoriosMySqlDummy';
import { semillaLegacy } from '../salida/persistencia/mysql/semillaLegacy';
import { GeneradorIdentificadoresUuid, RelojSistema } from '../salida/sistema/adaptadoresSistema';
import { Configuracion } from './configuracion';

export interface CasosDeUso {
  catalogo: ConsultarCatalogoCasoUso;
  clientes: GestionarClientesCasoUso;
  cotizarCompra: CotizarCompraCasoUso;
  iniciarCompra: IniciarCompraCasoUso;
  confirmarPago: ConfirmarPagoCasoUso;
  liberarReservas: LiberarReservasExpiradasCasoUso;
  consultarOrden: ConsultarOrdenCasoUso;
  boletos: ValidarBoletoCasoUso;
}

export interface Contenedor {
  casosDeUso: CasosDeUso;
  /** Adaptadores expuestos para inspección en pruebas y en la consola de desarrollo. */
  adaptadores: {
    whatsapp: NotificadorWhatsAppDummy;
    correo: NotificadorSendGridDummy;
    dian: FacturadorDianDummy;
    pasarelas: PasarelaPago[];
  };
}

export interface OpcionesContenedor {
  reloj?: Reloj;
  identificadores?: GeneradorIdentificadores;
}

export function construirContenedor(config: Configuracion, opciones: OpcionesContenedor = {}): Contenedor {
  // ── Adaptadores secundarios ────────────────────────────────────────────────
  const reloj = opciones.reloj ?? new RelojSistema();
  const identificadores = opciones.identificadores ?? new GeneradorIdentificadoresUuid();

  const mysql = new BaseDatosMySqlDummy(semillaLegacy());
  const recintos = new RepositorioRecintosMySqlDummy(mysql);
  const eventos = new RepositorioEventosMySqlDummy(mysql);
  const asientos = new RepositorioAsientosMySqlDummy(mysql);

  const mongo = new BaseDatosMongoDummy();
  semillaClientes().forEach((c) => mongo.reemplazar('clientes', c));
  const clientes = new RepositorioClientesMongoDummy(mongo);
  const ordenes = new RepositorioOrdenesMongoDummy(mongo);
  const boletos = new RepositorioBoletosMongoDummy(mongo);

  const urlSimulador = `${config.urlBase}/simulador.html`;
  const pasarelas: PasarelaPago[] = [
    new AdaptadorPasarelaWompi({ ...config.wompi, urlRedireccion: `${config.urlBase}/` }),
    new AdaptadorPayPalDummy(urlSimulador),
    new AdaptadorPseDummy(urlSimulador),
  ];
  const generadorCredenciales = new GeneradorCredencialesHmacQr();
  const whatsapp = new NotificadorWhatsAppDummy(config.registrarNotificacionesEnConsola);
  const correo = new NotificadorSendGridDummy(config.correoRemitente, config.registrarNotificacionesEnConsola);
  const dian = new FacturadorDianDummy();

  // ── Núcleo: casos de uso con sus puertos inyectados ────────────────────────
  const gestorAsientos = new GestorAsientosOrden(asientos);
  const liberarReservas = new LiberarReservasExpiradasServicio(ordenes, gestorAsientos, reloj);

  const casosDeUso: CasosDeUso = {
    catalogo: new ConsultarCatalogoServicio(eventos, recintos, asientos, liberarReservas),
    clientes: new GestionarClientesServicio(clientes, identificadores),
    cotizarCompra: new CotizarCompraServicio(eventos, asientos, liberarReservas, reloj),
    iniciarCompra: new IniciarCompraServicio(
      clientes,
      eventos,
      asientos,
      ordenes,
      pasarelas,
      gestorAsientos,
      liberarReservas,
      identificadores,
      reloj
    ),
    confirmarPago: new ConfirmarPagoServicio(
      pasarelas,
      ordenes,
      boletos,
      eventos,
      clientes,
      asientos,
      gestorAsientos,
      generadorCredenciales,
      dian,
      [whatsapp, correo],
      identificadores,
      reloj
    ),
    liberarReservas,
    consultarOrden: new ConsultarOrdenServicio(ordenes, boletos, liberarReservas),
    boletos: new ValidarBoletoServicio(boletos, ordenes, eventos, generadorCredenciales),
  };

  return { casosDeUso, adaptadores: { whatsapp, correo, dian, pasarelas } };
}
