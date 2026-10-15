/**
 * Pruebas de arquitectura (fitness functions): verifican automáticamente las
 * fronteras hexagonales leyendo los `import` de cada archivo.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const SRC = path.join(__dirname, '..', 'src');

function archivos(carpeta: string): string[] {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(carpeta, e.name);
    return e.isDirectory() ? archivos(ruta) : ruta.endsWith('.ts') ? [ruta] : [];
  });
}

/** Devuelve cada import como ruta absoluta (internos) o nombre de paquete (externos). */
function importsDe(archivo: string): string[] {
  const codigo = fs.readFileSync(archivo, 'utf8');
  return [...codigo.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map(([, m]) =>
    m.startsWith('.') ? path.resolve(path.dirname(archivo), m) : m
  );
}

const rel = (p: string) => path.relative(SRC, p);
const dentroDe = (ruta: string, carpeta: string) => ruta.startsWith(path.join(SRC, carpeta) + path.sep);

test('Núcleo soberano: nada del núcleo importa frameworks, librerías, módulos de Node ni infraestructura', () => {
  for (const archivo of archivos(path.join(SRC, 'nucleo'))) {
    for (const imp of importsDe(archivo)) {
      assert.ok(path.isAbsolute(imp) && dentroDe(imp, 'nucleo'), `${rel(archivo)} importa "${imp}"`);
    }
  }
});

test('Dominio: las entidades y reglas no dependen de puertos ni de casos de uso', () => {
  for (const archivo of archivos(path.join(SRC, 'nucleo', 'dominio'))) {
    for (const imp of importsDe(archivo)) {
      assert.ok(dentroDe(imp, path.join('nucleo', 'dominio')), `${rel(archivo)} importa ${rel(imp)}`);
    }
  }
});

test('Puertos: son interfaces puras que solo usan tipos del dominio', () => {
  for (const archivo of archivos(path.join(SRC, 'nucleo', 'puertos'))) {
    const codigo = fs.readFileSync(archivo, 'utf8');
    assert.ok(!/^\s*export\s+(abstract\s+)?class\s/m.test(codigo), `${rel(archivo)} declara una clase`);
    assert.ok(/export interface/.test(codigo), `${rel(archivo)} no declara interfaces`);
    for (const imp of importsDe(archivo)) {
      assert.ok(dentroDe(imp, path.join('nucleo', 'dominio')), `${rel(archivo)} importa ${rel(imp)}`);
    }
  }
});

test('Puertos: ninguna firma expone tecnología (HTTP, SQL, Mongo, DTOs de pasarelas)', () => {
  const prohibido = /\b(Request|Response|HttpRequest|ResultSet|Sql\w*|Mongo\w*|Document\w*|PayPal\w*Dto|Wompi\w*|Express)\b/;
  for (const archivo of archivos(path.join(SRC, 'nucleo', 'puertos'))) {
    const codigo = fs.readFileSync(archivo, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!prohibido.test(codigo), `${rel(archivo)} expone un tipo tecnológico: ${codigo.match(prohibido)?.[0]}`);
  }
});

test('Adaptadores: no contienen reglas de negocio (no usan casos de uso ni políticas del dominio)', () => {
  const adaptadores = [...archivos(path.join(SRC, 'infraestructura', 'entrada')), ...archivos(path.join(SRC, 'infraestructura', 'salida'))];
  for (const archivo of adaptadores) {
    for (const imp of importsDe(archivo)) {
      assert.ok(!dentroDe(imp, path.join('nucleo', 'aplicacion')), `${rel(archivo)} importa un caso de uso concreto`);
      assert.ok(!dentroDe(imp, path.join('nucleo', 'dominio', 'servicios')), `${rel(archivo)} usa una política del dominio`);
    }
  }
});

test('Adaptadores primarios: dependen de los puertos de entrada, nunca de los adaptadores secundarios', () => {
  for (const archivo of archivos(path.join(SRC, 'infraestructura', 'entrada'))) {
    for (const imp of importsDe(archivo)) {
      assert.ok(!dentroDe(imp, path.join('infraestructura', 'salida')), `${rel(archivo)} importa ${rel(imp)}`);
    }
  }
});

test('Inversión de dependencias: solo la raíz de composición conoce los casos de uso concretos', () => {
  const usuarios = archivos(path.join(SRC, 'infraestructura')).filter((a) =>
    importsDe(a).some((imp) => dentroDe(imp, path.join('nucleo', 'aplicacion')))
  );
  assert.deepEqual(usuarios.map(rel), [path.join('infraestructura', 'configuracion', 'contenedor.ts')]);
});

test('Cada adaptador secundario implementa un puerto del núcleo', () => {
  for (const archivo of archivos(path.join(SRC, 'infraestructura', 'salida'))) {
    const codigo = fs.readFileSync(archivo, 'utf8');
    for (const [, clase, puertos] of codigo.matchAll(/export class (\w+)(?: implements ([\w, ]+))?/g)) {
      if (clase.startsWith('BaseDatos')) continue; // motores emulados, no adaptadores
      assert.ok(puertos, `${clase} (${rel(archivo)}) no implementa ningún puerto`);
    }
  }
});
