// Servidor estático mínimo para el build `out/` (Next con output: 'export').
// Sirve para correr el sitio en un contenedor (Coolify) sin dependencias extra.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('../out/', import.meta.url).pathname
const PORT = Number(process.env.PORT || 3000)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
}

async function resolveFile(pathname) {
  const clean = normalize(decodeURIComponent(pathname.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  let target = join(ROOT, clean)
  try {
    const info = await stat(target)
    if (info.isDirectory()) target = join(target, 'index.html')
    const file = await stat(target)
    if (file.isFile()) return target
  } catch {}
  // Ruta con extensión inexistente -> 404.html; ruta sin extensión -> index.html de la carpeta
  if (!extname(clean)) {
    for (const candidate of [join(ROOT, clean, 'index.html'), join(ROOT, `${clean}.html`)]) {
      try {
        if ((await stat(candidate)).isFile()) return candidate
      } catch {}
    }
  }
  return null
}

const server = createServer(async (req, res) => {
  try {
    const file = await resolveFile(req.url || '/')
    if (!file) {
      const fallback = join(ROOT, '404.html')
      const body = await readFile(fallback).catch(() => Buffer.from('404'))
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(body)
    }
    const body = await readFile(file)
    const ext = extname(file)
    const immutable = file.includes('/_next/static/')
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    })
    res.end(body)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Error interno')
  }
})

server.listen(PORT, () => console.log(`Sirviendo out/ en http://0.0.0.0:${PORT}`))
