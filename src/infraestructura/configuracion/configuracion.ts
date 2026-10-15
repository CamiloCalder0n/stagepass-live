/**
 * INFRAESTRUCTURA › CONFIGURACIÓN — Variables de entorno.
 * Los valores por defecto son de prueba (sandbox): nunca uses secretos reales en el repositorio.
 */
export interface Configuracion {
  puerto: number;
  urlBase: string;
  wompi: {
    llavePublica: string;
    secretoIntegridad: string;
    secretoEventos: string;
    urlCheckout: string;
  };
  correoRemitente: string;
  intervaloLiberacionMs: number;
  habilitarSimulador: boolean;
  registrarNotificacionesEnConsola: boolean;
}

export function cargarConfiguracion(entorno: NodeJS.ProcessEnv = process.env): Configuracion {
  const puerto = Number(entorno.PORT ?? 3000);
  const urlBase = entorno.URL_BASE ?? `http://localhost:${puerto}`;
  return {
    puerto,
    urlBase,
    wompi: {
      llavePublica: entorno.WOMPI_LLAVE_PUBLICA ?? 'pub_test_StagePassDemo000000000000',
      secretoIntegridad: entorno.WOMPI_SECRETO_INTEGRIDAD ?? 'test_integrity_StagePassDemoSecret',
      secretoEventos: entorno.WOMPI_SECRETO_EVENTOS ?? 'test_events_StagePassDemoSecret',
      urlCheckout: entorno.WOMPI_URL_CHECKOUT ?? 'https://checkout.wompi.co/p/',
    },
    correoRemitente: entorno.SENDGRID_REMITENTE ?? 'boletas@stagepass.live',
    intervaloLiberacionMs: Number(entorno.INTERVALO_LIBERACION_MS ?? 30_000),
    habilitarSimulador: (entorno.SIMULADOR_PASARELAS ?? 'true') !== 'false',
    registrarNotificacionesEnConsola: (entorno.LOG_NOTIFICACIONES ?? 'true') !== 'false',
  };
}
