'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { GameOverOverlay, useIsTouch } from './overlay'
import { loadBest } from './game-utils'
import { Game, GAME_ID, type Choice, type RunResult, type Screen } from './bunker-93/game'
import { RARITY, SOLDIERS } from './bunker-93/defs'
import { TouchControls } from './bunker-93/touch'

const ACCENT = '#ef4444'
const pixel = { fontFamily: 'var(--font-pixel)' }

function subscribeOrientation(cb: () => void) {
  const mq = window.matchMedia('(orientation: portrait)')
  mq.addEventListener('change', cb)
  window.addEventListener('resize', cb)
  return () => {
    mq.removeEventListener('change', cb)
    window.removeEventListener('resize', cb)
  }
}

function usePortrait() {
  return useSyncExternalStore(
    subscribeOrientation,
    () => window.matchMedia('(orientation: portrait)').matches,
    () => false,
  )
}

const fmtTime = (s: number) => {
  const t = Math.floor(s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

function Face({ game, idx }: { game: Game | null; idx: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv || !game) return
    const s = SOLDIERS[idx]
    const f = game.hud.face(s.skin, s.hair, 0, 0, 'normal')
    const c = cv.getContext('2d')
    if (!c) return
    c.clearRect(0, 0, cv.width, cv.height)
    c.drawImage(f, 0, 0)
  }, [game, idx])
  return <canvas ref={ref} width={24} height={29} className="h-[58px] w-12" style={{ imageRendering: 'pixelated' }} />
}

function Bar({ v, color }: { v: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${Math.round(v * 100)}%`, background: color }} />
    </div>
  )
}

export default function Bunker93() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const glRef = useRef<HTMLCanvasElement | null>(null)
  const uiRef = useRef<HTMLCanvasElement | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [screen, setScreen] = useState<Screen>('title')
  const [choice, setChoice] = useState<Choice | null>(null)
  const [sel, setSel] = useState(0)
  const [soldier, setSoldier] = useState(0)
  const [result, setResult] = useState<RunResult | null>(null)
  const [locked, setLocked] = useState(false)
  const [best, setBest] = useState(0)
  const [barCss, setBarCss] = useState(48)
  const [altAvail, setAltAvail] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const overAt = useRef(0)
  const touch = useIsTouch()
  const portrait = usePortrait()

  // motor
  useEffect(() => {
    const host = hostRef.current
    const gl = glRef.current
    const ui = uiRef.current
    if (!host || !gl || !ui) return
    let g: Game
    try {
      g = new Game(gl, ui, host, {
        screen: (s) => setScreen(s),
        choice: (c) => {
          setChoice(c)
          setSel(0)
        },
        over: (r) => {
          overAt.current = performance.now()
          setResult(r)
        },
        lock: (l) => setLocked(l),
      })
    } catch (e) {
      queueMicrotask(() => setErr(e instanceof Error ? e.message : 'WebGL no disponible'))
      return
    }
    queueMicrotask(() => {
      setGame(g)
      setBest(loadBest(GAME_ID))
    })
    const onFirst = () => {
      g.audio.unlock()
      if (g.screen === 'title') g.audio.setTrack('calm')
    }
    host.addEventListener('pointerdown', onFirst)
    window.addEventListener('keydown', onFirst)
    return () => {
      host.removeEventListener('pointerdown', onFirst)
      window.removeEventListener('keydown', onFirst)
      g.dispose()
    }
  }, [])

  // alto de la barra del HUD en px (para los botones táctiles)
  useEffect(() => {
    if (!game) return
    const upd = () => setBarCss(game.barCss())
    upd()
    window.addEventListener('resize', upd)
    const t = setTimeout(upd, 300)
    return () => {
      window.removeEventListener('resize', upd)
      clearTimeout(t)
    }
  }, [game, screen])

  // en vertical, pausa automática
  useEffect(() => {
    if (portrait && touch && game && game.screen === 'playing') game.pause()
  }, [portrait, touch, game])

  const start = () => {
    if (!game) return
    setResult(null)
    setAltAvail(false)
    game.start(soldier)
  }

  const pickCard = (i: number) => {
    if (!game) return
    game.choose(i)
    setAltAvail(!!game.stats.doubleBarrel)
  }

  // teclado de las pantallas de menú
  useEffect(() => {
    if (!game) return
    const onKey = (e: KeyboardEvent) => {
      const k = e.code
      if (screen === 'title') {
        if (k === 'ArrowLeft' || k === 'KeyA') {
          setSoldier((s) => (s + SOLDIERS.length - 1) % SOLDIERS.length)
          game.audio.unlock()
          game.audio.select()
        } else if (k === 'ArrowRight' || k === 'KeyD') {
          setSoldier((s) => (s + 1) % SOLDIERS.length)
          game.audio.unlock()
          game.audio.select()
        } else if (k === 'Space' || k === 'Enter') {
          e.preventDefault()
          start()
        }
      } else if (screen === 'upgrade' && choice) {
        const n = parseInt(e.key, 10)
        if (n >= 1 && n <= choice.cards.length) pickCard(n - 1)
        else if (k === 'ArrowLeft' || k === 'KeyA' || k === 'ArrowUp' || k === 'KeyW') {
          setSel((s) => (s + choice.cards.length - 1) % choice.cards.length)
          game.audio.select()
        } else if (k === 'ArrowRight' || k === 'KeyD' || k === 'ArrowDown' || k === 'KeyS') {
          setSel((s) => (s + 1) % choice.cards.length)
          game.audio.select()
        } else if (k === 'Space' || k === 'Enter') {
          e.preventDefault()
          pickCard(sel)
        }
      } else if (screen === 'paused') {
        if (k === 'Space' || k === 'Enter') {
          e.preventDefault()
          game.resume()
        }
      } else if (screen === 'gameover') {
        if ((k === 'Space' || k === 'Enter') && performance.now() - overAt.current > 900) {
          e.preventDefault()
          start()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const showPortraitWarn = touch && portrait
  const s = SOLDIERS[soldier]

  return (
    <div
      ref={hostRef}
      className="relative flex h-full w-full flex-1 overflow-hidden bg-black select-none"
      style={{ cursor: screen === 'playing' && locked ? 'none' : 'default' }}
    >
      <canvas
        ref={glRef}
        className="absolute inset-0 block h-full w-full touch-none"
        style={{ imageRendering: 'pixelated' }}
        aria-label="Búnker 93"
      />
      <canvas
        ref={uiRef}
        className="pointer-events-none absolute inset-0 block h-full w-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {err && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6 text-center text-sm text-white/70">
          No se pudo iniciar el modo 3D en este dispositivo ({err}).
        </div>
      )}

      {game && touch && screen === 'playing' && !showPortraitWarn && (
        <TouchControls game={game} barCss={barCss} showAlt={altAvail} />
      )}

      {screen === 'playing' && !touch && !locked && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-white/80">
          Haz clic para apuntar con el mouse
        </div>
      )}

      {/* ---------------- título */}
      {screen === 'title' && game && (
        <div
          className="absolute inset-0 z-10 overflow-y-auto overscroll-contain"
          style={{ background: 'radial-gradient(circle at 50% 30%, rgba(239,68,68,0.18), transparent 65%), rgba(6,3,3,0.55)' }}
        >
          <div className="flex min-h-full flex-col items-center justify-center gap-3 px-4 py-4 text-center [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:py-2">
            <h2
              className="text-2xl leading-tight sm:text-4xl [@media(max-height:500px)]:text-xl"
              style={{ ...pixel, color: ACCENT, textShadow: `0 0 24px ${ACCENT}99, 4px 4px 0 #000` }}
            >
              BUNKER 93
            </h2>
            <p className="max-w-md text-xs leading-relaxed text-white/75 sm:text-sm [@media(max-height:500px)]:hidden">
              La base subterránea cayó ante los mutantes. Resiste oleadas cada vez más brutales, elige mejoras tras cada una y derriba a los jefes de cada sector.
            </p>
            <div className="flex flex-wrap items-stretch justify-center gap-2">
              {SOLDIERS.map((so, i) => (
                <button
                  key={so.id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur()
                    setSoldier(i)
                    game.audio.unlock()
                    game.audio.select()
                  }}
                  className="flex w-[9.5rem] flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2 text-left transition active:scale-[0.98]"
                  style={{
                    borderColor: soldier === i ? ACCENT : 'rgba(255,255,255,0.14)',
                    background: soldier === i ? 'rgba(239,68,68,0.16)' : 'rgba(0,0,0,0.45)',
                    boxShadow: soldier === i ? `0 0 18px ${ACCENT}55` : 'none',
                  }}
                >
                  <div className="flex w-full items-center gap-2">
                    <Face game={game} idx={i} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-tight text-white">{so.name}</p>
                      <div className="mt-1 flex flex-col gap-1">
                        <Bar v={so.hp / 130} color="#ef4444" />
                        <Bar v={so.armor / 100} color="#22c55e" />
                        <Bar v={(so.speed - 0.75) / 0.45} color="#60a5fa" />
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] leading-snug text-white/60 [@media(max-height:500px)]:text-[10px]">{so.desc}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                start()
              }}
              className="rounded-full px-8 py-2.5 text-sm font-semibold text-black transition active:scale-95"
              style={{ background: ACCENT, boxShadow: `0 0 24px ${ACCENT}66` }}
            >
              Jugar como {s.name.split(' ')[0]}
            </button>
            {best > 0 && <p className="text-xs text-white/50 tabular-nums">Récord {best.toLocaleString('es-MX')}</p>}
            <p className="max-w-md text-[11px] leading-relaxed text-white/45">
              {touch
                ? 'Joystick izquierdo para moverte, arrastra a la derecha para girar, FUEGO para disparar y ARMA para cambiar.'
                : 'WASD moverse · Mouse apuntar · Clic disparar · 1-5 o rueda: armas · Esc pausa. Flechas ← → eligen soldado.'}
            </p>
          </div>
        </div>
      )}

      {/* ---------------- mejoras */}
      {screen === 'upgrade' && choice && (
        <div
          className="absolute inset-0 z-20 overflow-y-auto overscroll-contain"
          style={{
            background: choice.legendary
              ? 'radial-gradient(circle at 50% 35%, rgba(245,158,11,0.22), transparent 70%), rgba(8,5,2,0.86)'
              : 'radial-gradient(circle at 50% 35%, rgba(239,68,68,0.16), transparent 70%), rgba(6,4,4,0.84)',
          }}
        >
          <div className="flex min-h-full flex-col items-center justify-center gap-3 px-3 py-3">
            <p
              className="text-center text-sm sm:text-lg"
              style={{ ...pixel, color: choice.legendary ? '#fbbf24' : ACCENT, textShadow: '3px 3px 0 #000' }}
            >
              {choice.title}
            </p>
            <p className="text-center text-xs text-white/60">{choice.subtitle}</p>
            <div className="flex w-full max-w-3xl flex-wrap items-stretch justify-center gap-2.5">
              {choice.cards.map((c, i) => {
                const rar = RARITY[c.rarity]
                const on = sel === i
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur()
                      pickCard(i)
                    }}
                    onMouseEnter={() => setSel(i)}
                    className="flex w-[13.5rem] flex-col gap-2 rounded-xl border-2 p-3 text-left transition active:scale-[0.98]"
                    style={{
                      borderColor: on ? rar.color : `${rar.color}55`,
                      background: on ? `${rar.color}22` : 'rgba(255,255,255,0.04)',
                      boxShadow: on ? `0 0 22px ${rar.color}55` : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-md text-[11px] text-black"
                        style={{ ...pixel, background: rar.color }}
                      >
                        {c.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-white">{c.name}</p>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: rar.color }}>
                          {rar.name}
                          {c.level > 1 ? ` · nivel ${c.level}` : ''}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs leading-snug text-white/75">{c.desc}</p>
                    {!touch && <p className="mt-auto text-[10px] text-white/35">Tecla {i + 1}</p>}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-white/45">{touch ? 'Toca una carta' : 'Clic, teclas 1-3 o flechas + Espacio'}</p>
          </div>
        </div>
      )}

      {/* ---------------- pausa */}
      {screen === 'paused' && game && (
        <div
          className="absolute inset-0 z-20 overflow-y-auto overscroll-contain"
          style={{ background: 'radial-gradient(circle at 50% 40%, rgba(239,68,68,0.12), transparent 70%), rgba(6,4,4,0.8)' }}
        >
          <div className="flex min-h-full flex-col items-center justify-center gap-3 px-4 py-4 text-center">
            <p className="text-lg sm:text-2xl" style={{ ...pixel, color: '#fff', textShadow: '3px 3px 0 #000' }}>
              PAUSA
            </p>
            <p className="text-xs text-white/60">
              Oleada {game.wave} · {game.score.toLocaleString('es-MX')} puntos
            </p>
            {game.takenList().length > 0 && (
              <div className="flex max-w-lg flex-wrap justify-center gap-1.5">
                {game.takenList().map((u) => (
                  <span
                    key={u.name}
                    className="rounded-md border px-2 py-0.5 text-[11px] text-white/80"
                    style={{ borderColor: `${RARITY[u.rarity].color}88` }}
                  >
                    {u.name}
                    {u.n > 1 ? ` x${u.n}` : ''}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                game.resume()
              }}
              className="mt-1 rounded-full px-7 py-2.5 text-sm font-semibold text-black transition active:scale-95"
              style={{ background: ACCENT, boxShadow: `0 0 24px ${ACCENT}66` }}
            >
              Continuar
            </button>
            <p className="text-[11px] text-white/45">{touch ? 'Toca Continuar' : 'P, Espacio o clic para seguir · Esc para salir'}</p>
          </div>
        </div>
      )}

      {/* ---------------- fin */}
      {screen === 'gameover' && result && (
        <div className="absolute inset-0 z-20">
          <GameOverOverlay
            title="HAS CAIDO"
            accent={ACCENT}
            score={result.score}
            best={result.best}
            newBest={result.newBest}
            stats={[
              { label: 'Oleada', value: result.wave },
              { label: 'Bajas', value: result.kills },
              { label: 'Precisión', value: `${result.accuracy}%` },
              { label: 'Arma favorita', value: result.favorite },
              { label: 'Tiempo', value: fmtTime(result.time) },
            ]}
            onRestart={start}
            hint="o pulsa ESPACIO"
            touchHint="Juega otra vez"
          />
        </div>
      )}

      {/* ---------------- aviso de orientación */}
      {showPortraitWarn && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-[#0a0505]/95 px-8 text-center">
          <style>{`@keyframes b93rot{0%,20%{transform:rotate(0)}50%,80%{transform:rotate(-90deg)}100%{transform:rotate(0)}}`}</style>
          <svg viewBox="0 0 64 64" className="size-20" style={{ animation: 'b93rot 2.4s ease-in-out infinite' }}>
            <rect x="20" y="6" width="24" height="52" rx="5" fill="none" stroke={ACCENT} strokeWidth="3" />
            <rect x="28" y="51" width="8" height="2" rx="1" fill={ACCENT} />
          </svg>
          <p className="text-sm leading-relaxed" style={{ ...pixel, color: ACCENT }}>
            GIRA TU CELULAR
          </p>
          <p className="max-w-xs text-sm text-white/70">Búnker 93 se juega con el celular acostado.</p>
        </div>
      )}
    </div>
  )
}
