// Genera la lista de precarga del service worker tras `next build`.
// - Recorre out/_next/static (todos los chunks, incluidos los de juegos
//   que aún no se han abierto) y añade los estáticos raíz y los .txt de RSC.
// - Calcula un hash del contenido: cada despliegue cambia el nombre de caché
//   y el service worker borra las cachés antiguas.
// - Escribe out/precache.json y reemplaza __PRECACHE_VERSION__ en out/sw.js.
// Sin dependencias: solo módulos integrados de Node.

import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../out/', import.meta.url))
const PLACEHOLDER = '__PRECACHE_VERSION__'

// Rutas raíz fijas que el juego necesita sin conexión.
const RAIZ_FIJAS = ['/', '/manifest.webmanifest', '/logo.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

// Devuelve todos los archivos de un directorio, de forma recursiva.
async function recorrer(dir) {
  const entradas = await readdir(dir, { withFileTypes: true })
  const archivos = []
  for (const e of entradas) {
    const ruta = join(dir, e.name)
    if (e.isDirectory()) archivos.push(...(await recorrer(ruta)))
    else if (e.isFile()) archivos.push(ruta)
  }
  return archivos
}

// Indica si un archivo existe dentro de out/.
async function existe(rutaRelativa) {
  try {
    return (await stat(join(OUT, rutaRelativa))).isFile()
  } catch {
    return false
  }
}

// Convierte una ruta URL ('/x/y') en la ruta del archivo dentro de out/.
const aArchivo = (url) => (url === '/' ? 'index.html' : url.slice(1))

async function main() {
  if (!(await existe('index.html'))) {
    throw new Error('precache: no existe out/index.html; ejecuta primero `next build`.')
  }

  const urls = new Set(RAIZ_FIJAS)

  // Chunks, media y demás archivos con hash de Next.
  const estaticos = await recorrer(join(OUT, '_next', 'static'))
  for (const abs of estaticos) {
    urls.add('/' + abs.slice(OUT.length).split('\\').join('/'))
  }

  // Archivos .txt de la raíz (payload RSC para navegación en cliente).
  const raiz = await readdir(OUT, { withFileTypes: true })
  for (const e of raiz) {
    if (e.isFile() && e.name.endsWith('.txt')) urls.add('/' + e.name)
  }

  // Iconos declarados en el manifiesto (p. ej. el maskable).
  try {
    const manifest = JSON.parse(await readFile(join(OUT, 'manifest.webmanifest'), 'utf8'))
    for (const icono of manifest.icons ?? []) {
      if (typeof icono.src === 'string' && icono.src.startsWith('/')) urls.add(icono.src)
    }
  } catch {
    // Sin manifiesto legible no se añaden iconos extra.
  }

  // Solo se incluyen rutas que existen en out/ para no provocar 404 en la precarga.
  const files = []
  for (const url of [...urls].sort()) {
    if (await existe(aArchivo(url))) files.push(url)
    else console.warn(`precache: se omite ${url} (no existe en out/)`)
  }

  // Hash del contenido de todos los archivos (estable entre builds idénticos).
  const hash = createHash('sha256')
  let bytes = 0
  for (const url of files) {
    const datos = await readFile(join(OUT, aArchivo(url)))
    bytes += datos.length
    hash.update(url + '\0')
    hash.update(datos)
    hash.update('\0')
  }
  const version = hash.digest('hex').slice(0, 10)

  await writeFile(join(OUT, 'precache.json'), JSON.stringify({ version, files }, null, 2) + '\n')

  // Versión dentro del service worker desplegado.
  const swPath = join(OUT, 'sw.js')
  const sw = await readFile(swPath, 'utf8')
  if (!sw.includes(PLACEHOLDER)) {
    throw new Error(`precache: no se encontró ${PLACEHOLDER} en out/sw.js`)
  }
  await writeFile(swPath, sw.split(PLACEHOLDER).join(version))

  console.log(`precache: ${files.length} archivos, ${(bytes / 1024).toFixed(1)} KB, versión ${version}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
