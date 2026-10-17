/**
 * API de récords, métricas y partida en la nube para el despliegue propio
 * (contenedor). Réplica del Worker de Cloudflare (worker/index.ts) pero con
 * almacenamiento en un archivo JSON local, sin dependencias.
 *
 * Endpoints:
 *   GET    /api/scores            → top 3 de cada juego
 *   GET    /api/scores?game=&limit= → tabla de un juego
 *   POST   /api/scores            → guarda récord y devuelve posición
 *   GET    /api/plays?days=N      → totales por juego y por día
 *   POST   /api/plays             → registra una sesión
 *   GET    /api/save/:codigo      → progreso guardado
 *   PUT    /api/save/:codigo      → guarda progreso
 *
 * Datos en DATA_DIR (por defecto ./data), archivo data.json.
 */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const MAX_SCORE = 50_000_000
const NAME_MIN = 2
const NAME_MAX = 16
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 12
const SAVE_CODE = /^[a-z0-9-]{4,32}$/
const SAVE_MAX_BYTES = 512 * 1024
const SAVE_MAX_KEYS = 64
const SAVE_MAX_KEY_LEN = 64
const PLAYS_MAX_BYTES = 1024
const PLAYS_MAX_ROUNDS = 300
const PLAYS_MAX_SECONDS = 14_400
const PLAYS_MIN_SECONDS = 3
const DAY_MS = 86_400_000

const BLOCKED = ['puto', 'puta', 'pendej', 'verga', 'culero', 'mierda', 'nazi', 'hitler', 'fuck', 'shit', 'nigg', 'maricon', 'joto', 'pinche']

export const DATA_DIR = process.env.DATA_DIR || new URL('../data/', import.meta.url).pathname
const DATA_FILE = join(DATA_DIR, 'data.json')

/** { scores: {'game|clave': {...}}, submissions: [], saves: {}, plays: {'día|game': {...}} } */
let db = { scores: {}, submissions: [], saves: {}, plays: {} }
let dirty = false
let writing = null

export async function loadDb() {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    db = { scores: {}, submissions: [], saves: {}, plays: {}, ...parsed }
    // Limpieza única del récord de prueba usado para validar la persistencia.
    for (const [k, v] of Object.entries(db.scores)) {
      if (v.name === 'PERSIST' && v.score === 4242) delete db.scores[k]
    }
  } catch {
    db = { scores: {}, submissions: [], saves: {}, plays: {} }
  }
  await mkdir(DATA_DIR, { recursive: true }).catch(() => {})
}

async function flush() {
  if (writing) return writing
  if (!dirty) return
  dirty = false
  writing = (async () => {
    try {
      await mkdir(DATA_DIR, { recursive: true })
      const tmp = `${DATA_FILE}.tmp`
      await writeFile(tmp, JSON.stringify(db))
      await rename(tmp, DATA_FILE)
    } catch (err) {
      console.error('no se pudo guardar la base:', err)
    } finally {
      writing = null
    }
  })()
  return writing
}

function touch() {
  dirty = true
  setTimeout(() => { void flush() }, 800).unref?.()
}

// Flush al apagar el contenedor (Coolify manda SIGTERM).
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { void flush().finally(() => process.exit(0)) })
}

function send(res, status, data, cacheSeconds = 0) {
  const body = data === null ? '' : JSON.stringify(data)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
  })
  res.end(body)
}

async function readBody(req, maxBytes) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function foldKey(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, '')
}

function cleanName(raw) {
  if (typeof raw !== 'string') return null
  const name = raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null
  const key = foldKey(name).replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b')
  if (BLOCKED.some((w) => key.includes(w))) return null
  return name
}

function hashIp(ip) {
  return createHash('sha256').update('arcade-retro:' + ip).digest('hex').slice(0, 24)
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim()
  return req.socket?.remoteAddress || 'local'
}

function cleanSaveData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const entries = Object.entries(raw)
  if (entries.length > SAVE_MAX_KEYS) return null
  for (const [key, value] of entries) {
    if (key.length > SAVE_MAX_KEY_LEN || typeof value !== 'string') return null
  }
  return Object.fromEntries(entries)
}

function clampInt(raw, max) {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(max, n)
}

const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10)

function topScores(game, limit) {
  return Object.values(db.scores)
    .filter((s) => s.game === game)
    .sort((a, b) => b.score - a.score || a.updatedAt - b.updatedAt)
    .slice(0, limit)
    .map((s) => ({ name: s.name, score: s.score, at: s.updatedAt }))
}

export function makeApi({ gameIds, gameNames }) {
  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const { pathname } = url

    const saveMatch = /^\/api\/save\/([^/]+)$/.exec(pathname)
    const isPlays = pathname === '/api/plays'
    if (pathname !== '/api/scores' && !saveMatch && !isPlays) {
      return send(res, 404, { error: 'no-encontrado' })
    }

    try {
      // Partida en la nube
      if (saveMatch) {
        const code = decodeURIComponent(saveMatch[1])
        if (!SAVE_CODE.test(code)) return send(res, 400, { error: 'codigo-invalido' })

        if (req.method === 'GET') {
          const row = db.saves[code]
          if (!row) return send(res, 404, { error: 'no-encontrado' })
          return send(res, 200, { data: row.data, updatedAt: row.updatedAt })
        }

        if (req.method === 'PUT') {
          const text = await readBody(req, SAVE_MAX_BYTES)
          if (text === null) return send(res, 413, { error: 'demasiado-grande' })
          let body
          try {
            body = JSON.parse(text)
          } catch {
            return send(res, 400, { error: 'json-invalido' })
          }
          const data = cleanSaveData(body.data)
          if (!data) return send(res, 400, { error: 'datos-invalidos' })
          const updatedAt = body.updatedAt
          if (typeof updatedAt !== 'number' || !Number.isSafeInteger(updatedAt) || updatedAt < 0) {
            return send(res, 400, { error: 'fecha-invalida' })
          }
          const prev = db.saves[code]
          if (!prev || updatedAt >= prev.updatedAt) {
            db.saves[code] = { data, updatedAt }
            touch()
            return send(res, 200, { updatedAt })
          }
          return send(res, 200, { updatedAt: prev.updatedAt })
        }
        return send(res, 405, { error: 'metodo-no-permitido' })
      }

      // Métricas anónimas
      if (isPlays) {
        if (req.method === 'POST') {
          const text = await readBody(req, PLAYS_MAX_BYTES)
          if (text === null) return send(res, 413, { error: 'demasiado-grande' })
          let body
          try {
            body = JSON.parse(text)
          } catch {
            return send(res, 400, { error: 'json-invalido' })
          }
          const game = typeof body.game === 'string' ? body.game : ''
          if (!gameIds.has(game)) return send(res, 400, { error: 'juego-desconocido' })
          const rounds = clampInt(body.rounds, PLAYS_MAX_ROUNDS)
          const seconds = clampInt(body.seconds, PLAYS_MAX_SECONDS)
          if (seconds < PLAYS_MIN_SECONDS && rounds === 0) {
            res.writeHead(204).end()
            return
          }
          const key = `${utcDay(Date.now())}|${game}`
          const row = db.plays[key] || { sessions: 0, rounds: 0, seconds: 0 }
          row.sessions += 1
          row.rounds += rounds
          row.seconds += seconds
          db.plays[key] = row
          touch()
          res.writeHead(204).end()
          return
        }

        if (req.method === 'GET') {
          const days = Math.min(90, Math.max(1, Math.trunc(Number(url.searchParams.get('days'))) || 30))
          const since = utcDay(Date.now() - (days - 1) * DAY_MS)
          const byGame = new Map()
          const byDay = new Map()
          for (const [key, row] of Object.entries(db.plays)) {
            const [day, game] = key.split('|')
            if (day < since) continue
            const g = byGame.get(game) || { game, sessions: 0, rounds: 0, seconds: 0 }
            g.sessions += row.sessions; g.rounds += row.rounds; g.seconds += row.seconds
            byGame.set(game, g)
            const d = byDay.get(day) || { day, sessions: 0, rounds: 0, seconds: 0 }
            d.sessions += row.sessions; d.rounds += row.rounds; d.seconds += row.seconds
            byDay.set(day, d)
          }
          const games = [...byGame.values()]
            .map((g) => ({ ...g, name: gameNames.get(g.game) || g.game }))
            .sort((a, b) => b.rounds - a.rounds || b.seconds - a.seconds)
          const daily = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
          return send(res, 200, { days, games, daily }, 600)
        }
        return send(res, 405, { error: 'metodo-no-permitido' })
      }

      // Récords
      if (req.method === 'GET') {
        const game = url.searchParams.get('game')
        if (game) {
          if (!gameIds.has(game)) return send(res, 400, { error: 'juego-desconocido' })
          const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10))
          return send(res, 200, { game, scores: topScores(game, limit) }, 10)
        }
        const top = {}
        for (const g of gameIds) {
          const rows = topScores(g, 3)
          if (rows.length) top[g] = rows.map((r) => ({ name: r.name, score: r.score }))
        }
        return send(res, 200, { top }, 10)
      }

      if (req.method === 'POST') {
        const text = await readBody(req, 4096)
        if (text === null) return send(res, 413, { error: 'demasiado-grande' })
        let body
        try {
          body = JSON.parse(text)
        } catch {
          return send(res, 400, { error: 'json-invalido' })
        }
        const game = typeof body.game === 'string' ? body.game : ''
        if (!gameIds.has(game)) return send(res, 400, { error: 'juego-desconocido' })
        const name = cleanName(body.name)
        if (!name) return send(res, 400, { error: 'apodo-invalido' })
        const score = Number(body.score)
        if (!Number.isInteger(score) || score <= 0 || score > MAX_SCORE) {
          return send(res, 400, { error: 'puntuacion-invalida' })
        }

        const now = Date.now()
        const ip = hashIp(clientIp(req))
        db.submissions = db.submissions.filter((s) => s.at > now - RATE_WINDOW_MS * 10)
        const recent = db.submissions.filter((s) => s.ip === ip && s.at > now - RATE_WINDOW_MS).length
        if (recent >= RATE_MAX) return send(res, 429, { error: 'demasiados-envios' })
        db.submissions.push({ ip, at: now })

        const nameKey = foldKey(name)
        const key = `${game}|${nameKey}`
        const prev = db.scores[key]
        const improved = !prev || score > prev.score
        if (improved) {
          db.scores[key] = { game, name, nameKey, score, updatedAt: now }
        }
        touch()

        const best = db.scores[key]?.score ?? score
        const above = Object.values(db.scores).filter((s) => s.game === game && s.score > best).length
        return send(res, 200, { name, best, rank: above + 1, improved })
      }

      return send(res, 405, { error: 'metodo-no-permitido' })
    } catch (err) {
      console.error('api error', err)
      return send(res, 500, { error: 'error-interno' })
    }
  }

  return { handle }
}
