/** Mejoras de la partida: se elige 1 de 3 al terminar cada sector. */

export type UpId =
  | 'core'
  | 'drone'
  | 'bombs'
  | 'shield'
  | 'magnet'
  | 'missiles'
  | 'speed'
  | 'rear'
  | 'chain'
  | 'graze'
  | 'overdrive'
  | 'pierce'
  | 'autobomb'
  | 'life'
  | 'nova'
  | 'fury'

export type Rarity = 0 | 1 | 2

export interface UpgradeDef {
  id: UpId
  name: string
  /** Etiqueta corta para el HUD (fuente pixel, sin acentos). */
  tag: string
  desc: string
  max: number
  rarity: Rarity
  /** Sector mínimo (0 = tras el primero). */
  minSector: number
  /** Ofensiva: se garantiza al menos una en cada tirada. */
  offense: boolean
  color: string
}

export const RARITY_NAME = ['COMUN', 'RARA', 'EPICA'] as const
export const RARITY_COLOR = ['#22d3ee', '#c084fc', '#fbbf24'] as const

export const UPGRADES: UpgradeDef[] = [
  { id: 'core', name: 'Núcleo de arma', tag: 'ARM', desc: '+1 nivel de arma y +1 al nivel máximo. Más cañones en tu nave.', max: 4, rarity: 0, minSector: 0, offense: true, color: '#22d3ee' },
  { id: 'drone', name: 'Dron de apoyo', tag: 'DRN', desc: 'Un dron orbita tu nave y dispara contigo. En modo concentrado se alinea.', max: 4, rarity: 0, minSector: 0, offense: true, color: '#e0f2fe' },
  { id: 'missiles', name: 'Lanzamisiles', tag: 'MIS', desc: 'Misiles teledirigidos automáticos. Cada nivel añade uno más por salva.', max: 3, rarity: 0, minSector: 0, offense: true, color: '#fb923c' },
  { id: 'rear', name: 'Cañón trasero', tag: 'TRS', desc: 'Dispara hacia atrás en diagonal. Ideal contra los que te flanquean.', max: 2, rarity: 0, minSector: 0, offense: true, color: '#38bdf8' },
  { id: 'bombs', name: 'Arsenal', tag: 'BMB', desc: '+1 bomba máxima y recarga todas tus bombas.', max: 3, rarity: 0, minSector: 0, offense: false, color: '#f472b6' },
  { id: 'shield', name: 'Escudo de plasma', tag: 'ESC', desc: 'Absorbe un impacto. Se recarga al empezar cada sector.', max: 2, rarity: 0, minSector: 0, offense: false, color: '#60a5fa' },
  { id: 'magnet', name: 'Imán', tag: 'IMN', desc: 'Atrae medallas y potenciadores desde lejos. Nivel 2: desde toda la pantalla.', max: 2, rarity: 0, minSector: 0, offense: false, color: '#fde047' },
  { id: 'speed', name: 'Propulsores', tag: 'VEL', desc: '+14% de velocidad y una estela de plasma.', max: 2, rarity: 0, minSector: 0, offense: false, color: '#34d399' },
  { id: 'chain', name: 'Cadena larga', tag: 'CAD', desc: 'Tu cadena de bajas tarda un 40% más en romperse.', max: 2, rarity: 0, minSector: 0, offense: false, color: '#fbbf24' },
  { id: 'graze', name: 'Campo de roce', tag: 'ROC', desc: 'Radio de roce mayor. Cada 60 roces recargan una bomba.', max: 1, rarity: 1, minSector: 0, offense: false, color: '#a5f3fc' },
  { id: 'overdrive', name: 'Sobrecarga', tag: 'SBC', desc: '+20% de cadencia en todas tus armas.', max: 2, rarity: 1, minSector: 1, offense: true, color: '#f87171' },
  { id: 'pierce', name: 'Munición de plasma', tag: 'PLS', desc: '+15% de daño y tus disparos atraviesan enemigos débiles.', max: 1, rarity: 1, minSector: 1, offense: true, color: '#e879f9' },
  { id: 'life', name: 'Casco reforzado', tag: 'VID', desc: '+1 vida. Una segunda oportunidad nunca sobra.', max: 3, rarity: 2, minSector: 1, offense: false, color: '#4ade80' },
  { id: 'autobomb', name: 'Bomba de emergencia', tag: 'EMG', desc: 'Si te golpean y tienes bombas, se lanza una sola y te salva.', max: 1, rarity: 2, minSector: 2, offense: false, color: '#fca5a5' },
  { id: 'nova', name: 'Bomba nova', tag: 'NOV', desc: 'Tus bombas duran el doble y hacen el triple de daño.', max: 1, rarity: 2, minSector: 2, offense: true, color: '#fdba74' },
  { id: 'fury', name: 'Furia dorada', tag: 'FUR', desc: 'Con cadena x8 o más tus disparos se vuelven dorados: +30% de daño.', max: 1, rarity: 2, minSector: 2, offense: true, color: '#fde047' },
]

export const UP_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpId, UpgradeDef>

/**
 * Elige 3 mejoras distintas disponibles. Las raras y épicas son más
 * probables en sectores avanzados.
 */
export function rollUpgrades(sectorsCleared: number, have: Record<string, number>, power: number, powerCap: number): UpgradeDef[] {
  const s = sectorsCleared
  const avail = UPGRADES.filter((u) => (have[u.id] ?? 0) < u.max && s >= u.minSector && !(u.id === 'core' && powerCap >= 8 && power >= 8))
  const weight = (u: UpgradeDef) => (u.rarity === 0 ? 10 : u.rarity === 1 ? 2.5 + s * 1.6 : 0.6 + s * 1.1)
  const out: UpgradeDef[] = []
  const pool = [...avail]
  while (out.length < 3 && pool.length) {
    let total = 0
    for (const u of pool) total += weight(u)
    let r = Math.random() * total
    let idx = 0
    for (let i = 0; i < pool.length; i++) {
      r -= weight(pool[i])
      if (r <= 0) {
        idx = i
        break
      }
    }
    out.push(pool.splice(idx, 1)[0])
  }
  // Garantiza al menos una opción ofensiva
  if (!out.some((u) => u.offense)) {
    const off = pool.filter((u) => u.offense)
    if (off.length) out[2] = off[(Math.random() * off.length) | 0]
  }
  return out
}
