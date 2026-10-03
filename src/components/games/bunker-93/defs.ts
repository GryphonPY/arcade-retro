/** Definiciones de armas, enemigos, mejoras y estado del jugador. */

export type WeaponId = 'pistol' | 'shotgun' | 'chaingun' | 'rocket' | 'plasma'
export type AmmoId = 'bullets' | 'shells' | 'rockets' | 'cells'
export type EnemyKind = 'mutant' | 'soldier' | 'spitter' | 'tank' | 'swarm' | 'boss1' | 'boss2' | 'boss3'

export interface WeaponDef {
  id: WeaponId
  slot: number
  name: string
  label: string
  ammo: AmmoId | null
  rate: number
  dmg: number
  pellets: number
  spread: number
  projectile: boolean
  speed: number
  splash: number
  splashR: number
  knock: number
  shake: number
  kick: number
}

export const WEAPONS: WeaponDef[] = [
  { id: 'pistol', slot: 1, name: 'Pistola', label: 'PISTOLA', ammo: null, rate: 0.3, dmg: 20, pellets: 1, spread: 0.012, projectile: false, speed: 0, splash: 0, splashR: 0, knock: 0.6, shake: 0.08, kick: 6 },
  { id: 'shotgun', slot: 2, name: 'Escopeta', label: 'ESCOPETA', ammo: 'shells', rate: 0.82, dmg: 12, pellets: 8, spread: 0.085, projectile: false, speed: 0, splash: 0, splashR: 0, knock: 1.2, shake: 0.32, kick: 22 },
  { id: 'chaingun', slot: 3, name: 'Ametralladora', label: 'AMETRALLADORA', ammo: 'bullets', rate: 0.085, dmg: 14, pellets: 1, spread: 0.035, projectile: false, speed: 0, splash: 0, splashR: 0, knock: 0.35, shake: 0.07, kick: 5 },
  { id: 'rocket', slot: 4, name: 'Lanzacohetes', label: 'LANZACOHETES', ammo: 'rockets', rate: 0.85, dmg: 70, pellets: 1, spread: 0, projectile: true, speed: 17, splash: 120, splashR: 2.8, knock: 3, shake: 0.2, kick: 16 },
  { id: 'plasma', slot: 5, name: 'Rifle de plasma', label: 'PLASMA', ammo: 'cells', rate: 0.085, dmg: 24, pellets: 1, spread: 0.01, projectile: true, speed: 30, splash: 0, splashR: 0, knock: 0.4, shake: 0.06, kick: 4 },
]

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w])) as Record<WeaponId, WeaponDef>

export const AMMO_BASE: Record<AmmoId, number> = { bullets: 200, shells: 50, rockets: 30, cells: 300 }
export const AMMO_PICK: Record<AmmoId, number> = { bullets: 40, shells: 8, rockets: 4, cells: 60 }

export interface EnemyDef {
  kind: EnemyKind
  name: string
  hp: number
  speed: number
  radius: number
  height: number
  dmg: number
  score: number
  pain: number
  mass: number
  boss?: boolean
  fly?: number
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  mutant: { kind: 'mutant', name: 'Rabioso', hp: 45, speed: 3.7, radius: 0.32, height: 1.05, dmg: 9, score: 100, pain: 0.75, mass: 1 },
  soldier: { kind: 'soldier', name: 'Infectado', hp: 55, speed: 2.7, radius: 0.3, height: 1.18, dmg: 7, score: 150, pain: 0.6, mass: 1 },
  spitter: { kind: 'spitter', name: 'Escupidor', hp: 85, speed: 1.9, radius: 0.42, height: 1.05, dmg: 14, score: 200, pain: 0.45, mass: 1.6 },
  tank: { kind: 'tank', name: 'Acorazado', hp: 360, speed: 1.4, radius: 0.55, height: 1.7, dmg: 24, score: 500, pain: 0.15, mass: 5 },
  swarm: { kind: 'swarm', name: 'Larva', hp: 10, speed: 4.6, radius: 0.18, height: 0.36, dmg: 4, score: 25, pain: 1, mass: 0.3 },
  boss1: { kind: 'boss1', name: 'COLOSO', hp: 3200, speed: 2.1, radius: 1.05, height: 3.0, dmg: 30, score: 5000, pain: 0.04, mass: 50, boss: true },
  boss2: { kind: 'boss2', name: 'CENTINELA', hp: 4400, speed: 1.8, radius: 1.05, height: 2.6, dmg: 26, score: 8000, pain: 0.04, mass: 60, boss: true },
  boss3: { kind: 'boss3', name: 'NUCLEO', hp: 5600, speed: 0, radius: 1.6, height: 2.5, dmg: 20, score: 12000, pain: 0.03, mass: 999, boss: true, fly: 0.8 },
}

// ---------------------------------------------------------------------------
// Estadísticas del jugador modificables por mejoras
// ---------------------------------------------------------------------------

export interface Stats {
  dmg: Record<WeaponId, number>
  allDmg: number
  rate: number
  ammoMax: number
  speed: number
  lifesteal: number
  doubleBarrel: boolean
  extraPellets: number
  crit: number
  pierce: number
  regen: number
  magnet: boolean
  split: number
  bounce: number
  killBlast: number
  frenzy: boolean
  shock: boolean
  saver: number
  armorOnKill: number
  revive: number
  berserk: boolean
  chain: number
  infiniteBullets: boolean
}

export function baseStats(): Stats {
  return {
    dmg: { pistol: 1, shotgun: 1, chaingun: 1, rocket: 1, plasma: 1 },
    allDmg: 1,
    rate: 1,
    ammoMax: 1,
    speed: 1,
    lifesteal: 0,
    doubleBarrel: false,
    extraPellets: 0,
    crit: 0,
    pierce: 0,
    regen: 0,
    magnet: false,
    split: 0,
    bounce: 0,
    killBlast: 0,
    frenzy: false,
    shock: false,
    saver: 0,
    armorOnKill: 0,
    revive: 0,
    berserk: false,
    chain: 0,
    infiniteBullets: false,
  }
}

export interface PlayerState {
  hp: number
  maxHp: number
  armor: number
  maxArmor: number
  ammo: Record<AmmoId, number>
  owned: Record<WeaponId, boolean>
}

export interface UpgradeCtx {
  s: Stats
  p: PlayerState
}

export const RARITY = [
  { name: 'Común', color: '#a1a1aa' },
  { name: 'Raro', color: '#3b82f6' },
  { name: 'Épico', color: '#a855f7' },
  { name: 'Legendario', color: '#f59e0b' },
] as const

export interface Upgrade {
  id: string
  name: string
  desc: string
  rarity: 0 | 1 | 2 | 3
  /** Glifo corto para el icono (fuente pixel, sin acentos). */
  icon: string
  max: number
  minWave?: number
  req?: (c: UpgradeCtx) => boolean
  apply: (c: UpgradeCtx) => void
}

const has = (w: WeaponId) => (c: UpgradeCtx) => c.p.owned[w]

export const UPGRADES: Upgrade[] = [
  // ---- comunes ----
  { id: 'dmg_pistol', name: 'Pistola afinada', desc: '+40% de daño con la pistola.', rarity: 0, icon: 'P+', max: 3, apply: ({ s }) => void (s.dmg.pistol += 0.4) },
  { id: 'dmg_shotgun', name: 'Perdigones pesados', desc: '+25% de daño con la escopeta.', rarity: 0, icon: 'E+', max: 4, apply: ({ s }) => void (s.dmg.shotgun += 0.25) },
  { id: 'dmg_chaingun', name: 'Punta hueca', desc: '+25% de daño con la ametralladora.', rarity: 0, icon: 'A+', max: 4, req: has('chaingun'), apply: ({ s }) => void (s.dmg.chaingun += 0.25) },
  { id: 'dmg_rocket', name: 'Ojivas mejoradas', desc: '+25% de daño y radio con los cohetes.', rarity: 0, icon: 'C+', max: 3, req: has('rocket'), apply: ({ s }) => void (s.dmg.rocket += 0.25) },
  { id: 'dmg_plasma', name: 'Condensador', desc: '+25% de daño con el plasma.', rarity: 0, icon: 'Z+', max: 3, req: has('plasma'), apply: ({ s }) => void (s.dmg.plasma += 0.25) },
  {
    id: 'ammo', name: 'Mochila táctica', desc: '+40% de munición máxima y recarga total.', rarity: 0, icon: 'MU', max: 3,
    apply: ({ s, p }) => {
      s.ammoMax += 0.4
      for (const k of Object.keys(p.ammo) as AmmoId[]) p.ammo[k] = Math.round(AMMO_BASE[k] * s.ammoMax)
    },
  },
  { id: 'rate', name: 'Gatillo ligero', desc: '+12% de cadencia con todas las armas.', rarity: 0, icon: '>>', max: 4, apply: ({ s }) => void (s.rate += 0.12) },
  {
    id: 'hp', name: 'Sangre de hierro', desc: '+20 de vida máxima y te cura 20.', rarity: 0, icon: '+V', max: 5,
    apply: ({ p }) => {
      p.maxHp += 20
      p.hp = Math.min(p.maxHp, p.hp + 20)
    },
  },
  {
    id: 'armor', name: 'Placas de kevlar', desc: '+25 de armadura máxima y +50 de armadura.', rarity: 0, icon: 'AR', max: 5,
    apply: ({ p }) => {
      p.maxArmor += 25
      p.armor = Math.min(p.maxArmor, p.armor + 50)
    },
  },
  { id: 'speed', name: 'Botas ligeras', desc: '+8% de velocidad de movimiento.', rarity: 0, icon: 'VE', max: 3, apply: ({ s }) => void (s.speed += 0.08) },
  // ---- raras ----
  { id: 'lifesteal', name: 'Robo de vida', desc: 'El 3% del daño que haces te cura.', rarity: 1, icon: 'RV', max: 3, apply: ({ s }) => void (s.lifesteal += 0.03) },
  { id: 'double', name: 'Doble cañón', desc: 'Disparo alterno de escopeta: ambos cañones a la vez (clic derecho o botón 2X).', rarity: 1, icon: '2X', max: 1, apply: ({ s }) => void (s.doubleBarrel = true) },
  { id: 'pellets', name: 'Cartuchos de dispersión', desc: '+3 perdigones por disparo de escopeta.', rarity: 1, icon: '::', max: 2, apply: ({ s }) => void (s.extraPellets += 3) },
  { id: 'crit', name: 'Ojo de halcón', desc: '12% de probabilidad de crítico (daño x2.5).', rarity: 1, icon: 'CR', max: 3, apply: ({ s }) => void (s.crit += 0.12) },
  { id: 'pierce', name: 'Balas perforantes', desc: 'Pistola y ametralladora atraviesan a un enemigo más.', rarity: 1, icon: '->', max: 2, apply: ({ s }) => void (s.pierce += 1) },
  { id: 'regen', name: 'Nanobots', desc: 'Regeneras 2 de vida por segundo si no te dañan en 3 s.', rarity: 1, icon: 'NB', max: 2, apply: ({ s }) => void (s.regen += 2) },
  { id: 'magnet', name: 'Imán de chatarra', desc: 'Los objetos vuelan hacia ti y los enemigos sueltan más.', rarity: 1, icon: 'IM', max: 1, apply: ({ s }) => void (s.magnet = true) },
  { id: 'split', name: 'Cohetes de racimo', desc: 'Cada cohete se divide en 4 minibombas al estallar.', rarity: 1, icon: 'RC', max: 2, req: has('rocket'), apply: ({ s }) => void (s.split += 4) },
  { id: 'bounce', name: 'Plasma rebotador', desc: 'Los disparos de plasma rebotan en los muros.', rarity: 1, icon: 'RB', max: 2, req: has('plasma'), apply: ({ s }) => void (s.bounce += 1) },
  // ---- épicas ----
  { id: 'killblast', name: 'Cadáveres volátiles', desc: '20% de probabilidad de que los enemigos exploten al morir.', rarity: 2, icon: 'KB', max: 3, minWave: 3, apply: ({ s }) => void (s.killBlast += 0.2) },
  { id: 'frenzy', name: 'Frenesí', desc: 'Cada baja te da +40% de cadencia durante 3 s.', rarity: 2, icon: 'FR', max: 1, minWave: 3, apply: ({ s }) => void (s.frenzy = true) },
  { id: 'shock', name: 'Escudo reactivo', desc: 'Con poca vida liberas una onda que arrasa a quien te rodea.', rarity: 2, icon: 'ER', max: 1, minWave: 4, apply: ({ s }) => void (s.shock = true) },
  { id: 'saver', name: 'Cinta infinita', desc: '33% de probabilidad de no gastar munición.', rarity: 2, icon: 'CI', max: 2, minWave: 4, apply: ({ s }) => void (s.saver += 0.33) },
  { id: 'armorkill', name: 'Blindaje vivo', desc: 'Cada baja te da 3 de armadura.', rarity: 2, icon: 'BV', max: 2, minWave: 4, apply: ({ s }) => void (s.armorOnKill += 3) },
  // ---- legendarias (solo jefes) ----
  { id: 'leg_fury', name: 'Furia del Búnker', desc: '+50% de daño con TODAS las armas.', rarity: 3, icon: 'FB', max: 1, apply: ({ s }) => void (s.allDmg += 0.5) },
  { id: 'leg_revive', name: 'Segunda oportunidad', desc: 'Si mueres, revives una vez con 60% de vida.', rarity: 3, icon: 'SO', max: 2, apply: ({ s }) => void (s.revive += 1) },
  {
    id: 'leg_vamp', name: 'Vampiro', desc: '+8% de robo de vida y +50 de vida máxima.', rarity: 3, icon: 'VA', max: 1,
    apply: ({ s, p }) => {
      s.lifesteal += 0.08
      p.maxHp += 50
      p.hp = p.maxHp
    },
  },
  {
    id: 'leg_berserk', name: 'Berserker', desc: 'Escopeta: daño x2 a quemarropa y +25% de cadencia.', rarity: 3, icon: 'BK', max: 1,
    apply: ({ s }) => {
      s.berserk = true
      s.rate += 0.25
    },
  },
  { id: 'leg_storm', name: 'Tormenta de plasma', desc: 'El plasma encadena rayos a 2 enemigos cercanos.', rarity: 3, icon: 'TP', max: 1, apply: ({ s }) => void (s.chain += 2) },
  { id: 'leg_nuke', name: 'Reacción en cadena', desc: 'TODAS las bajas provocan una explosión.', rarity: 3, icon: 'RX', max: 1, apply: ({ s }) => void (s.killBlast = 1) },
  {
    id: 'leg_ammo', name: 'Arsenal sin fin', desc: 'Pistola y ametralladora no gastan balas; munición máxima x2.', rarity: 3, icon: 'AS', max: 1,
    apply: ({ s, p }) => {
      s.infiniteBullets = true
      s.ammoMax *= 2
      for (const k of Object.keys(p.ammo) as AmmoId[]) p.ammo[k] = Math.round(AMMO_BASE[k] * s.ammoMax)
    },
  },
]

/** Elige 3 mejoras distintas según la oleada (o 3 legendarias tras un jefe). */
export function rollUpgrades(ctx: UpgradeCtx, taken: Record<string, number>, wave: number, legendary: boolean): Upgrade[] {
  const pool = UPGRADES.filter(
    (u) =>
      (legendary ? u.rarity === 3 : u.rarity < 3) &&
      (taken[u.id] ?? 0) < u.max &&
      (!u.minWave || wave >= u.minWave) &&
      (!u.req || u.req(ctx)),
  )
  const weight = (u: Upgrade) => {
    if (legendary) return 1
    if (u.rarity === 0) return Math.max(20, 60 - wave * 2)
    if (u.rarity === 1) return 18 + wave * 2
    return 4 + wave * 1.6
  }
  const out: Upgrade[] = []
  const avail = [...pool]
  while (out.length < 3 && avail.length) {
    const total = avail.reduce((a, u) => a + weight(u), 0)
    let r = Math.random() * total
    let k = 0
    for (; k < avail.length - 1; k++) {
      r -= weight(avail[k])
      if (r <= 0) break
    }
    out.push(avail[k])
    avail.splice(k, 1)
  }
  return out
}

/** Soldados seleccionables en la pantalla de título. */
export interface SoldierDef {
  id: string
  name: string
  desc: string
  hp: number
  armor: number
  speed: number
  shells: number
  /** colores de la cara del HUD */
  skin: number
  hair: number
}

export const SOLDIERS: SoldierDef[] = [
  { id: 'cabo', name: 'Cabo Ríos', desc: 'Equilibrado. 100 de vida y 50 de armadura.', hp: 100, armor: 50, speed: 1, shells: 32, skin: 0xd09a74, hair: 0x4a2a14 },
  { id: 'vega', name: 'Sargento Vega', desc: 'Rápida y letal: +15% velocidad, menos vida.', hp: 80, armor: 25, speed: 1.15, shells: 36, skin: 0xb07a56, hair: 0x1a1210 },
  { id: 'toro', name: 'Teniente Toro', desc: 'Un tanque: 130 de vida y 100 de armadura, más lento.', hp: 130, armor: 100, speed: 0.9, shells: 28, skin: 0xe0b090, hair: 0x8a8a8a },
]
