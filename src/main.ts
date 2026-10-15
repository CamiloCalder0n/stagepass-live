/**
 * Punto de entrada: carga la configuración, arma el hexágono y arranca los
 * adaptadores primarios (servidor web y tarea programada).
 */
import { cargarConfiguracion } from './infraestructura/configuracion/configuracion';
import { construirContenedor } from './infraestructura/configuracion/contenedor';
import { ProgramadorLiberacionReservas } from './infraestructura/entrada/programador/ProgramadorLiberacionReservas';
import { crearAplicacionWeb } from './infraestructura/entrada/rest/aplicacionWeb';

const config = cargarConfiguracion();
const { casosDeUso } = construirContenedor(config);

const app = crearAplicacionWeb(casosDeUso, {
  habilitarSimulador: config.habilitarSimulador,
  secretoEventosWompi: config.wompi.secretoEventos,
});
const programador = new ProgramadorLiberacionReservas(casosDeUso.liberarReservas, config.intervaloLiberacionMs);

const servidor = app.listen(config.puerto, () => {
  programador.iniciar();
  console.log(`🎫 StagePass Live en ${config.urlBase}`);
  console.log(`   Webhooks de pago: ${config.urlBase}/api/webhooks/pagos/{wompi|paypal|pse}`);
  if (config.habilitarSimulador) console.log('   Simulador de pasarelas habilitado (solo desarrollo).');
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, () => {
    programador.detener();
    servidor.close(() => process.exit(0));
  });
}
