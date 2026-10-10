/** Guardado del Café Michi (clave sincronizada con la nube). */
import { CATS, EXPANSIONS, RECIPES, catSpeed, priceAt, recipeOf, stationSpeed, type DecorSlot, type HatId, type ItemId, type StationId } from './content'

export const SAVE_KEY = 'arcade-cafe-michi'
const OFFLINE_CAP = 6 * 3600

export interface StaffSave {
  id: string
  lvl: number
  job: StationId | 'mesero' | null
  hat: HatId | null
}
export interface CafeSave {
  v: 2
  coins: number
  hearts: number
  exp: number
  stations: Partial<Record<StationId, number>>
  recipes: Partial<Record<ItemId, number>>
  staff: StaffSave[]
  hats: HatId[]
  decor: string[]
  placed: Partial<Record<DecorSlot, string>>
  lastSeen: number
  served: number
}

export const freshSave = (): CafeSave => ({
  v: 2,
  coins: 40,
  hearts: 0,
  exp: 0,
  stations: { cafetera: 1 },
  recipes: { cafe: 1 },
  staff: [{ id: 'mochi', lvl: 1, job: 'cafetera', hat: null }],
  hats: [],
  decor: [],
  placed: {},
  lastSeen: Date.now(),
  served: 0,
})

export function loadSave(): CafeSave {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Partial<CafeSave> | null
    if (!raw || raw.v !== 2) return freshSave()
    const f = freshSave()
    const obj = (x: unknown) => (x && typeof x === 'object' ? x : {})
    return {
      v: 2,
      coins: typeof raw.coins === 'number' ? raw.coins : f.coins,
      hearts: typeof raw.hearts === 'number' ? raw.hearts : 0,
      exp: typeof raw.exp === 'number' ? Math.min(EXPANSIONS.length - 1, Math.max(0, raw.exp)) : 0,
      stations: { cafetera: 1, ...(obj(raw.stations) as CafeSave['stations']) },
      recipes: { cafe: 1, ...(obj(raw.recipes) as CafeSave['recipes']) },
      staff: Array.isArray(raw.staff) && raw.staff.length ? raw.staff.filter((s) => CATS.some((c) => c.id === s?.id)) : f.staff,
      hats: Array.isArray(raw.hats) ? raw.hats : [],
      decor: Array.isArray(raw.decor) ? raw.decor : [],
      placed: obj(raw.placed) as CafeSave['placed'],
      lastSeen: typeof raw.lastSeen === 'number' ? raw.lastSeen : Date.now(),
      served: typeof raw.served === 'number' ? raw.served : 0,
    }
  } catch {
    return freshSave()
  }
}

export function writeSave(s: CafeSave) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, lastSeen: Date.now() }))
  } catch {
    // sin almacenamiento
  }
}

/** Recetas que se pueden pedir: las desbloqueadas cuya estación ya está comprada. */
export function menu(s: CafeSave): ItemId[] {
  return RECIPES.filter((r) => s.recipes[r.id] && s.stations[r.station]).map((r) => r.id)
}

/** Monedas ganadas mientras no jugaban (estimación tranquila). */
export function offlineEarnings(s: CafeSave): { coins: number; secs: number } {
  const secs = Math.min(OFFLINE_CAP, (Date.now() - s.lastSeen) / 1000)
  if (secs < 90) return { coins: 0, secs: 0 }
  let rate = 0
  for (const st of s.staff) {
    if (!st.job || st.job === 'mesero') continue
    const lvl = s.stations[st.job]
    if (!lvl) continue
    const cat = CATS.find((c) => c.id === st.id)!
    const items = menu(s).filter((id) => recipeOf(id).station === st.job)
    if (!items.length) continue
    const best = Math.max(...items.map((id) => priceAt(recipeOf(id), s.recipes[id] ?? 1) / recipeOf(id).time))
    rate += best * stationSpeed(lvl) * catSpeed(cat, st.lvl)
  }
  const tables = EXPANSIONS[s.exp].tables
  rate = Math.min(rate, tables * 0.6)
  return { coins: Math.round(rate * secs * 0.15), secs }
}
