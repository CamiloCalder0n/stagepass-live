'use strict';
/**
 * Cliente web de StagePass Live (navegador).
 * Solo presenta información y envía solicitudes al adaptador primario REST:
 * nunca calcula tarifas, descuentos ni límites (eso lo hace el núcleo).
 */

const estado = { eventos: [], eventoId: null, asientos: [], seleccion: new Set(), clientes: [], orden: null, pago: null };
const $ = (s) => document.querySelector(s);
const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const fecha = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

async function api(metodo, ruta, cuerpo) {
  const r = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error([datos.error, ...(datos.detalles ?? [])].filter(Boolean).join(' ') || 'Error inesperado');
  return datos;
}

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) n.append(h instanceof Node ? h : String(h));
  return n;
}

let temporizadorAviso;
function avisar(texto, tipo = 'ok') {
  const a = $('#aviso');
  a.textContent = texto;
  a.className = `aviso ${tipo}`;
  a.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => (a.hidden = true), 5000);
}

// ---------------- Cartelera ----------------
async function cargarCartelera() {
  estado.eventos = await api('GET', '/eventos');
  $('#cartelera').replaceChildren(
    ...estado.eventos.map((e) =>
      el('button', {
          class: `tarjeta-evento${e.id === estado.eventoId ? ' activa' : ''}`,
          disabled: e.estado !== 'Programado',
          onclick: () => seleccionarEvento(e.id),
        },
        el('span', { class: 'tipo' }, e.tipo),
        el('h3', {}, e.nombre),
        el('small', {}, `${fecha(e.fechaHora)} · ${e.recinto.nombre}, ${e.recinto.ciudad}`),
        el('span', { class: `etiqueta ${e.estado}` },
          e.estado === 'Programado' ? `${e.asientosDisponibles} disponibles` : e.estado)
      )
    )
  );
}

async function seleccionarEvento(id) {
  estado.eventoId = id;
  estado.seleccion.clear();
  $('#zonaCompra').hidden = false;
  await Promise.all([cargarCartelera(), cargarAsientos()]);
  $('#zonaCompra').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------- Mapa de asientos ----------------
const nombreZona = (codigo) => codigo.replace(/-?\d+$/, '').replace(/-$/, '');

async function cargarAsientos() {
  const d = await api('GET', `/eventos/${estado.eventoId}/asientos`);
  estado.asientos = d.asientos;
  $('#tituloEvento').textContent = d.evento.nombre;
  $('#detalleEvento').textContent = `${d.evento.tipo} · ${fecha(d.evento.fechaHora)} · ${d.recinto.nombre} (${d.recinto.ciudad})`;

  const zonas = new Map();
  for (const a of d.asientos) {
    const z = nombreZona(a.codigoUbicacion);
    if (!zonas.has(z)) zonas.set(z, []);
    zonas.get(z).push(a);
  }
  $('#mapaAsientos').replaceChildren(
    ...[...zonas].sort((a, b) => b[1][0].precioBase - a[1][0].precioBase).map(([zona, asientos]) =>
      el('div', { class: 'zona' },
        el('h4', {}, `${zona} · ${pesos.format(asientos[0].precioBase)}`),
        el('div', { class: 'asientos' },
          asientos.map((a) =>
            el('button', {
              class: `asiento ${a.estado}${estado.seleccion.has(a.id) ? ' seleccionado' : ''}`,
              'data-id': a.id,
              disabled: a.estado !== 'Disponible',
              title: `${a.codigoUbicacion} — ${a.estado}`,
              onclick: () => alternarAsiento(a.id),
            }, a.codigoUbicacion.replace(/^.*?-/, ''))
          )
        )
      )
    )
  );
  // Si algún asiento seleccionado dejó de estar disponible, se quita de la selección.
  for (const id of [...estado.seleccion]) {
    if (estado.asientos.find((a) => a.id === id)?.estado !== 'Disponible') estado.seleccion.delete(id);
  }
  actualizarResumen();
}

function alternarAsiento(id) {
  estado.seleccion.has(id) ? estado.seleccion.delete(id) : estado.seleccion.add(id);
  document.querySelectorAll('.asiento').forEach((b) => b.classList.toggle('seleccionado', estado.seleccion.has(b.dataset.id)));
  actualizarResumen();
}

// ---------------- Resumen (cotización calculada por el núcleo) ----------------
let temporizadorCotizacion;
function actualizarResumen() {
  const elegidos = estado.asientos.filter((a) => estado.seleccion.has(a.id));
  $('#seleccion').replaceChildren(...elegidos.map((a) => el('li', {}, a.codigoUbicacion)));
  $('#btnComprar').disabled = true;
  if (elegidos.length === 0) return $('#resumen').replaceChildren();
  clearTimeout(temporizadorCotizacion);
  temporizadorCotizacion = setTimeout(cotizar, 150);
}

async function cotizar() {
  try {
    const q = await api('POST', '/cotizaciones', { eventoId: estado.eventoId, asientoIds: [...estado.seleccion] });
    $('#resumen').replaceChildren(
      el('dt', {}, `Valor base (${q.cantidadBoletas} boleta${q.cantidadBoletas > 1 ? 's' : ''})`), el('dd', {}, pesos.format(q.valorBase)),
      el('dt', {}, `Tarifa administrativa ${Math.round(q.porcentajeTarifa * 100)} %`), el('dd', {}, `+ ${pesos.format(q.tarifaServicio)}`),
      el('dt', {}, `Descuento comercial ${Math.round(q.porcentajeDescuento * 100)} %`), el('dd', {}, `− ${pesos.format(q.descuento)}`),
      el('dt', { class: 'total' }, 'Total a pagar'), el('dd', { class: 'total' }, pesos.format(q.montoTotal))
    );
    $('#btnComprar').disabled = !$('#selectCliente').value;
  } catch (e) {
    $('#resumen').replaceChildren(el('dd', { class: 'error' }, e.message));
  }
}

// ---------------- Clientes ----------------
async function cargarClientes(seleccionar) {
  estado.clientes = await api('GET', '/clientes');
  const s = $('#selectCliente');
  s.replaceChildren(...estado.clientes.map((c) => el('option', { value: c.id }, `${c.nombreCompleto} · ${c.correo}`)));
  if (seleccionar) s.value = seleccionar;
}

$('#formCliente').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const datos = Object.fromEntries(new FormData(ev.target));
  try {
    const c = await api('POST', '/clientes', datos);
    ev.target.reset();
    $('#nuevoCliente').open = false;
    await cargarClientes(c.id);
    avisar(`Cliente ${c.nombreCompleto} registrado.`);
  } catch (e) {
    avisar(e.message, 'error');
  }
});

// ---------------- Compra ----------------
$('#btnComprar').addEventListener('click', async () => {
  $('#btnComprar').disabled = true;
  try {
    const r = await api('POST', '/ordenes', {
      clienteId: $('#selectCliente').value,
      eventoId: estado.eventoId,
      asientoIds: [...estado.seleccion],
      medioPago: document.querySelector('input[name=medio]:checked').value,
    });
    estado.orden = r.orden;
    estado.pago = r.pago;
    estado.seleccion.clear();
    await cargarAsientos();
    abrirOrden();
  } catch (e) {
    avisar(e.message, 'error');
    await cargarAsientos();
  }
});

let sondeo, cuentaRegresiva;
function abrirOrden() {
  renderOrden([]);
  $('#dialogoOrden').showModal();
  clearInterval(sondeo);
  sondeo = setInterval(refrescarOrden, 3000);
  clearInterval(cuentaRegresiva);
  cuentaRegresiva = setInterval(() => renderReloj(), 1000);
}

async function refrescarOrden() {
  if (!estado.orden) return;
  const d = await api('GET', `/ordenes/${estado.orden.id}`);
  const cambio = d.orden.estado !== estado.orden.estado;
  estado.orden = d.orden;
  if (cambio || d.boletos.length) renderOrden(d.boletos);
  if (estado.orden.estado !== 'Pendiente de Pago') {
    clearInterval(sondeo);
    clearInterval(cuentaRegresiva);
    await Promise.all([cargarAsientos(), cargarCartelera()]);
  }
}

function renderReloj() {
  const r = document.getElementById('reloj');
  if (!r || !estado.orden) return;
  const ms = new Date(estado.orden.tiempoExpiracion) - Date.now();
  if (ms <= 0) {
    r.textContent = '00:00';
    refrescarOrden();
    return;
  }
  const m = String(Math.floor(ms / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  r.textContent = `${m}:${s}`;
}

const CLASE_ESTADO = { 'Pendiente de Pago': 'pendiente', Aprobada: 'aprobada', Rechazada: 'rechazada', Expirada: 'expirada' };

function renderOrden(boletos, advertencias = []) {
  const o = estado.orden;
  const pendiente = o.estado === 'Pendiente de Pago';
  const partes = [
    el('div', { class: 'orden-cabecera' },
      el('div', {}, el('h3', {}, `Orden ${o.id}`), el('p', { class: 'tenue' }, `${o.asientos.map((a) => a.codigoUbicacion).join(', ')} · ${o.medioPago}`)),
      el('span', { class: `estado ${CLASE_ESTADO[o.estado]}` }, o.estado)
    ),
    el('dl', { class: 'resumen', style: 'margin-top:1rem' },
      el('dt', {}, 'Valor base'), el('dd', {}, pesos.format(o.valorBase)),
      el('dt', {}, 'Tarifa de servicio'), el('dd', {}, `+ ${pesos.format(o.tarifaServicio)}`),
      el('dt', {}, 'Descuento'), el('dd', {}, `− ${pesos.format(o.descuento)}`),
      el('dt', { class: 'total' }, 'Total'), el('dd', { class: 'total' }, pesos.format(o.montoTotal))
    ),
    ...advertencias.map((a) => el('p', { class: 'advertencia' }, a)),
    pendiente && el('div', {},
      el('p', { class: 'tenue' }, 'Los asientos están bloqueados. Tiempo restante para pagar:'),
      el('div', { id: 'reloj', class: 'reloj' }, '10:00'),
      el('div', { class: 'acciones' },
        el('a', { class: 'boton enlace secundario', href: estado.pago.urlPago, target: '_blank', rel: 'noopener' },
          o.medioPago === 'Wompi' ? 'Ir al checkout de Wompi (sandbox)' : `Ir a ${o.medioPago} (simulado)`),
        el('button', { class: 'boton', onclick: () => simular('aprobado') }, 'Simular pago aprobado'),
        el('button', { class: 'boton peligro', onclick: () => simular('rechazado') }, 'Simular pago rechazado')
      ),
      el('p', { class: 'nota', style: 'margin-top:.8rem' },
        'El simulador hace de pasarela: firma la notificación con el formato de la pasarela y la envía al webhook real /api/webhooks/pagos.')
    ),
    boletos.length > 0 && el('div', { class: 'boletos' },
      el('h3', {}, 'Tus boletas'),
      boletos.map((b) => el('img', { src: b.representacionUrl, alt: `Boleto ${b.codigoUbicacion} — ${b.codigoRedencion}` }))
    ),
    el('div', { class: 'acciones' }, el('button', { class: 'boton secundario', onclick: () => $('#dialogoOrden').close() }, 'Cerrar')),
  ];
  $('#contenidoOrden').replaceChildren(...partes.filter(Boolean));
  renderReloj();
}

async function simular(resultado) {
  try {
    const r = await api('POST', '/simulador/notificar', {
      medio: estado.orden.medioPago, referencia: estado.orden.referenciaPago, monto: estado.orden.montoTotal, resultado,
    });
    const w = r.respuestaWebhook;
    if (w.estado !== 200) throw new Error(w.cuerpo.error);
    estado.orden = w.cuerpo.orden;
    renderOrden(w.cuerpo.boletos, w.cuerpo.advertencias);
    if (estado.orden.estado !== 'Pendiente de Pago') {
      clearInterval(sondeo);
      clearInterval(cuentaRegresiva);
      await Promise.all([cargarAsientos(), cargarCartelera()]);
    }
    avisar(resultado === 'aprobado' ? `¡Pago aprobado! Se emitieron ${w.cuerpo.boletos.length} boleta(s).` : 'Pago rechazado: los asientos se liberaron.',
      resultado === 'aprobado' ? 'ok' : 'error');
  } catch (e) {
    avisar(e.message, 'error');
  }
}

// ---------------- Validación de boletos ----------------
$('#formValidar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    const v = await api('GET', `/boletos/validar/${encodeURIComponent($('#codigoValidar').value.trim())}`);
    $('#resultadoValidacion').replaceChildren(
      el('div', { class: `resultado ${v.valido ? 'valido' : 'invalido'}` },
        el('h3', {}, v.valido ? '✅ Acceso permitido' : '⛔ Acceso denegado'),
        el('p', { class: 'tenue' }, v.motivo),
        v.boleto && el('p', {}, `${v.evento?.nombre ?? ''} · ${v.boleto.codigoUbicacion} · emitido ${fecha(v.boleto.fechaEmision)}`),
        v.valido && el('img', { src: v.boleto.representacionUrl, alt: 'Boleto' })
      )
    );
  } catch (e) {
    avisar(e.message, 'error');
  }
});

// ---------------- Navegación y arranque ----------------
document.querySelectorAll('.pestana').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.pestana').forEach((x) => x.classList.toggle('activa', x === b));
    document.querySelectorAll('.vista').forEach((v) => v.classList.toggle('activa', v.id === `vista-${b.dataset.vista}`));
  })
);
$('#selectCliente').addEventListener('change', () => actualizarResumen());

Promise.all([cargarCartelera(), cargarClientes()]).catch((e) => avisar(`No se pudo conectar: ${e.message}`, 'error'));
