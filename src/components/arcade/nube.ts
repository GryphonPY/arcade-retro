'use client'

import { useSyncExternalStore } from 'react'

/**
 * Progreso en la nube, versión simple. Un "código" compartido identifica la
 * partida: cada aparato sube su progreso a /api/save/:código y lo baja cuando
 * el de la nube es más reciente. Gana la última escritura (por fecha). Sin
 * cuentas ni contraseñas: el código es la llave. Si no hay red, el juego sigue
 * igual y se reintenta solo.
 */

/** Claves de localStorage que viajan en la partida. Agrega aquí las nuevas. */
export const CLAVES_NUBE: readonly string[] = [
  'nidito-partida-v1',
  'arcade-cafe-michi',
  'arcade-dulce-match',
  'arcade-pasteleria-v1',
]
/** Prefijos de claves dinámicas: récords locales por juego. */
const PREFIJOS_NUBE: readonly string[] = ['arcade-best-']

const CODIGO_KEY = 'arcade-nube-codigo'
const LOCAL_AT_KEY = 'arcade-nube-local-at'
const HASH_KEY = 'arcade-nube-hash'
const CARGADA_EVENT = 'arcade-nube-cargada'
const STORE_EVENT = 'arcade-store-change'

const INTERVALO_MS = 30_000
const TIMEOUT_MS = 8_000
const MAX_BYTES = 512 * 1024
const CODIGO_RE = /^[a-z0-9-]{4,32}$/

export type Partida = Record<string, string>

export type Resultado =
  | { kind: 'sin-codigo' }
  | { kind: 'codigo-invalido' }
  | { kind: 'sin-conexion' }
  | { kind: 'bajada' }
  | { kind: 'subida' }
  | { kind: 'al-dia' }
  | { kind: 'error' }

export interface EstadoNube {
  codigo: string | null
  ultimaSync: number | null
  ocupado: boolean
}

// ---------- almacenamiento y datos ----------

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}

function escribir(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor)
  } catch {
    // sin acceso a localStorage
  }
}

function borrar(clave: string) {
  try {
    window.localStorage.removeItem(clave)
  } catch {
    // sin acceso a localStorage
  }
}

export function esClaveNube(clave: string) {
  return CLAVES_NUBE.includes(clave) || PREFIJOS_NUBE.some((p) => clave.startsWith(p))
}

/** Lee del localStorage solo las claves que viajan en la nube. */
export function leerPartida(): Partida {
  const out: Partida = {}
  try {
    const ls = window.localStorage
    for (let i = 0; i < ls.length; i++) {
      const clave = ls.key(i)
      if (!clave || !esClaveNube(clave)) continue
      const valor = ls.getItem(clave)
      if (valor !== null) out[clave] = valor
    }
  } catch {
    // sin acceso a localStorage
  }
  return out
}

function aplicarPartida(partida: Partida) {
  for (const [clave, valor] of Object.entries(partida)) {
    if (esClaveNube(clave) && typeof valor === 'string' && leer(clave) !== valor) escribir(clave, valor)
  }
}

/** Huella barata (FNV-1a) de la partida, para detectar cambios locales. */
function huella(partida: Partida): string {
  const texto = JSON.stringify(Object.keys(partida).sort().map((k) => [k, partida[k]]))
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `${(h >>> 0).toString(16)}:${texto.length}`
}

/** Código normalizado (minúsculas, sin acentos, espacios a guiones) o null. */
export function normalizarCodigo(raw: string): string | null {
  const codigo = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return CODIGO_RE.test(codigo) ? codigo : null
}

// ---------- estado observable (para la interfaz) ----------

const SERVIDOR: EstadoNube = { codigo: null, ultimaSync: null, ocupado: false }
let instantanea: EstadoNube | null = null
let ultimaSync: number | null = null
let pendientes = 0
const oyentes = new Set<() => void>()

function emitir() {
  instantanea = null
  for (const l of oyentes) l()
}

function estado(): EstadoNube {
  if (!instantanea) {
    const codigo = leer(CODIGO_KEY)
    instantanea = { codigo: codigo && CODIGO_RE.test(codigo) ? codigo : null, ultimaSync, ocupado: pendientes > 0 }
  }
  return instantanea
}

function suscribir(cb: () => void) {
  oyentes.add(cb)
  return () => {
    oyentes.delete(cb)
  }
}

/** Código, última sincronización y si hay una sincronización en curso. */
export function useNube(): EstadoNube {
  return useSyncExternalStore(suscribir, estado, () => SERVIDOR)
}

// ---------- red ----------

type Remoto = { data: Partida; updatedAt: number } | null

/** null en `remoto` = la nube aún no tiene partida con este código. */
async function pedirRemoto(codigo: string): Promise<{ ok: true; remoto: Remoto } | { ok: false }> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`/api/save/${codigo}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: ctl.signal,
    })
    if (res.status === 404) return { ok: true, remoto: null }
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return { ok: false }
    const body = (await res.json()) as { data?: Partida; updatedAt?: number }
    if (!body.data || typeof body.data !== 'object' || typeof body.updatedAt !== 'number') return { ok: false }
    return { ok: true, remoto: { data: body.data, updatedAt: body.updatedAt } }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timer)
  }
}

type Subida = { ok: true; updatedAt: number } | { ok: false; kind: 'sin-conexion' | 'error' }

async function subirPartida(codigo: string, data: Partida, updatedAt: number): Promise<Subida> {
  const cuerpo = JSON.stringify({ data, updatedAt })
  if (new TextEncoder().encode(cuerpo).byteLength > MAX_BYTES) return { ok: false, kind: 'error' }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`/api/save/${codigo}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: cuerpo,
      signal: ctl.signal,
    })
    if (!res.ok) return { ok: false, kind: res.status >= 500 ? 'sin-conexion' : 'error' }
    const body = (await res.json()) as { updatedAt?: number }
    return { ok: true, updatedAt: typeof body.updatedAt === 'number' ? body.updatedAt : updatedAt }
  } catch {
    return { ok: false, kind: 'sin-conexion' }
  } finally {
    clearTimeout(timer)
  }
}

// ---------- sincronización ----------

/** Guarda la fecha y la huella de la partida que quedó sincronizada. */
function guardarBase(at: number, partida: Partida = leerPartida()) {
  escribir(LOCAL_AT_KEY, String(at))
  escribir(HASH_KEY, huella(partida))
}

/** Marca como nueva la fecha local si la partida cambió desde la última vez. */
function observarCambios(): number {
  const h = huella(leerPartida())
  let at = Number(leer(LOCAL_AT_KEY)) || 0
  if (at === 0 || leer(HASH_KEY) !== h) {
    at = Date.now()
    escribir(LOCAL_AT_KEY, String(at))
    escribir(HASH_KEY, h)
  }
  return at
}

function avisarCargada() {
  window.dispatchEvent(new Event(STORE_EVENT))
  window.dispatchEvent(new Event(CARGADA_EVENT))
}

async function sincronizarAhora(): Promise<Resultado> {
  const codigo = leer(CODIGO_KEY)
  if (!codigo || !CODIGO_RE.test(codigo)) return { kind: 'sin-codigo' }

  observarCambios()
  const pedido = await pedirRemoto(codigo)
  if (!pedido.ok) return { kind: 'sin-conexion' }
  const remoto = pedido.remoto
  const localAt = Number(leer(LOCAL_AT_KEY)) || 0

  if (remoto && remoto.updatedAt === localAt) {
    ultimaSync = Date.now()
    return { kind: 'al-dia' }
  }
  if (remoto && remoto.updatedAt > localAt) {
    aplicarPartida(remoto.data)
    guardarBase(remoto.updatedAt)
    ultimaSync = Date.now()
    avisarCargada()
    return { kind: 'bajada' }
  }

  // La nube no tiene partida o este aparato tiene cambios más recientes.
  const partida = leerPartida()
  const subida = await subirPartida(codigo, partida, localAt)
  if (!subida.ok) return { kind: subida.kind }
  if (subida.updatedAt > localAt) {
    // La nube tenía una fecha más nueva: la próxima vuelta la baja.
    return sincronizarAhora()
  }
  guardarBase(localAt, partida)
  ultimaSync = Date.now()
  return { kind: 'subida' }
}

/** Ejecuta las operaciones de una en una para no pisarse entre sí. */
let cola: Promise<unknown> = Promise.resolve()

function enCola<T>(fn: () => Promise<T>): Promise<T> {
  pendientes++
  emitir()
  const p = cola.then(fn)
  cola = p
    .then(
      () => undefined,
      () => undefined,
    )
    .finally(() => {
      pendientes--
      emitir()
    })
  return p
}

/** Sincronización en fila que aún no empezó (las repeticiones se funden en una). */
let sincronizacionEnFila: Promise<Resultado> | null = null

/** Sube o baja la partida según la fecha de cada lado. Nunca lanza error. */
export function sincronizar(): Promise<Resultado> {
  if (sincronizacionEnFila) return sincronizacionEnFila
  const p = enCola(() => {
    sincronizacionEnFila = null
    return sincronizarAhora().catch((): Resultado => ({ kind: 'error' }))
  })
  sincronizacionEnFila = p
  return p
}

/**
 * Conecta este aparato a un código. Si la nube ya tiene partida con ese código,
 * se baja (las claves de la nube reemplazan las locales); si no, se sube la local.
 */
export function vincular(raw: string): Promise<Resultado> {
  const codigo = normalizarCodigo(raw)
  if (!codigo) return Promise.resolve({ kind: 'codigo-invalido' })
  return enCola(async (): Promise<Resultado> => {
    escribir(CODIGO_KEY, codigo)
    emitir()
    try {
      const pedido = await pedirRemoto(codigo)
      if (!pedido.ok) return { kind: 'sin-conexion' }
      if (pedido.remoto) {
        aplicarPartida(pedido.remoto.data)
        guardarBase(pedido.remoto.updatedAt)
        ultimaSync = Date.now()
        avisarCargada()
        return { kind: 'bajada' }
      }
      const at = Date.now()
      const partida = leerPartida()
      const subida = await subirPartida(codigo, partida, at)
      if (!subida.ok) {
        // Queda marcada como cambio pendiente para la próxima sincronización.
        escribir(LOCAL_AT_KEY, String(at))
        return { kind: subida.kind }
      }
      guardarBase(at, partida)
      ultimaSync = Date.now()
      return { kind: 'subida' }
    } catch {
      return { kind: 'error' }
    }
  })
}

/** Desconecta este aparato. El progreso que ya tiene se queda aquí. */
export function olvidar(): Promise<void> {
  return enCola(async () => {
    borrar(CODIGO_KEY)
    borrar(LOCAL_AT_KEY)
    borrar(HASH_KEY)
    ultimaSync = null
    emitir()
  })
}

/**
 * Arranca la sincronización automática: al abrir, cada 30 s con la página
 * visible, al volver a la app, al quedar oculta y al recuperar la conexión.
 * Devuelve la función para detenerla.
 */
export function iniciarNube(): () => void {
  if (typeof window === 'undefined') return () => {}
  const hayCodigo = () => {
    const codigo = leer(CODIGO_KEY)
    return !!codigo && CODIGO_RE.test(codigo)
  }
  const tick = () => {
    if (document.visibilityState === 'visible' && hayCodigo()) void sincronizar()
  }
  const alOcultar = () => {
    if (document.visibilityState === 'hidden' && hayCodigo()) void sincronizar()
    else tick()
  }
  const alCambiarCodigo = (e: StorageEvent) => {
    if (e.key === null || e.key === CODIGO_KEY) emitir()
  }

  const timer = window.setInterval(tick, INTERVALO_MS)
  document.addEventListener('visibilitychange', alOcultar)
  window.addEventListener('pagehide', alOcultar)
  window.addEventListener('online', tick)
  window.addEventListener('storage', alCambiarCodigo)
  tick()
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', alOcultar)
    window.removeEventListener('pagehide', alOcultar)
    window.removeEventListener('online', tick)
    window.removeEventListener('storage', alCambiarCodigo)
  }
}
