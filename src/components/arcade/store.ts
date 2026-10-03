'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { loadMutePref, setMuted } from '@/components/games/sfx'
import { loadMusicPref, setMusicEnabled } from '@/components/games/music'
import { GAMES } from '@/components/games/catalog'

/**
 * Estado persistente de la sala (ajustes y récords) leído de localStorage a
 * través de useSyncExternalStore: el servidor renderiza los valores por
 * defecto y el cliente se sincroniza sin errores de hidratación.
 */

export interface Settings {
  sfx: boolean
  music: boolean
  crt: boolean
}

const DEFAULTS: Settings = { sfx: true, music: true, crt: true }
/** Evento que también emite saveBest() al guardar un récord nuevo. */
const CHANGE_EVENT = 'arcade-store-change'

let cached: Settings | null = null

function readCrt(): boolean {
  try {
    return window.localStorage.getItem('arcade-crt') !== '0'
  } catch {
    return true
  }
}

function readSettings(): Settings {
  if (!cached) cached = { sfx: !loadMutePref(), music: loadMusicPref(), crt: readCrt() }
  return cached
}

function emit() {
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(cb: () => void) {
  const onStorage = () => {
    cached = null
    cb()
  }
  window.addEventListener(CHANGE_EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, readSettings, () => DEFAULTS)
}

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...readSettings(), ...patch }
  if (patch.sfx !== undefined) setMuted(!patch.sfx)
  if (patch.music !== undefined) setMusicEnabled(patch.music)
  if (patch.crt !== undefined) {
    try {
      window.localStorage.setItem('arcade-crt', patch.crt ? '1' : '0')
    } catch {
      // sin acceso a localStorage
    }
  }
  cached = next
  emit()
}

function readBestsKey(): string {
  try {
    return GAMES.map((g) => window.localStorage.getItem(`arcade-best-${g.id}`) ?? '0').join(',')
  } catch {
    return ''
  }
}

/** Récords por juego, sincronizados con localStorage. */
export function useBests(): Record<string, number> {
  const key = useSyncExternalStore(subscribe, readBestsKey, () => '')
  return useMemo(() => {
    const values = key ? key.split(',') : []
    const map: Record<string, number> = {}
    GAMES.forEach((g, i) => {
      const n = parseInt(values[i] ?? '0', 10)
      map[g.id] = Number.isFinite(n) && n > 0 ? n : 0
    })
    return map
  }, [key])
}
