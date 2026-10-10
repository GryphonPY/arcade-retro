'use client'

import { useEffect, useRef, useState } from 'react'
import { GameScreen } from './game-screen'
import { publishLogical } from './stage'
import { Hud } from './overlay'
import {
  CATS,
  DECOR,
  EXPANSIONS,
  HATS,
  RECIPES,
  STATIONS,
  catSpeed,
  catTrainCost,
  priceAt,
  recipeUpCost,
  stationSpeed,
  stationUpCost,
  type DecorSlot,
  type HatId,
  type StationId,
} from './cafe/content'
import { loadSave, offlineEarnings, writeSave, type CafeSave } from './cafe/save'
import { CW, CH, startScene } from './cafe/scene'

/*
 * Café Michi: café cozy atendido por gatitos (a lo Cats & Soup). Diseño completo en
 * docs/cafe-michi-diseno.md.
 */

const ACCENT = '#f472b6'
const INK = '#5b2a3a'

// El guardado vive fuera de React: la escena lo modifica en cada cuadro.
let SAVE: CafeSave | null = null
const getSave = () => (SAVE ??= loadSave())

type Panel = null | 'menu' | 'michis' | 'local'
const fmtTime = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.max(1, Math.floor(s / 60))} min`)

export default function CafeMichi() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<{ destroy(): void; refresh(): void } | null>(null)
  const [, setVer] = useState(0)
  const [panel, setPanel] = useState<Panel>(null)
  const [offline, setOffline] = useState(() => {
    if (typeof window === 'undefined') return null
    SAVE = loadSave()
    const s = SAVE
    const o = offlineEarnings(s)
    if (o.coins > 0) {
      s.coins += o.coins
      writeSave(s)
      return o
    }
    return null
  })
  const bump = () => setVer((v) => v + 1)

  useEffect(() => {
    publishLogical({ w: CW, h: CH })
    const canvas = canvasRef.current
    if (!canvas) return
    const pf = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()
    sceneRef.current = startScene(canvas, getSave(), { onChange: () => setVer((v) => v + 1) }, pf)
    const iv = window.setInterval(() => {
      writeSave(getSave())
      setVer((v) => v + 1)
    }, 3000)
    const onHide = () => writeSave(getSave())
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      writeSave(getSave())
      window.clearInterval(iv)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      sceneRef.current?.destroy()
      sceneRef.current = null
    }
  }, [])

  const save = getSave()
  const spend = (cost: number, fn: (s: CafeSave) => void) => {
    const s = getSave()
    if (s.coins < cost) return
    s.coins -= cost
    fn(s)
    writeSave(s)
    sceneRef.current?.refresh()
    bump()
  }
  const change = (fn: (s: CafeSave) => void) => {
    const s = getSave()
    fn(s)
    writeSave(s)
    sceneRef.current?.refresh()
    bump()
  }

  const hud = (
    <Hud>
      <span style={{ color: ACCENT }}>CAFÉ MICHI</span>
      <span className="text-pink-300">♥ {save.hearts}</span>
      <span style={{ color: '#fde047' }}>MONEDAS {save.coins}</span>
    </Hud>
  )

  const card = 'flex items-center gap-3 rounded-2xl border-2 border-white bg-white/85 px-3 py-2 shadow-sm'
  const buyBtn = 'shrink-0 rounded-full px-3 py-1 text-xs font-bold transition active:scale-95 disabled:opacity-40'

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <GameScreen width={CW} height={CH} className="rounded-2xl border-2 border-pink-300/50 bg-[#ffe4ef] shadow-[0_0_30px_rgba(244,114,182,0.25)]" hud={hud}>
        <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" style={{ touchAction: 'none' }} aria-label="Juego Café Michi" />

        <div className="absolute right-2 top-2 z-10 flex gap-1.5">
          {(
            [
              ['menu', '🍰 Menú'],
              ['michis', '🐱 Michis'],
              ['local', '🏡 Local'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPanel(panel === id ? null : id)} className="rounded-full border-2 px-3 py-1 text-xs font-bold shadow transition active:scale-95" style={{ background: panel === id ? ACCENT : '#ffffff', color: panel === id ? '#fff' : INK, borderColor: INK }}>
              {label}
            </button>
          ))}
        </div>

        {offline && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#5b2a3a]/40 p-6" onClick={() => setOffline(null)}>
            <div className="max-w-sm rounded-3xl border-2 bg-[#fff4f8] p-5 text-center" style={{ borderColor: INK, color: INK }}>
              <p className="text-lg font-black">¡Bienvenidas de vuelta!</p>
              <p className="mt-2 text-sm">Mientras no estaban ({fmtTime(offline.secs)}), los michis atendieron el café y ganaron</p>
              <p className="my-2 text-3xl font-black text-amber-500">🪙 {offline.coins}</p>
              <button type="button" className="rounded-full px-5 py-2 text-sm font-bold text-white" style={{ background: '#ec4899' }}>
                ¡Gracias, michis!
              </button>
            </div>
          </div>
        )}

        {panel && (
          <div className="absolute inset-y-0 right-0 z-10 w-full max-w-md overflow-y-auto overscroll-contain border-l-2 p-3 pt-12 sm:w-[55%]" style={{ background: '#fff4f8', color: INK, borderColor: INK }}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-base font-black">{panel === 'menu' ? 'Menú y estaciones' : panel === 'michis' ? 'Tus michis' : 'Tu local'}</p>
                <button type="button" onClick={() => setPanel(null)} className="rounded-full bg-white px-3 py-1 text-xs font-bold">
                  Cerrar ✕
                </button>
              </div>

              {panel === 'menu' &&
                STATIONS.map((st) => {
                  const lvl = save.stations[st.id]
                  const canHave = save.exp >= st.needExp
                  return (
                    <div key={st.id} className="flex flex-col gap-1.5 rounded-3xl border-2 border-white bg-white/60 p-2">
                      <div className={card}>
                        <span className="h-8 w-8 shrink-0 rounded-xl border-2" style={{ background: st.color, borderColor: INK }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{st.name}</p>
                          <p className="text-[11px] opacity-70">{lvl ? `Nivel ${lvl} · velocidad ×${stationSpeed(lvl).toFixed(2)}` : canHave ? 'Nueva estación' : `Necesita: ${EXPANSIONS[st.needExp].name}`}</p>
                        </div>
                        {lvl ? (
                          lvl < 10 && (
                            <button type="button" disabled={save.coins < stationUpCost(st, lvl)} onClick={() => spend(stationUpCost(st, lvl), (s) => (s.stations[st.id] = lvl + 1))} className={buyBtn} style={{ background: '#fde68a' }}>
                              ⬆ 🪙 {stationUpCost(st, lvl)}
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={!canHave || save.coins < st.cost}
                            onClick={() =>
                              spend(st.cost, (s) => {
                                s.stations[st.id] = 1
                                const base = RECIPES.find((r) => r.station === st.id && r.cost === 0)
                                if (base) s.recipes[base.id] = 1
                              })
                            }
                            className={buyBtn}
                            style={{ background: '#fde68a' }}
                          >
                            🪙 {st.cost}
                          </button>
                        )}
                      </div>
                      {lvl &&
                        RECIPES.filter((r) => r.station === st.id).map((r) => {
                          const rl = save.recipes[r.id]
                          return (
                            <div key={r.id} className={`${card} ml-4 py-1.5`}>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold">{r.name}</p>
                                <p className="text-[11px] opacity-70">{rl ? `Nivel ${rl} · vale 🪙 ${priceAt(r, rl)}` : `Nueva receta · vale 🪙 ${r.price}`}</p>
                              </div>
                              {rl ? (
                                rl < 5 && (
                                  <button type="button" disabled={save.coins < recipeUpCost(r, rl)} onClick={() => spend(recipeUpCost(r, rl), (s) => (s.recipes[r.id] = rl + 1))} className={buyBtn} style={{ background: '#fbcfe8' }}>
                                    ⬆ 🪙 {recipeUpCost(r, rl)}
                                  </button>
                                )
                              ) : (
                                <button type="button" disabled={save.coins < r.cost} onClick={() => spend(r.cost, (s) => (s.recipes[r.id] = 1))} className={buyBtn} style={{ background: '#fbcfe8' }}>
                                  🪙 {r.cost}
                                </button>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )
                })}

              {panel === 'michis' && (
                <>
                  {save.staff.map((sv) => {
                    const c = CATS.find((x) => x.id === sv.id)!
                    const jobs: (StationId | 'mesero' | null)[] = [...STATIONS.filter((s) => save.stations[s.id]).map((s) => s.id), 'mesero', null]
                    return (
                      <div key={sv.id} className="flex flex-col gap-1.5 rounded-3xl border-2 border-white bg-white/80 p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-9 w-9 shrink-0 rounded-full border-2" style={{ background: c.fur, borderColor: INK }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black">
                              {c.name} <span className="text-[11px] font-normal opacity-70">nivel {sv.lvl} · velocidad ×{catSpeed(c, sv.lvl).toFixed(2)}</span>
                            </p>
                            <p className="text-[11px] opacity-70">{c.bio}</p>
                          </div>
                          {sv.lvl < 10 && (
                            <button type="button" disabled={save.coins < catTrainCost(c, sv.lvl)} onClick={() => spend(catTrainCost(c, sv.lvl), (s) => (s.staff.find((x) => x.id === sv.id)!.lvl = sv.lvl + 1))} className={buyBtn} style={{ background: '#fde68a' }}>
                              Entrenar 🪙 {catTrainCost(c, sv.lvl)}
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {jobs.map((j) => (
                            <button key={String(j)} type="button" onClick={() => change((s) => (s.staff.find((x) => x.id === sv.id)!.job = j))} className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ background: sv.job === j ? ACCENT : '#fff', color: sv.job === j ? '#fff' : INK, borderColor: 'rgba(91,42,58,0.3)' }}>
                              {j === null ? '😴 Descansa' : j === 'mesero' ? '🍽️ Mesero' : STATIONS.find((s) => s.id === j)!.name}
                            </button>
                          ))}
                        </div>
                        {save.hats.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {([null, ...save.hats] as (HatId | null)[]).map((h) => (
                              <button key={String(h)} type="button" onClick={() => change((s) => (s.staff.find((x) => x.id === sv.id)!.hat = h))} className="rounded-full border px-2 py-0.5 text-[11px]" style={{ background: sv.hat === h ? '#c4b5fd' : '#fff', borderColor: 'rgba(91,42,58,0.3)' }}>
                                {h === null ? 'Sin ropa' : HATS.find((x) => x.id === h)!.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <p className="mt-2 text-sm font-black">Contratar</p>
                  {CATS.filter((c) => !save.staff.some((s) => s.id === c.id)).map((c) => (
                    <div key={c.id} className={card}>
                      <span className="h-8 w-8 shrink-0 rounded-full border-2" style={{ background: c.fur, borderColor: INK }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">
                          {c.name} <span className="text-[11px] font-normal opacity-70">velocidad ×{c.speed.toFixed(2)}</span>
                        </p>
                        <p className="text-[11px] opacity-70">{c.bio}</p>
                      </div>
                      <button type="button" disabled={save.coins < c.cost} onClick={() => spend(c.cost, (s) => s.staff.push({ id: c.id, lvl: 1, job: 'mesero', hat: null }))} className={buyBtn} style={{ background: '#fde68a' }}>
                        🪙 {c.cost}
                      </button>
                    </div>
                  ))}
                  <p className="mt-2 text-sm font-black">Ropita</p>
                  {HATS.filter((h) => !save.hats.includes(h.id)).map((h) => (
                    <div key={h.id} className={card}>
                      <p className="min-w-0 flex-1 text-sm font-bold">{h.name}</p>
                      <button type="button" disabled={save.coins < h.cost} onClick={() => spend(h.cost, (s) => s.hats.push(h.id))} className={buyBtn} style={{ background: '#c4b5fd' }}>
                        🪙 {h.cost}
                      </button>
                    </div>
                  ))}
                </>
              )}

              {panel === 'local' && (
                <>
                  {EXPANSIONS.map((e, i) => (
                    <div key={e.name} className={card} style={{ opacity: i <= save.exp + 1 ? 1 : 0.5 }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{e.name}</p>
                        <p className="text-[11px] opacity-70">{e.desc}</p>
                      </div>
                      {i <= save.exp ? (
                        <span className="text-xs font-bold text-emerald-600">Listo ✓</span>
                      ) : i === save.exp + 1 ? (
                        <button type="button" disabled={save.coins < e.cost} onClick={() => spend(e.cost, (s) => (s.exp = i))} className={buyBtn} style={{ background: '#fde68a' }}>
                          🪙 {e.cost}
                        </button>
                      ) : (
                        <span className="text-xs">🔒</span>
                      )}
                    </div>
                  ))}
                  <p className="mt-2 text-sm font-black">Decoración (trae más clientes)</p>
                  {DECOR.map((d) => {
                    const own = save.decor.includes(d.id)
                    const on = save.placed[d.slot] === d.id
                    return (
                      <div key={d.id} className={card}>
                        <span className="h-8 w-8 shrink-0 rounded-full border-2" style={{ background: d.color, borderColor: 'rgba(91,42,58,0.3)' }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{d.name}</p>
                          <p className="text-[11px] opacity-70">+{d.rep} reputación</p>
                        </div>
                        {own ? (
                          <button type="button" onClick={() => change((s) => (s.placed[d.slot as DecorSlot] = on ? undefined : d.id))} className={buyBtn} style={{ background: on ? '#86efac' : '#f3e8ff' }}>
                            {on ? 'Puesto ✓' : 'Poner'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={save.coins < d.cost}
                            onClick={() =>
                              spend(d.cost, (s) => {
                                s.decor.push(d.id)
                                s.placed[d.slot] = d.id
                              })
                            }
                            className={buyBtn}
                            style={{ background: '#fde68a' }}
                          >
                            🪙 {d.cost}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
              <p className="mt-2 text-center text-[11px] opacity-60">
                Toca a un michi para apapacharlo (trabaja al doble). Arrastra lo de la barra a la mesa para ganar más propina. Toca las monedas para recogerlas.
              </p>
            </div>
          </div>
        )}
      </GameScreen>
    </div>
  )
}
