/**
 * Worker de Arcade Retro: sirve el sitio estático (./out) y una pequeña API de
 * récords en línea sobre D1.
 *
 * La base D1 (binding `DB`) la crea Wrangler automáticamente en el primer
 * deploy; las tablas se crean solas en la primera petición. Si la base no
 * existe, la API responde 503 y el sitio sigue funcionando sin tabla en línea.
 */
import { GAMES } from '../src/components/games/catalog'

// Tipos mínimos de Cloudflare (evita depender de @cloudflare/workers-types).
interface D1Result<T> {
  results: T[]
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T>(): Promise<T | null>
  all<T>(): Promise<D1Result<T>>
  run(): Promise<unknown>
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown>
}
interface Env {
  DB?: D1Database
  ASSETS: { fetch(request: Request): Promise<Response> }
}

const GAME_IDS = new Set(GAMES.map((g) => g.id))
const MAX_SCORE = 50_000_000
const NAME_MIN = 2
const NAME_MAX = 16
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 12

// Filtro básico de apodos ofensivos (comparación sin acentos ni símbolos).
const BLOCKED = ['puto', 'puta', 'pendej', 'verga', 'culero', 'mierda', 'nazi', 'hitler', 'fuck', 'shit', 'nigg', 'maricon', 'joto', 'pinche']

let ready: Promise<void> | null = null

function init(db: D1Database) {
  ready ??= db
    .batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS scores (
          game TEXT NOT NULL,
          name TEXT NOT NULL,
          name_key TEXT NOT NULL,
          score INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (game, name_key)
        )`,
      ),
      db.prepare('CREATE INDEX IF NOT EXISTS scores_rank ON scores (game, score DESC)'),
      db.prepare('CREATE TABLE IF NOT EXISTS submissions (ip TEXT NOT NULL, at INTEGER NOT NULL)'),
      db.prepare('CREATE INDEX IF NOT EXISTS submissions_ip ON submissions (ip, at)'),
    ])
    .then(() => undefined)
    .catch((err) => {
      ready = null
      throw err
    })
  return ready
}

function json(data: unknown, status = 200, cache = false) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache ? 'public, max-age=10' : 'no-store',
    },
  })
}

function foldKey(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, '')
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null
  const key = foldKey(name).replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/8/g, 'b')
  if (BLOCKED.some((w) => key.includes(w))) return null
  return name
}

async function hashIp(ip: string) {
  const data = new TextEncoder().encode('arcade-retro:' + ip)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function topScores(db: D1Database, game: string, limit: number) {
  const { results } = await db
    .prepare('SELECT name, score, updated_at AS at FROM scores WHERE game = ? ORDER BY score DESC, updated_at ASC LIMIT ?')
    .bind(game, limit)
    .all<{ name: string; score: number; at: number }>()
  return results
}

async function handleGet(db: D1Database, url: URL) {
  const game = url.searchParams.get('game')
  if (game) {
    if (!GAME_IDS.has(game)) return json({ error: 'juego-desconocido' }, 400)
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10))
    return json({ game, scores: await topScores(db, game, limit) }, 200, true)
  }
  // Resumen: el top 3 de cada juego (para la sala principal).
  const { results } = await db
    .prepare(
      `SELECT game, name, score FROM (
         SELECT game, name, score, ROW_NUMBER() OVER (PARTITION BY game ORDER BY score DESC, updated_at ASC) AS pos
         FROM scores
       ) WHERE pos <= 3 ORDER BY game, pos`,
    )
    .all<{ game: string; name: string; score: number }>()
  const byGame: Record<string, { name: string; score: number }[]> = {}
  for (const r of results) (byGame[r.game] ??= []).push({ name: r.name, score: r.score })
  return json({ top: byGame }, 200, true)
}

async function handlePost(db: D1Database, request: Request) {
  let body: { game?: unknown; name?: unknown; score?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'json-invalido' }, 400)
  }
  const game = typeof body.game === 'string' ? body.game : ''
  if (!GAME_IDS.has(game)) return json({ error: 'juego-desconocido' }, 400)
  const name = cleanName(body.name)
  if (!name) return json({ error: 'apodo-invalido' }, 400)
  const score = Number(body.score)
  if (!Number.isInteger(score) || score <= 0 || score > MAX_SCORE) return json({ error: 'puntuacion-invalida' }, 400)

  // Límite de envíos por IP (la IP se guarda solo como hash).
  const ip = await hashIp(request.headers.get('cf-connecting-ip') ?? 'local')
  const now = Date.now()
  const recent = await db
    .prepare('SELECT COUNT(*) AS n FROM submissions WHERE ip = ? AND at > ?')
    .bind(ip, now - RATE_WINDOW_MS)
    .first<{ n: number }>()
  if ((recent?.n ?? 0) >= RATE_MAX) return json({ error: 'demasiados-envios' }, 429)

  const nameKey = foldKey(name)
  await db.batch([
    db.prepare('INSERT INTO submissions (ip, at) VALUES (?, ?)').bind(ip, now),
    db.prepare('DELETE FROM submissions WHERE at < ?').bind(now - RATE_WINDOW_MS * 10),
    // Guarda solo la mejor puntuación de cada apodo por juego.
    db
      .prepare(
        `INSERT INTO scores (game, name, name_key, score, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (game, name_key) DO UPDATE SET
           score = excluded.score, name = excluded.name, updated_at = excluded.updated_at
         WHERE excluded.score > scores.score`,
      )
      .bind(game, name, nameKey, score, now),
  ])

  const best = await db
    .prepare('SELECT score FROM scores WHERE game = ? AND name_key = ?')
    .bind(game, nameKey)
    .first<{ score: number }>()
  const bestScore = best?.score ?? score
  const above = await db
    .prepare('SELECT COUNT(*) AS n FROM scores WHERE game = ? AND score > ?')
    .bind(game, bestScore)
    .first<{ n: number }>()
  return json({ name, best: bestScore, rank: (above?.n ?? 0) + 1, improved: bestScore === score })
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    if (url.pathname !== '/api/scores') return json({ error: 'no-encontrado' }, 404)
    if (!env.DB) return json({ error: 'sin-base' }, 503)
    try {
      await init(env.DB)
      if (request.method === 'GET') return await handleGet(env.DB, url)
      if (request.method === 'POST') return await handlePost(env.DB, request)
      return json({ error: 'metodo-no-permitido' }, 405)
    } catch (err) {
      console.error('api error', err)
      return json({ error: 'error-interno' }, 500)
    }
  },
}

export default worker
