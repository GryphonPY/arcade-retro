// Service worker de Arcade Retro: permite jugar sin conexión.
// - Precarga: en la instalación descarga precache.json (generado en el build)
//   y guarda todos los archivos, incluidos los chunks de juegos aún no abiertos.
// - Páginas: primero la red (para recibir actualizaciones), con respaldo en caché.
// - Archivos con hash de Next (/_next/static): caché primero, nunca cambian.
// - Resto de estáticos: caché y actualización en segundo plano.
// - La API de récords nunca se guarda en caché.
// En `next dev` no se registra, así que el marcador se queda literal.
const VERSION = '__PRECACHE_VERSION__'
const PREFIJO = 'arcade-retro-'
const CACHE = PREFIJO + VERSION

// Lista mínima si precache.json no se puede descargar.
const MINIMO = ['/', '/manifest.webmanifest', '/logo.svg']
// Tamaño de lote para no saturar la red durante la instalación.
const LOTE = 12

// Descarga los archivos en lotes; un fallo individual no aborta la instalación.
async function precargar(cache, urls) {
  for (let i = 0; i < urls.length; i += LOTE) {
    await Promise.allSettled(urls.slice(i, i + LOTE).map((u) => cache.add(u)))
  }
}

// Guarda una respuesta correcta sin bloquear la respuesta al usuario.
function guardar(event, clave, res) {
  if (!res.ok) return
  const copia = res.clone()
  event.waitUntil(caches.open(CACHE).then((c) => c.put(clave, copia)).catch(() => {}))
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      let archivos = MINIMO
      try {
        const res = await fetch('/precache.json', { cache: 'no-store' })
        if (!res.ok) throw new Error('precache.json ' + res.status)
        const datos = await res.json()
        if (Array.isArray(datos.files) && datos.files.length) archivos = datos.files
      } catch {
        // Sin lista completa se usa el mínimo.
      }
      await precargar(cache, archivos)
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith(PREFIJO) && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

// Navegación: red primero; si falla, la página guardada de esa ruta o la home.
async function navegar(event, url) {
  try {
    const res = await fetch(event.request)
    guardar(event, url.pathname, res)
    return res
  } catch {
    return (
      (await caches.match(url.pathname, { ignoreSearch: true })) ||
      (await caches.match('/', { ignoreSearch: true })) ||
      Response.error()
    )
  }
}

// Chunks con hash: caché primero.
async function cacheFirst(event) {
  const hit = await caches.match(event.request, { ignoreSearch: true })
  if (hit) return hit
  const res = await fetch(event.request)
  guardar(event, event.request, res)
  return res
}

// Resto de estáticos: devuelve la caché y actualiza en segundo plano.
async function staleWhileRevalidate(event) {
  const hit = await caches.match(event.request, { ignoreSearch: true })
  const red = fetch(event.request)
    .then((res) => {
      guardar(event, event.request, res)
      return res
    })
    .catch(() => hit)
  event.waitUntil(red.catch(() => {}))
  return hit || red
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(navegar(event, url))
    return
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event))
    return
  }
  event.respondWith(staleWhileRevalidate(event))
})
