'use client'

/** Pantallas de menú de Sunset Run (React sobre el canvas). Navegables con teclado, mouse y toque. */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LogicalKey } from '../use-keys'
import { CARS, CUPS, MAX_LVL, PERS_LABEL, STATIONS, THEMES, TODS, UPGRADES, type CarModel, type CarColors, type BodyStyle, type Personality, type UpgradeId, type Upgrades } from './data'
import { carFrames } from './sprites'
import { fmtTime } from './util'

export type Nav = (k: LogicalKey) => void
type SetNav = (fn: Nav | null) => void

const pixel = { fontFamily: 'var(--font-pixel)' }
const ACC = '#f97316'

function useNav(setNav: SetNav, fn: Nav) {
  useEffect(() => {
    setNav(fn)
    return () => setNav(null)
  })
}

function carImage(body: BodyStyle, colors: CarColors): string {
  try {
    return carFrames(body, colors, false).frames[0][0].toDataURL()
  } catch {
    return ''
  }
}

function CarPic({ body, colors, className }: { body: BodyStyle; colors: CarColors; className?: string }) {
  const src = useMemo(() => carImage(body, colors), [body, colors])
  if (!src) return null
  return <img src={src} alt="" className={className} style={{ imageRendering: 'pixelated' }} draggable={false} />
}

function Shell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`absolute inset-0 z-20 overflow-y-auto overscroll-contain ${className}`}>
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4">{children}</div>
    </div>
  )
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#0c0912]/[0.86] p-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] sm:p-4 ${className}`}
    >
      {children}
    </div>
  )
}

function Btn({
  children,
  onClick,
  active,
  primary,
  className = '',
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
  primary?: boolean
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.currentTarget.blur()
        onClick()
      }}
      className={`rounded-full px-5 py-2 text-sm font-semibold transition active:scale-95 disabled:opacity-40 ${
        primary ? 'text-black' : 'text-white'
      } ${active ? 'ring-2 ring-white/80' : ''} ${className}`}
      style={
        primary
          ? { background: `linear-gradient(180deg, #fdba74, ${ACC})`, boxShadow: `0 0 22px ${ACC}66` }
          : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }
      }
    >
      {children}
    </button>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.currentTarget.blur()
        onChange(!on)
      }}
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80"
    >
      <span className={`relative h-4 w-7 rounded-full transition ${on ? 'bg-orange-500' : 'bg-white/20'}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

function Logo({ small }: { small?: boolean }) {
  return (
    <div className="select-none text-center">
      <p
        className={small ? 'text-lg sm:text-xl' : 'text-2xl sm:text-4xl'}
        style={{
          ...pixel,
          background: 'linear-gradient(180deg, #fff7c2 0%, #fdba74 35%, #f97316 60%, #ec4899 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: 'drop-shadow(3px 3px 0 #2a0f3c) drop-shadow(0 0 18px rgba(249,115,22,0.55))',
          letterSpacing: '0.04em',
        }}
      >
        SUNSET RUN
      </p>
    </div>
  )
}

// ===================== Título =====================

export function TitleScreen({
  best,
  touch,
  auto,
  setAuto,
  tilt,
  setTilt,
  onStart,
  setNav,
}: {
  best: number
  touch: boolean
  auto: boolean
  setAuto: (v: boolean) => void
  tilt: boolean
  setTilt: (v: boolean) => void
  onStart: () => void
  setNav: SetNav
}) {
  useNav(setNav, (k) => {
    if (k === 'action' || k === 'up') onStart()
  })
  return (
    <Shell className="bg-[radial-gradient(ellipse_at_center,rgba(8,4,16,0.72)_0%,rgba(8,4,16,0.35)_55%,transparent_80%)]">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo />
        <p className="text-[9px] tracking-widest text-orange-200/90 sm:text-[10px]" style={pixel}>
          COPA DE CARRERAS AL ATARDECER
        </p>
        <p className="max-w-md text-xs leading-relaxed text-white/75 sm:text-sm">
          Elige coche y estación de radio, gana dinero en cada carrera, mejora tu máquina en el taller y conquista tres copas contra siete rivales.
        </p>
        <Btn primary onClick={onStart} className="px-8 py-2.5 text-base">
          Arrancar
        </Btn>
        {touch && (
          <div className="flex flex-wrap justify-center gap-2">
            <Toggle label="Acelerar solo" on={auto} onChange={setAuto} />
            <Toggle label="Girar inclinando" on={tilt} onChange={setTilt} />
          </div>
        )}
        <p className="blink text-[9px] text-white/60" style={pixel}>
          {touch ? 'TOCA ARRANCAR' : 'PULSA ESPACIO'}
        </p>
        {best > 0 && (
          <p className="text-xs text-white/50 tabular-nums">Récord {best.toLocaleString('es-MX')}</p>
        )}
      </div>
    </Shell>
  )
}

// ===================== Elegir coche =====================

function StatBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[10px] text-white/60 sm:w-20 sm:text-[11px]">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="h-2 w-3 rounded-[2px] sm:w-4" style={{ background: i <= v ? ACC : 'rgba(255,255,255,0.12)' }} />
        ))}
      </div>
    </div>
  )
}

export function CarSelect({
  sel,
  setSel,
  onConfirm,
  onBack,
  setNav,
}: {
  sel: number
  setSel: (i: number) => void
  onConfirm: () => void
  onBack: () => void
  setNav: SetNav
}) {
  useNav(setNav, (k) => {
    if (k === 'left') setSel((sel + CARS.length - 1) % CARS.length)
    else if (k === 'right') setSel((sel + 1) % CARS.length)
    else if (k === 'action') onConfirm()
    else if (k === 'action2') onBack()
  })
  const car = CARS[sel]
  return (
    <Shell>
      <Panel className="w-full max-w-3xl">
        <p className="mb-2 text-center text-[10px] text-orange-300 sm:text-xs" style={pixel}>
          ELIGE TU COCHE
        </p>
        <div className="grid grid-cols-4 gap-2">
          {CARS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                if (i === sel) onConfirm()
                else setSel(i)
              }}
              className={`flex flex-col items-center rounded-xl border p-1.5 transition ${
                i === sel ? 'border-orange-400 bg-orange-500/15 shadow-[0_0_18px_rgba(249,115,22,0.35)]' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <CarPic body={c.body} colors={c.colors} className="h-9 w-auto sm:h-12" />
              <span className="mt-1 text-[8px] leading-tight sm:text-[9px]" style={pixel}>
                {c.name.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-center">
          <CarPic body={car.body} colors={car.colors} className="h-16 w-auto sm:h-24" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{car.name}</p>
            <p className="mb-2 text-xs text-white/60">{car.tag}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <StatBar label="Velocidad" v={car.stats.vel} />
              <StatBar label="Aceleración" v={car.stats.acc} />
              <StatBar label="Manejo" v={car.stats.man} />
              <StatBar label="Nitro" v={car.stats.nit} />
            </div>
          </div>
          <Btn primary onClick={onConfirm}>
            Elegir
          </Btn>
        </div>
      </Panel>
    </Shell>
  )
}

// ===================== Radio =====================

export function RadioSelect({
  sel,
  setSel,
  onConfirm,
  setNav,
}: {
  sel: number
  setSel: (i: number) => void
  onConfirm: () => void
  setNav: SetNav
}) {
  const opts = STATIONS.length + 1
  const idx = sel < 0 ? STATIONS.length : sel
  const to = (i: number) => setSel(i === STATIONS.length ? -1 : i)
  useNav(setNav, (k) => {
    if (k === 'left' || k === 'up') to((idx + opts - 1) % opts)
    else if (k === 'right' || k === 'down') to((idx + 1) % opts)
    else if (k === 'action') onConfirm()
  })
  const st = sel >= 0 ? STATIONS[sel] : null
  return (
    <Shell>
      <Panel className="w-full max-w-2xl">
        <p className="mb-2 text-center text-[10px] text-orange-300 sm:text-xs" style={pixel}>
          ELIGE TU MUSICA
        </p>
        {/* dial */}
        <div className="relative mx-auto mb-3 rounded-xl border border-white/10 bg-gradient-to-b from-[#1b1426] to-[#0b0810] p-3 shadow-inner">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl tabular-nums sm:text-3xl" style={{ ...pixel, color: st?.color ?? '#6b7280', textShadow: `0 0 12px ${st?.color ?? '#000'}` }}>
              {st ? st.freq : '--.-'}
            </span>
            <span className="text-[10px] text-white/50" style={pixel}>
              FM
            </span>
          </div>
          <p className="mt-1 text-xs text-white/70">{st ? `${st.name} · ${st.style}` : 'Radio apagada: solo el rugido del motor.'}</p>
          <div className="relative mt-2 h-3 rounded bg-black/50">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <span key={i} className="absolute top-0 h-1.5 w-px bg-white/30" style={{ left: `${i * 10}%` }} />
            ))}
            <span
              className="absolute -top-1 h-5 w-1 rounded bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] transition-all duration-300"
              style={{ left: `${st ? ((parseFloat(st.freq) - 87) / 16) * 100 : 2}%` }}
            />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[...STATIONS, null].map((s, i) => (
            <button
              key={s?.id ?? 'off'}
              type="button"
              onClick={(e) => {
                e.currentTarget.blur()
                if (i === idx) onConfirm()
                else to(i)
              }}
              className={`rounded-lg border px-1 py-2 text-center transition ${
                i === idx ? 'border-orange-400 bg-orange-500/15' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <span className="block text-[8px] leading-tight sm:text-[9px]" style={{ ...pixel, color: s?.color ?? '#9ca3af' }}>
                {s ? s.name : 'APAGADA'}
              </span>
              <span className="mt-1 block text-[10px] text-white/50">{s ? s.freq : '—'}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[11px] text-white/50">Cámbiala en carrera con R o el botón RADIO.</p>
          <Btn primary onClick={onConfirm}>
            ¡A correr!
          </Btn>
        </div>
      </Panel>
    </Shell>
  )
}

// ===================== Presentación de pista =====================

export interface Standing {
  idx: number
  name: string
  pts: number
  player: boolean
  body: BodyStyle
  colors: CarColors
  pers: Personality | 'player'
}

export function TrackIntro({
  cup,
  race,
  gridPos,
  standings,
  touch,
  onGo,
  setNav,
}: {
  cup: number
  race: number
  gridPos: number
  standings: Standing[]
  touch: boolean
  onGo: () => void
  setNav: SetNav
}) {
  useNav(setNav, (k) => {
    if (k === 'action' || k === 'up') onGo()
  })
  const c = CUPS[cup]
  const t = c.tracks[race]
  const lead = standings[0]
  const me = standings.findIndex((s) => s.player) + 1
  return (
    <Shell className="bg-gradient-to-t from-black/60 via-transparent to-black/40">
      <Panel className="w-full max-w-md text-center">
        <p className="text-[9px] sm:text-[10px]" style={{ ...pixel, color: c.color }}>
          {c.name.toUpperCase()} · CARRERA {race + 1}/4
        </p>
        <p className="mt-2 text-xl font-semibold sm:text-2xl">{t.name}</p>
        <p className="text-xs text-white/60">
          {THEMES[t.theme].name} · {TODS[t.tod].name} · {t.laps} vueltas
        </p>
        <div className="mt-3 flex justify-center gap-5 text-xs">
          <div>
            <p className="text-white/50">Sales</p>
            <p className="text-lg font-semibold tabular-nums" style={{ color: ACC }}>
              {gridPos}º
            </p>
          </div>
          {race > 0 && (
            <>
              <div>
                <p className="text-white/50">Campeonato</p>
                <p className="text-lg font-semibold tabular-nums">{me}º</p>
              </div>
              <div>
                <p className="text-white/50">Líder</p>
                <p className="text-sm font-semibold">
                  {lead.player ? 'Tú' : lead.name} · {lead.pts} pts
                </p>
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/55">
          {touch
            ? 'Toca FRENO un instante al girar en curva para derrapar y cargar nitro.'
            : 'Suelta ↑ o toca ↓ en plena curva para derrapar y cargar nitro. Espacio = nitro. Acelera justo en el verde para una salida perfecta.'}
        </p>
        <Btn primary onClick={onGo} className="mt-3">
          A la parrilla
        </Btn>
      </Panel>
    </Shell>
  )
}

// ===================== Resultados =====================

export interface ResultRow {
  idx: number
  name: string
  time: number
  pts: number
  player: boolean
  body: BodyStyle
  colors: CarColors
}
export interface RaceResult {
  rows: ResultRow[]
  pos: number
  prize: number
  coinMoney: number
  overtakeMoney: number
  overtakes: number
  scorePts: number
  scoreOver: number
  scoreTime: number
  scoreDrift: number
  bestLap: number
}

export function Results({
  res,
  standings,
  last,
  onNext,
  setNav,
}: {
  res: RaceResult
  standings: Standing[]
  last: boolean
  onNext: () => void
  setNav: SetNav
}) {
  useNav(setNav, (k) => {
    if (k === 'action') onNext()
  })
  const total = res.prize + res.coinMoney + res.overtakeMoney
  const gained = res.scorePts + res.scoreOver + res.scoreTime + res.scoreDrift
  return (
    <Shell className="bg-black/30">
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2 sm:grid-cols-[1.25fr_1fr]">
        <Panel className="py-2">
          <p className="mb-1 text-[10px]" style={{ ...pixel, color: res.pos <= 3 ? '#facc15' : ACC }}>
            {res.pos === 1 ? '¡VICTORIA!' : `LLEGASTE ${res.pos}º`}
          </p>
          <table className="w-full text-[11px] sm:text-xs">
            <tbody>
              {res.rows.map((r, i) => (
                <tr key={r.idx} className={r.player ? 'text-orange-300' : 'text-white/85'}>
                  <td className="w-5 py-[1px] tabular-nums text-white/50">{i + 1}</td>
                  <td className="w-9 py-[1px]">
                    <CarPic body={r.body} colors={r.colors} className="h-3.5 w-auto" />
                  </td>
                  <td className="py-[1px] font-medium">{r.player ? 'Tú' : r.name}</td>
                  <td className="py-[1px] text-right tabular-nums text-white/60">{fmtTime(r.time)}</td>
                  <td className="w-10 py-[1px] text-right tabular-nums">+{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel className="flex flex-col gap-2 py-2">
          <div>
            <p className="text-[9px] text-white/50" style={pixel}>
              DINERO GANADO
            </p>
            <div className="mt-1 space-y-0.5 text-xs">
              <Row k={`Premio ${res.pos}º`} v={`$${res.prize.toLocaleString('es-MX')}`} />
              <Row k="Monedas" v={`$${res.coinMoney.toLocaleString('es-MX')}`} />
              <Row k={`Rebases (${res.overtakes})`} v={`$${res.overtakeMoney.toLocaleString('es-MX')}`} />
              <Row k="Total" v={`$${total.toLocaleString('es-MX')}`} strong />
            </div>
          </div>
          <div>
            <p className="text-[9px] text-white/50" style={pixel}>
              PUNTUACION
            </p>
            <div className="mt-1 space-y-0.5 text-xs">
              <Row k="Campeonato" v={`+${res.scorePts}`} />
              <Row k="Rebases" v={`+${res.scoreOver}`} />
              <Row k="Derrapes" v={`+${res.scoreDrift}`} />
              <Row k="Bono de tiempo" v={`+${res.scoreTime}`} />
              <Row k="Esta carrera" v={`+${gained.toLocaleString('es-MX')}`} strong />
            </div>
          </div>
          <div className="text-[11px] text-white/50">
            Mejor vuelta {fmtTime(res.bestLap)} · Campeonato: {standings.findIndex((s) => s.player) + 1}º con {standings.find((s) => s.player)?.pts ?? 0} pts
          </div>
          <Btn primary onClick={onNext}>
            {last ? 'Ver podio' : 'Ir al taller'}
          </Btn>
        </Panel>
      </div>
    </Shell>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'border-t border-white/10 pt-0.5 font-semibold text-orange-300' : 'text-white/80'}`}>
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  )
}

// ===================== Taller =====================

export function Garage({
  money,
  up,
  car,
  standings,
  onBuy,
  onNext,
  nextLabel,
  setNav,
}: {
  money: number
  up: Upgrades
  car: CarModel
  standings: Standing[]
  onBuy: (id: UpgradeId) => boolean
  onNext: () => void
  nextLabel: string
  setNav: SetNav
}) {
  const [focus, setFocus] = useState(0)
  const n = UPGRADES.length + 1
  useNav(setNav, (k) => {
    if (k === 'up' || k === 'left') setFocus((focus + n - 1) % n)
    else if (k === 'down' || k === 'right') setFocus((focus + 1) % n)
    else if (k === 'action') {
      if (focus === UPGRADES.length) onNext()
      else onBuy(UPGRADES[focus].id)
    }
  })
  return (
    <Shell className="bg-black/35">
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2 sm:grid-cols-[1.5fr_1fr]">
        <Panel className="py-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] text-orange-300" style={pixel}>
              TALLER
            </p>
            <p className="text-sm font-semibold tabular-nums text-amber-300">${money.toLocaleString('es-MX')}</p>
          </div>
          <div className="space-y-1">
            {UPGRADES.map((u, i) => {
              const lvl = up[u.id]
              const maxed = lvl >= MAX_LVL
              const cost = maxed ? 0 : u.costs[lvl]
              const can = !maxed && money >= cost
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur()
                    setFocus(i)
                    onBuy(u.id)
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left transition ${
                    focus === i ? 'border-orange-400 bg-orange-500/10' : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{u.name}</span>
                      <span className="flex gap-0.5">
                        {Array.from({ length: MAX_LVL }, (_, j) => (
                          <span key={j} className="h-1.5 w-3 rounded-sm" style={{ background: j < lvl ? ACC : 'rgba(255,255,255,0.14)' }} />
                        ))}
                      </span>
                    </div>
                    <p className="truncate text-[10px] text-white/55">{u.desc}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                      maxed ? 'bg-white/10 text-white/50' : can ? 'bg-amber-400 text-black' : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {maxed ? 'MÁX' : `$${cost.toLocaleString('es-MX')}`}
                  </span>
                </button>
              )
            })}
          </div>
        </Panel>
        <Panel className="flex flex-col gap-2 py-2">
          <div className="flex items-center gap-2">
            <CarPic body={car.body} colors={car.colors} className="h-8 w-auto" />
            <p className="text-xs font-semibold">{car.name}</p>
          </div>
          <p className="text-[9px] text-white/50" style={pixel}>
            CAMPEONATO
          </p>
          <div className="space-y-0.5 text-[11px]">
            {standings.map((s, i) => (
              <div key={s.idx} className={`flex justify-between ${s.player ? 'text-orange-300' : 'text-white/75'}`}>
                <span>
                  <span className="mr-1.5 tabular-nums text-white/40">{i + 1}</span>
                  {s.player ? 'Tú' : s.name}
                  {!s.player && <span className="ml-1 text-white/35">· {PERS_LABEL[s.pers as Personality]}</span>}
                </span>
                <span className="tabular-nums">{s.pts}</span>
              </div>
            ))}
          </div>
          <Btn primary active={focus === UPGRADES.length} onClick={onNext} className="mt-auto">
            {nextLabel}
          </Btn>
        </Panel>
      </div>
    </Shell>
  )
}

// ===================== Podio =====================

export function PodiumPanel({
  cup,
  standings,
  advance,
  final,
  onNext,
  setNav,
}: {
  cup: number
  standings: Standing[]
  advance: boolean
  final: boolean
  onNext: () => void
  setNav: SetNav
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 2200)
    return () => clearTimeout(id)
  }, [])
  useNav(setNav, (k) => {
    if (k === 'action' && ready) onNext()
  })
  const c = CUPS[cup]
  const me = standings.findIndex((s) => s.player) + 1
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-between p-2 sm:p-4">
      <div className="text-center">
        <p className="text-[10px] sm:text-xs" style={{ ...pixel, color: c.color }}>
          {c.name.toUpperCase()}
        </p>
        <p className="mt-1 text-base sm:text-xl" style={{ ...pixel, color: me === 1 ? '#facc15' : '#fff', textShadow: '3px 3px 0 #000' }}>
          {me === 1 ? 'CAMPEON!' : me <= 3 ? `${me}º LUGAR` : `${me}º LUGAR`}
        </p>
        <p className="mt-1 text-xs text-white/75">
          {me <= 3 ? (final ? 'Terminaste las tres copas. ¡Leyenda del asfalto!' : 'Subiste al podio: pasas a la siguiente copa.') : 'Necesitabas quedar entre los tres primeros.'}
        </p>
      </div>
      <div className="pointer-events-auto flex w-full items-end justify-between gap-2">
        <div className="rounded-xl border border-white/10 bg-black/70 px-2 py-1 text-[10px] sm:text-[11px]">
          {standings.slice(0, 8).map((s, i) => (
            <div key={s.idx} className={`flex justify-between gap-4 ${s.player ? 'text-orange-300' : 'text-white/75'}`}>
              <span>
                <span className="mr-1 tabular-nums text-white/40">{i + 1}</span>
                {s.player ? 'Tú' : s.name}
              </span>
              <span className="tabular-nums">{s.pts}</span>
            </div>
          ))}
        </div>
        <Btn primary onClick={onNext} disabled={!ready}>
          {advance && !final ? 'Siguiente copa' : 'Ver resultado'}
        </Btn>
      </div>
    </div>
  )
}

// ===================== Pausa =====================

export function PauseMenu({
  station,
  touch,
  auto,
  setAuto,
  tilt,
  setTilt,
  onResume,
  onRadio,
  onQuit,
  setNav,
}: {
  station: number
  touch: boolean
  auto: boolean
  setAuto: (v: boolean) => void
  tilt: boolean
  setTilt: (v: boolean) => void
  onResume: () => void
  onRadio: () => void
  onQuit: () => void
  setNav: SetNav
}) {
  useNav(setNav, (k) => {
    if (k === 'action') onResume()
  })
  const st = station >= 0 ? STATIONS[station] : null
  return (
    <Shell>
      <Panel className="mt-12 flex w-full max-w-sm flex-col items-center gap-2 text-center">
        <p className="text-[10px] text-white/60">Radio: {st ? `${st.freq} ${st.name}` : 'apagada'}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Btn primary onClick={onResume}>
            Continuar
          </Btn>
          <Btn onClick={onRadio}>Cambiar radio</Btn>
          <Btn onClick={onQuit}>Abandonar</Btn>
        </div>
        {touch && (
          <div className="flex flex-wrap justify-center gap-2">
            <Toggle label="Acelerar solo" on={auto} onChange={setAuto} />
            <Toggle label="Girar inclinando" on={tilt} onChange={setTilt} />
          </div>
        )}
        <p className="text-[10px] text-white/45">{touch ? 'Toca Continuar' : 'P o Espacio para continuar'}</p>
      </Panel>
    </Shell>
  )
}
