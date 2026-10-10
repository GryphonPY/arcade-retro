'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GameScreen } from './game-screen'
import { publishLogical } from './stage'
import { Hud } from './overlay'
import { shopItems, DECOR, type ShopItem } from './pasteleria/content'
import { randomOrder } from './pasteleria/orders'
import { STORY, storyFor } from './pasteleria/story'
import { RECIPES } from './pasteleria/recipes'
import { loadSave, writeSave, type Save } from './pasteleria/save'
import { ANIMALS, FURS, type Animal } from './pasteleria/draw'
import { KH, KW, startKitchen, type CakeResult, type CustSpec } from './pasteleria/kitchen'

/*
 * Pastelería en Pareja: clon tierno de Good Pizza, Great Pizza con pasteles.
 * Diseño completo en docs/pasteleria-diseno.md.
 */

const ACCENT = '#f472b6'
const INK = '#5b2a3a'
const DAYS_PER_CHAPTER = 7

const NAMES: Record<Animal, string[]> = {
  gato: ['Mimi', 'Michi', 'Luna', 'Tomás'],
  conejo: ['Copito', 'Lola', 'Saltarín'],
  oso: ['Bruno', 'Miel', 'Pancho'],
  pollito: ['Pío', 'Kiko', 'Plumita'],
  rana: ['Croac', 'Lili'],
  pato: ['Cuqui', 'Patricio'],
  buho: ['Ulises', 'Noche'],
  zorro: ['Rojito', 'Zoe'],
  raton: ['Queso', 'Pipa', 'Tito'],
}
const ANIMAL_NAME: Record<Animal, string> = {
  gato: 'Gatito',
  conejo: 'Conejita',
  oso: 'Osito',
  pollito: 'Pollito',
  rana: 'Ranita',
  pato: 'Patito',
  buho: 'Buhito',
  zorro: 'Zorrita',
  raton: 'Ratoncito',
}
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

type Screen = 'title' | 'map' | 'day' | 'summary' | 'shop' | 'book'

interface Summary {
  day: number
  earned: number
  avg: number
  stars: number
  served: number
  declined: number
  recipes: string[]
  story: string[]
}

function buildDay(day: number, save: Save): CustSpec[] {
  const h = (id: string) => save.owned.includes(id)
  const n = 5 + Math.min(3, Math.floor((day - 1) / 3))
  const list: CustSpec[] = []
  for (let i = 0; i < n; i++) {
    const a = pick(ANIMALS.filter((x) => x !== 'buho' && x !== 'rana' && x !== 'pato'))
    let order = randomOrder(h, day)
    for (let k = 0; k < 8 && list.some((c) => c.order.text === order.text); k++) order = randomOrder(h, day)
    let name = `${ANIMAL_NAME[a]} ${pick(NAMES[a])}`
    for (let k = 0; k < 8 && list.some((c) => c.name === name); k++) name = `${ANIMAL_NAME[a]} ${pick(NAMES[a])}`
    list.push({ name, animal: a, fur: pick(FURS[a]), order })
  }
  const story = storyFor(day, save.story)
  story.forEach(({ ch, visit }, k) => {
    const spec: CustSpec = { name: ch.name, animal: ch.animal, fur: ch.fur, order: visit.order(h), intro: visit.intro, love: visit.love, ok: visit.ok, bad: visit.bad, storyId: ch.id }
    // los finales al final del día, los demás repartidos
    const pos = visit.final ? list.length - k : 1 + Math.floor(Math.random() * Math.max(1, list.length - 1))
    list.splice(Math.max(0, Math.min(list.length, pos)), visit.final ? 1 : 0, spec)
  })
  return list
}

export default function Pasteleria() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const kitchenRef = useRef<{ destroy(): void } | null>(null)
  const [save, setSave] = useState<Save | null>(() => (typeof window === 'undefined' ? null : loadSave()))
  const [screen, setScreen] = useState<Screen>('title')
  const [duo, setDuo] = useState(true)
  const [day, setDay] = useState(1)
  const [hud, setHud] = useState({ served: 0, total: 0, earned: 0 })
  const [summary, setSummary] = useState<Summary | null>(null)
  const [shopTab, setShopTab] = useState<'ingredientes' | 'equipo' | 'decoracion'>('ingredientes')

  useEffect(() => {
    publishLogical({ w: KW, h: KH })
    return () => kitchenRef.current?.destroy()
  }, [])

  const persist = useCallback((s: Save) => {
    writeSave(s)
    setSave({ ...s })
  }, [])

  const pf = () => {
    const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
    return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
  }

  const playDay = (d: number) => {
    if (!save || !canvasRef.current) return
    kitchenRef.current?.destroy()
    setDay(d)
    setScreen('day')
    const s = save
    const found: string[] = []
    const storyDone: string[] = []
    const progress = { ...s.story }
    kitchenRef.current = startKitchen(
      canvasRef.current,
      { day: d, duo, owned: new Set(s.owned), decor: s.decor, customers: buildDay(d, s) },
      {
        onHud: setHud,
        onDeliver: (cake, r) => {
          for (const rc of RECIPES) if (!s.recipes.includes(rc.id) && !found.includes(rc.id) && rc.test(cake)) found.push(rc.id)
          if (r.spec.storyId && r.score >= 45) {
            const ch = STORY.find((c) => c.id === r.spec.storyId)
            progress[r.spec.storyId] = (progress[r.spec.storyId] ?? 0) + 1
            if (ch && progress[r.spec.storyId] >= ch.visits.length) storyDone.push(ch.name)
          }
        },
        onEnd: (results: CakeResult[]) => {
          const served = results.filter((r) => !r.declined)
          const avg = served.length ? served.reduce((a, r) => a + r.score, 0) / served.length : 0
          const stars = avg >= 85 ? 3 : avg >= 65 ? 2 : avg >= 40 ? 1 : 0
          const earned = results.reduce((a, r) => a + r.pay, 0)
          const ns: Save = {
            ...s,
            coins: s.coins + earned,
            stars: Object.assign([...s.stars], { [d - 1]: Math.max(s.stars[d - 1] ?? 0, stars) }),
            maxDay: Math.max(s.maxDay, d + 1),
            recipes: [...s.recipes, ...found],
            story: progress,
          }
          persist(ns)
          setSummary({ day: d, earned, avg: Math.round(avg), stars, served: served.length, declined: results.length - served.length, recipes: found, story: storyDone })
          kitchenRef.current?.destroy()
          kitchenRef.current = null
          setScreen('summary')
        },
      },
      pf(),
    )
  }

  const buy = (it: ShopItem) => {
    if (!save || save.coins < it.cost || save.owned.includes(it.id)) return
    const ns: Save = { ...save, coins: save.coins - it.cost, owned: [...save.owned, it.id] }
    if (it.kind === 'decor' && it.slot) ns.decor = { ...save.decor, [it.slot]: it.id }
    persist(ns)
  }
  const equip = (it: ShopItem) => {
    if (!save || !it.slot) return
    const cur = save.decor[it.slot]
    persist({ ...save, decor: { ...save.decor, [it.slot]: cur === it.id ? undefined : it.id } })
  }

  const hudEl = (
    <Hud>
      <span style={{ color: ACCENT }}>{screen === 'day' ? `DÍA ${day}` : 'PASTELERÍA'}</span>
      {screen === 'day' && (
        <span className="text-white/80">
          CLIENTES {hud.served}/{hud.total}
        </span>
      )}
      <span style={{ color: '#fde047' }}>MONEDAS {(save?.coins ?? 0) + (screen === 'day' ? hud.earned : 0)}</span>
    </Hud>
  )

  const btn = 'rounded-full px-5 py-2 text-sm font-bold shadow-[0_3px_0_rgba(91,42,58,0.35)] transition active:translate-y-0.5'
  const panel = 'absolute inset-0 z-10 overflow-y-auto overscroll-contain'
  const bg = { background: 'radial-gradient(circle at 50% 0%, #ffd6e7 0%, transparent 60%), #fff4f8', color: INK }
  const chapterCount = Math.max(2, Math.ceil((save?.maxDay ?? 1) / DAYS_PER_CHAPTER))

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen width={KW} height={KH} className="rounded-2xl border-2 border-pink-300/50 bg-[#ffe4ef] shadow-[0_0_30px_rgba(244,114,182,0.25)]" hud={hudEl}>
        <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" style={{ touchAction: 'none' }} aria-label="Juego Pastelería en Pareja" />

        {screen === 'title' && (
          <div className={`${panel} flex flex-col items-center justify-center gap-4 p-6 text-center`} style={bg}>
            <p className="text-2xl sm:text-3xl" style={{ fontFamily: 'var(--font-pixel)', color: '#ec4899', textShadow: '3px 3px 0 #fff' }}>
              PASTELERÍA EN PAREJA
            </p>
            <p className="max-w-md text-sm leading-relaxed opacity-80">
              Los animalitos del pueblo piden pasteles a su manera. Viertan la masa, horneen, unten la crema con el dedo, echen
              puños de adornos y corten. Los dos pueden cocinar al mismo tiempo en la misma pantalla.
            </p>
            <div className="flex gap-2">
              {[true, false].map((d) => (
                <button key={String(d)} type="button" onClick={() => setDuo(d)} className={btn} style={{ background: duo === d ? ACCENT : '#ffffff', color: duo === d ? '#fff' : INK }}>
                  {d ? '2 pasteleras · 2 clientes' : '1 pastelera'}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setScreen('map')} className={`${btn} px-8 py-3 text-base text-white`} style={{ background: '#ec4899' }}>
              Abrir la pastelería
            </button>
          </div>
        )}

        {screen === 'map' && save && (
          <div className={`${panel} p-4`} style={bg}>
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-black">Calendario de la pastelería</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setScreen('shop')} className={btn} style={{ background: '#fde68a' }}>
                    🛍️ Tienda
                  </button>
                  <button type="button" onClick={() => setScreen('book')} className={btn} style={{ background: '#c4b5fd' }}>
                    📖 Recetario {save.recipes.length}/{RECIPES.length}
                  </button>
                </div>
              </div>
              {Array.from({ length: chapterCount }, (_, ci) => (
                <div key={ci} className="rounded-3xl border-2 border-[#5b2a3a]/20 bg-white/70 p-3">
                  <p className="mb-2 text-sm font-bold opacity-70">Semana {ci + 1}{ci === 0 ? ' · Bienvenida al pueblo' : ci === 1 ? ' · Una boda en puerta' : ''}</p>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: DAYS_PER_CHAPTER }, (_, k) => {
                      const d = ci * DAYS_PER_CHAPTER + k + 1
                      const open = d <= save.maxDay
                      const st = save.stars[d - 1] ?? 0
                      const special = d % DAYS_PER_CHAPTER === 0
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={!open}
                          onClick={() => playDay(d)}
                          className="flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition active:scale-95 disabled:opacity-35"
                          style={{ borderColor: d === save.maxDay ? '#ec4899' : 'rgba(91,42,58,0.2)', background: special ? '#ffe08a' : d === save.maxDay ? '#ffd6e7' : '#fff' }}
                        >
                          <span className="text-base font-black">{special ? '🎉' : d}</span>
                          <span className="text-[10px] text-amber-500">{open ? '★'.repeat(st) + '☆'.repeat(3 - st) : '🔒'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <p className="text-center text-xs opacity-60">Los días con 🎉 tienen eventos especiales. Puedes repetir cualquier día para sacar más estrellas.</p>
            </div>
          </div>
        )}

        {screen === 'summary' && summary && (
          <div className={`${panel} flex flex-col items-center justify-center gap-3 p-6 text-center`} style={bg}>
            <p className="text-xl font-black">¡Cerramos el día {summary.day}!</p>
            <p className="text-4xl text-amber-400">{'★'.repeat(summary.stars) + '☆'.repeat(3 - summary.stars)}</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-white/80 px-4 py-2">
                <p className="text-xs opacity-60">Ganancias</p>
                <p className="text-lg font-black text-amber-500">+{summary.earned}</p>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-2">
                <p className="text-xs opacity-60">Satisfacción</p>
                <p className="text-lg font-black">{summary.avg}%</p>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-2">
                <p className="text-xs opacity-60">Pasteles</p>
                <p className="text-lg font-black">{summary.served}</p>
              </div>
            </div>
            {summary.recipes.length > 0 && (
              <p className="rounded-2xl bg-[#ede4ff] px-4 py-2 text-sm">
                📖 ¡Receta nueva! {summary.recipes.map((id) => RECIPES.find((r) => r.id === id)?.name).join(', ')}
              </p>
            )}
            {summary.story.map((n) => (
              <p key={n} className="rounded-2xl bg-[#ffe08a] px-4 py-2 text-sm">
                💌 Terminaste la historia de {n}
              </p>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={() => setScreen('shop')} className={btn} style={{ background: '#fde68a' }}>
                🛍️ Tienda
              </button>
              <button type="button" onClick={() => setScreen('map')} className={`${btn} text-white`} style={{ background: '#ec4899' }}>
                Siguiente día →
              </button>
            </div>
          </div>
        )}

        {screen === 'shop' && save && (
          <div className={`${panel} p-4`} style={bg}>
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-black">Tienda · 🪙 {save.coins}</p>
                <button type="button" onClick={() => setScreen('map')} className={`${btn} text-white`} style={{ background: '#ec4899' }}>
                  ← Calendario
                </button>
              </div>
              <div className="flex gap-2">
                {(['ingredientes', 'equipo', 'decoracion'] as const).map((tb) => (
                  <button key={tb} type="button" onClick={() => setShopTab(tb)} className={btn} style={{ background: shopTab === tb ? ACCENT : '#fff', color: shopTab === tb ? '#fff' : INK }}>
                    {tb === 'ingredientes' ? '🍓 Ingredientes' : tb === 'equipo' ? '🔥 Equipo' : '🪴 Decoración'}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {shopItems()
                  .filter((it) => (shopTab === 'ingredientes' ? ['flavor', 'frost', 'top'].includes(it.kind) : shopTab === 'equipo' ? it.kind === 'equip' : it.kind === 'decor'))
                  .map((it) => {
                    const own = save.owned.includes(it.id)
                    const locked = !!it.needs && !save.owned.includes(it.needs)
                    const can = !own && !locked && save.coins >= it.cost
                    const equipped = it.slot && save.decor[it.slot] === it.id
                    return (
                      <div key={it.id} className="flex items-center gap-3 rounded-2xl border-2 border-white bg-white/85 px-3 py-2 shadow-sm">
                        {it.kind === 'decor' && <span className="h-8 w-8 shrink-0 rounded-full border-2 border-[#5b2a3a]/30" style={{ background: DECOR.find((d) => d.id === it.id)?.color }} />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{it.name}</p>
                          <p className="text-[11px] opacity-70">{locked ? 'Primero compra el anterior' : it.desc}</p>
                        </div>
                        {own ? (
                          it.slot ? (
                            <button type="button" onClick={() => equip(it)} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: equipped ? '#86efac' : '#f3e8ff' }}>
                              {equipped ? 'Puesto ✓' : 'Poner'}
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-emerald-600">Tuyo ✓</span>
                          )
                        ) : (
                          <button type="button" disabled={!can} onClick={() => buy(it)} className="rounded-full px-3 py-1 text-xs font-bold disabled:opacity-40" style={{ background: '#fde68a' }}>
                            🪙 {it.cost}
                          </button>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}

        {screen === 'book' && save && (
          <div className={`${panel} p-4`} style={bg}>
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-lg font-black">
                  Recetario · {Math.round((save.recipes.length / RECIPES.length) * 100)}%
                </p>
                <button type="button" onClick={() => setScreen('map')} className={`${btn} text-white`} style={{ background: '#ec4899' }}>
                  ← Calendario
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {RECIPES.map((r) => {
                  const got = save.recipes.includes(r.id)
                  return (
                    <div key={r.id} className="rounded-2xl border-2 border-white bg-white/85 px-3 py-2" style={{ opacity: got ? 1 : 0.7 }}>
                      <p className="text-sm font-black">{got ? `🎂 ${r.name}` : '❔ ???'}</p>
                      <p className="text-[11px] opacity-70">Pista: {r.clue}</p>
                    </div>
                  )
                })}
              </div>
              <p className="text-center text-xs opacity-60">Las recetas se descubren al entregar un pastel que las cumpla.</p>
            </div>
          </div>
        )}
      </GameScreen>
    </div>
  )
}
