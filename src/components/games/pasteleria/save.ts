/** Guardado de la Pastelería (se sincroniza con la nube por la clave). */
import { START_OWNED, type DecorSlot } from './content'

export const SAVE_KEY = 'arcade-pasteleria-v1'

export interface Save {
  v: 3
  coins: number
  owned: string[]
  /** Estrellas por día (índice = día − 1). */
  stars: number[]
  /** Último día desbloqueado. */
  maxDay: number
  recipes: string[]
  /** Visitas que lleva cada personaje recurrente. */
  story: Record<string, number>
  decor: Partial<Record<DecorSlot, string>>
}

export const freshSave = (): Save => ({ v: 3, coins: 0, owned: [...START_OWNED], stars: [], maxDay: 1, recipes: [], story: {}, decor: {} })

export function loadSave(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Partial<Save> | null
    if (!raw || raw.v !== 3) return freshSave()
    const f = freshSave()
    return {
      v: 3,
      coins: typeof raw.coins === 'number' ? raw.coins : 0,
      owned: Array.isArray(raw.owned) ? Array.from(new Set([...START_OWNED, ...raw.owned.filter((x) => typeof x === 'string')])) : f.owned,
      stars: Array.isArray(raw.stars) ? raw.stars.map((n) => (typeof n === 'number' ? n : 0)) : [],
      maxDay: typeof raw.maxDay === 'number' && raw.maxDay >= 1 ? raw.maxDay : 1,
      recipes: Array.isArray(raw.recipes) ? raw.recipes.filter((x) => typeof x === 'string') : [],
      story: raw.story && typeof raw.story === 'object' ? raw.story : {},
      decor: raw.decor && typeof raw.decor === 'object' ? raw.decor : {},
    }
  } catch {
    return freshSave()
  }
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    // sin almacenamiento
  }
}
