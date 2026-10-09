'use client'

/**
 * Sunset Run: carreras pseudo 3D al atardecer estilo OutRun / Top Gear.
 * Copas de 4 pistas contra 7 rivales con IA, taller de mejoras entre
 * carreras, radio con 4 estaciones originales y controles táctiles en
 * horizontal. El código del juego vive en ./sunset-run/.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeys, type LogicalKey } from './use-keys'
import { GameOverOverlay, useIsTouch } from './overlay'
import { Juice } from './juice'
import { loadBest, saveBest } from './game-utils'
import { ACCENT, CARS, CUPS, GAME_ID, POINTS, PRIZE, RIVALS, STATIONS, UPGRADES, noUpgrades, type UpgradeId, type Upgrades } from './sunset-run/data'
import { buildTrack, type Track } from './sunset-run/track'
import { computeStats, finalOrder, newRace, stepRace, type Fx, type Input, type Race } from './sunset-run/race'
import { Renderer, VIEW_H } from './sunset-run/render'
import { drawHud, drawPause, drawPodium, makeMinimap, newPodium, type HudState, type PodiumState } from './sunset-run/hud'
import { SunsetAudio } from './sunset-run/audio'
import { carFrames } from './sunset-run/sprites'
import { RotateNotice, TouchControls, requestTilt, usePortraitTouch, useTilt } from './sunset-run/touch'
import {
  CarSelect,
  Garage,
  PauseMenu,
  PodiumPanel,
  RadioSelect,
  Results,
  TitleScreen,
  TrackIntro,
  type Nav,
  type RaceResult,
  type Standing,
} from './sunset-run/screens'

type Screen = 'title' | 'car' | 'radio' | 'intro' | 'race' | 'results' | 'garage' | 'podium' | 'over'

interface Camp {
  car: number
  cup: number
  race: number
  money: number
  up: Upgrades
  pts: number[]
  score: number
  cupsWon: number
  podiums: number
  bestPos: number
  overtakes: number
  races: number
  cupRank: number
  victory: boolean
  newBest: boolean
}

const newCamp = (car: number): Camp => ({
  car,
  cup: 0,
  race: 0,
  money: 0,
  up: noUpgrades(),
  pts: Array(8).fill(0),
  score: 0,
  cupsWon: 0,
  podiums: 0,
  bestPos: 9,
  overtakes: 0,
  races: 0,
  cupRank: 0,
  victory: false,
  newBest: false,
})

function standingsOf(c: Camp): Standing[] {
  const car = CARS[c.car]
  const all: Standing[] = [
    { idx: 0, name: 'Tú', pts: c.pts[0], player: true, body: car.body, colors: car.colors, pers: 'player' },
    ...RIVALS.map((r, i) => ({ idx: i + 1, name: r.name, pts: c.pts[i + 1], player: false, body: r.body, colors: r.colors, pers: r.pers })),
  ]
  return all.sort((a, b) => b.pts - a.pts || (a.player ? -1 : b.player ? 1 : a.idx - b.idx))
}

interface Actions {
  toCar: () => void
  toRadio: () => void
  toTitle: () => void
  selectCar: (i: number) => void
  selectStation: (i: number) => void
  start: () => void
  grid: () => void
  resultsNext: () => void
  buy: (id: UpgradeId) => boolean
  garageNext: () => void
  podiumNext: () => void
  restart: () => void
  quit: () => void
  resume: () => void
  radio: () => void
}

const noop = () => {}

export default function SunsetRun() {
  const { pressedRef, justPressedRef, virtualPress, virtualRelease } = useKeys()
  const areaRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null)
  const [screen, setScreen] = useState<Screen>('title')
  const [carSel, setCarSel] = useState(0)
  const [station, setStation] = useState(0)
  const [camp, setCamp] = useState<Camp>(() => newCamp(0))
  const [result, setResult] = useState<RaceResult | null>(null)
  const [best, setBest] = useState(() => loadBest(GAME_ID))
  const [paused, setPaused] = useState(false)
  const [auto, setAuto] = useState(true)
  const [tilt, setTiltState] = useState(false)
  const touch = useIsTouch()
  const portrait = usePortraitTouch()
  const navRef = useRef<Nav | null>(null)
  const setNav = useCallback((fn: Nav | null) => {
    navRef.current = fn
  }, [])
  const tiltRef = useRef<number | null>(null)
  useTilt(tilt, tiltRef)
  // dirección analógica del pulgar en el pad táctil (null si no hay dedo)
  const touchSteerRef = useRef<number | null>(null)
  const setTouchSteer = useCallback((v: number | null) => {
    touchSteerRef.current = v
  }, [])
  const autoRef = useRef(auto)
  autoRef.current = auto
  const touchRef = useRef(touch)
  touchRef.current = touch
  const act = useRef<Actions>({
    toCar: noop,
    toRadio: noop,
    toTitle: noop,
    selectCar: noop,
    selectStation: noop,
    start: noop,
    grid: noop,
    resultsNext: noop,
    buy: () => false,
    garageNext: noop,
    podiumNext: noop,
    restart: noop,
    quit: noop,
    resume: noop,
    radio: noop,
  })

  const setTilt = useCallback((v: boolean) => {
    if (!v) {
      setTiltState(false)
      return
    }
    void requestTilt().then((ok) => setTiltState(ok))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const area = areaRef.current
    if (!canvas || !area) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const font = (() => {
      const v = getComputedStyle(document.body).getPropertyValue('--font-pixel').trim()
      return `${v ? v + ', ' : ''}"Press Start 2P", monospace`
    })()

    const R = new Renderer(ctx)
    const audio = new SunsetAudio()
    const juice = new Juice(7)
    const hud: HudState = { banner: null, radio: null, touch: touchRef.current, font }
    let scr: Screen = 'title'
    let isPaused = false
    let race: Race | null = null
    let track: Track | null = null
    let map: HTMLCanvasElement | null = null
    let podium: PodiumState | null = null
    let C = newCamp(0)
    let sel = 0
    let st = 0
    let raceDone = false
    let quality = Math.min(window.devicePixelRatio || 1, 2)
    let stackT = -1
    let stackN = 0
    let time = 0
    let scale = 1

    // ---------- tamaño ----------
    const resize = () => {
      const r = area.getBoundingClientRect()
      const aw = Math.max(1, r.width)
      const ah = Math.max(1, r.height)
      let w = aw
      let h = ah
      const a = aw / ah
      if (a > 2.4) w = h * 2.4
      else if (a < 1.3) h = w / 1.3
      w = Math.floor(w)
      h = Math.floor(h)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      canvas.width = Math.round(w * quality)
      canvas.height = Math.round(h * quality)
      scale = canvas.height / VIEW_H
      R.W = Math.round((VIEW_H * w) / h)
      ctx.imageSmoothingEnabled = false
      setStage((s) => (s && s.w === w && s.h === h ? s : { w, h }))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(area)

    // ---------- efectos ----------
    const fx: Fx = {
      sound: (id) => audio.sfx(id),
      shake: (a) => juice.shake(a),
      flash: (c, a) => juice.flash(c, a),
      freeze: (ms) => juice.freeze(ms),
      text: (t, c, s = 10) => {
        // apila los textos que salen casi a la vez
        stackN = time - stackT < 0.45 ? stackN + 1 : 0
        stackT = time
        juice.text(R.px, R.py - R.pw * 0.35 - stackN * 14, t, c, s, 1.1)
      },
      banner: (text, sub, color, dur) => {
        hud.banner = { text, sub, color, t: 0, dur }
      },
      burst: (kind, side = 0) => {
        const x = R.px
        const y = R.py
        const w = R.pw
        if (kind === 'spark') juice.burst(x + side * w * 0.45, y + w * 0.12, ['#fff7a8', '#ffb347', '#ffffff'], { count: 6, speed: 170, life: 0.3, size: 2, gravity: 320, angle: -Math.PI / 2, arc: 2.6 })
        else if (kind === 'debris') {
          const body = race ? race.cars[0].colors.body : '#ffffff'
          juice.burst(x, y, ['#ffffff', body, '#9ca3af', '#facc15'], { count: 26, speed: 230, life: 0.65, size: 3, gravity: 420 })
        } else if (kind === 'shield') juice.burst(x, y, ['#a5f3fc', '#22d3ee', '#ffffff'], { count: 22, speed: 200, life: 0.5, size: 3 })
        else if (kind === 'coin') juice.burst(x, y - w * 0.2, ['#fde047', '#facc15', '#ffffff'], { count: 8, speed: 120, life: 0.4, size: 2, angle: -Math.PI / 2, arc: 2 })
        else if (kind === 'nitro') juice.burst(x, y, ['#93c5fd', '#3b82f6', '#ffffff'], { count: 16, speed: 160, life: 0.45, size: 3 })
        else juice.burst(x, y + w * 0.15, ['#fb923c', '#60a5fa', '#ffffff'], { count: 14, speed: 140, life: 0.4, size: 2, angle: Math.PI / 2, arc: 1.6 })
      },
      carBurst: (c, kind) => {
        juice.burst(c.sx, c.sy, kind === 'shield' ? ['#a5f3fc', '#22d3ee', '#ffffff'] : ['#fff7a8', '#ffb347'], { count: 16, speed: 180, life: 0.45, size: 3 })
      },
    }
    const nullFx: Fx = { sound: noop, shake: noop, flash: noop, freeze: noop, text: noop, banner: noop, burst: noop, carBurst: noop }

    // ---------- escenas ----------
    const gridFor = (camp: Camp): number[] => {
      if (camp.race === 0) {
        const r = [1, 2, 3, 4, 5, 6, 7].sort((a, b) => ((a * 7 + camp.cup * 3) % 8) - ((b * 7 + camp.cup * 3) % 8))
        return [...r, 0]
      }
      // el líder del campeonato sale al final
      return standingsOf(camp)
        .map((s) => s.idx)
        .reverse()
    }

    const setupAttract = () => {
      track = buildTrack(0, 0)
      race = newRace(track, CARS[sel], noUpgrades(), [1, 2, 3, 0, 4, 5, 6, 7], true)
      race.laps = 99
      race.phase = 'racing'
      race.count = 0
      for (const c of race.cars) c.startDelay = 0
      race.cars[0].speed = race.stats.top * 0.6
      for (let i = 1; i < race.cars.length; i++) race.cars[i].speed = race.cars[i].top * 0.6
      R.setTrack(track, race)
      map = null
      podium = null
      // avanzar un poco para que arranque en movimiento
      for (let i = 0; i < 90; i++) stepRace(race, idleInput, 1 / 60, nullFx)
    }

    const idleInput: Input = { up: false, down: false, left: false, right: false, nitro: false, steer: null, auto: false }

    const go = (s: Screen) => {
      scr = s
      setScreen(s)
      navRef.current = null
    }

    const loadRace = () => {
      track = buildTrack(C.cup, C.race)
      race = newRace(track, CARS[C.car], C.up, gridFor(C))
      R.setTrack(track, race)
      map = makeMinimap(track, 70)
      podium = null
      raceDone = false
      hud.banner = null
      juice.reset()
      setCamp({ ...C })
      go('intro')
    }

    const showRadio = () => {
      const s = STATIONS[st]
      hud.radio = s ? { name: s.name, freq: s.freq, color: s.color, t: 3.5 } : { name: 'RADIO APAGADA', freq: '', color: '#9ca3af', t: 2.5 }
    }

    const finishRace = () => {
      if (!race || !track) return
      raceDone = true
      const order = finalOrder(race)
      const cup = C.cup
      const rows = order.map((c, i) => ({ idx: c.idx, name: c.name, time: c.finishT, pts: POINTS[i], player: c.player, body: c.body, colors: c.colors }))
      rows.forEach((r) => (C.pts[r.idx] += r.pts))
      const pos = rows.findIndex((r) => r.player) + 1
      const prize = Math.round(PRIZE[pos - 1] * (1 + cup * 0.3))
      const coinMoney = race.coins * (20 + cup * 6)
      const overtakeMoney = race.overtakes * 30
      C.money += prize + coinMoney + overtakeMoney
      const par = (race.laps * track.N) / 44
      const pTime = order.find((c) => c.player)?.finishT ?? race.t
      const res: RaceResult = {
        rows,
        pos,
        prize,
        coinMoney,
        overtakeMoney,
        overtakes: race.overtakes,
        scorePts: POINTS[pos - 1] * 100 * (1 + cup),
        scoreOver: race.overtakes * 50,
        scoreTime: Math.max(0, Math.round((par - pTime) * 25)),
        scoreDrift: race.driftPts,
        bestLap: race.lapTimes.length ? Math.min(...race.lapTimes) : 0,
      }
      C.score += res.scorePts + res.scoreOver + res.scoreTime + res.scoreDrift
      C.bestPos = Math.min(C.bestPos, pos)
      C.overtakes += race.overtakes
      C.races++
      race.auto = true
      audio.stopEngine()
      setResult(res)
      setCamp({ ...C })
      go('results')
    }

    const endCup = () => {
      const stds = standingsOf(C)
      const rank = stds.findIndex((s) => s.player) + 1
      C.cupRank = rank
      if (rank === 1) C.cupsWon++
      if (rank <= 3) {
        C.podiums++
        C.score += [3000, 1500, 800][rank - 1] * (C.cup + 1)
        C.money += [2500, 1500, 800][rank - 1]
      }
      podium = newPodium()
      audio.sfx(rank <= 3 ? 'podium' : 'gameover')
      setCamp({ ...C })
      go('podium')
    }

    const gameOver = () => {
      audio.stopEngine()
      const nb = saveBest(GAME_ID, C.score)
      C.newBest = nb
      setBest(Math.max(loadBest(GAME_ID), C.score))
      setCamp({ ...C })
      isPaused = false
      setPaused(false)
      go('over')
    }

    act.current = {
      toTitle: () => {
        audio.sfx('select')
        go('title')
      },
      toCar: () => {
        audio.unlock()
        audio.setPlaying(true)
        audio.sfx('select')
        go('car')
      },
      toRadio: () => {
        audio.sfx('select')
        go('radio')
      },
      selectCar: (i) => {
        sel = i
        setCarSel(i)
        audio.sfx('move')
        if (race && race.auto && (scr === 'car' || scr === 'title')) {
          const c = race.cars[0]
          c.body = CARS[i].body
          c.colors = CARS[i].colors
          race.model = CARS[i]
          race.stats = computeStats(CARS[i], noUpgrades())
          R.setCars(race)
        }
      },
      selectStation: (i) => {
        st = i
        setStation(i)
        audio.setStation(i)
      },
      start: () => {
        audio.sfx('start')
        C = newCamp(sel)
        loadRace()
      },
      grid: () => {
        if (!race) return
        audio.sfx('select')
        audio.startEngine()
        showRadio()
        go('race')
      },
      resultsNext: () => {
        audio.sfx('select')
        if (C.race >= 3) endCup()
        else go('garage')
      },
      buy: (id) => {
        const u = UPGRADES.find((x) => x.id === id)
        if (!u) return false
        const lvl = C.up[id]
        if (lvl >= u.costs.length || C.money < u.costs[lvl]) {
          audio.sfx('deny')
          return false
        }
        C.money -= u.costs[lvl]
        C.up = { ...C.up, [id]: lvl + 1 }
        audio.sfx('buy')
        setCamp({ ...C })
        return true
      },
      garageNext: () => {
        audio.sfx('select')
        if (C.race >= 3) {
          C.cup++
          C.race = 0
          C.pts = Array(8).fill(0)
        } else C.race++
        loadRace()
      },
      podiumNext: () => {
        audio.sfx('select')
        if (C.cupRank <= 3 && C.cup < CUPS.length - 1) {
          go('garage')
        } else {
          C.victory = C.cupRank <= 3
          gameOver()
        }
      },
      restart: () => {
        audio.sfx('start')
        C = newCamp(sel)
        loadRace()
      },
      quit: () => {
        gameOver()
      },
      resume: () => {
        isPaused = false
        setPaused(false)
        audio.sfx('select')
      },
      radio: () => {
        const next = st === -1 ? 0 : st + 1 >= STATIONS.length ? -1 : st + 1
        st = next
        setStation(next)
        audio.setStation(next)
        showRadio()
      },
    }

    setupAttract()

    // ---------- teclado extra (radio) y desbloqueo de audio ----------
    const onKey = (e: KeyboardEvent) => {
      audio.unlock()
      audio.setPlaying(true)
      if (e.code === 'KeyR' && !e.repeat && (scr === 'race' || scr === 'intro')) act.current.radio()
    }
    const onPointer = () => {
      audio.unlock()
      audio.setPlaying(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    const pauseNow = () => {
      if (scr === 'race' && !isPaused && race && race.phase !== 'done') {
        isPaused = true
        setPaused(true)
      }
    }
    const onVis = () => {
      if (document.hidden) pauseNow()
    }
    window.addEventListener('blur', pauseNow)
    document.addEventListener('visibilitychange', onVis)

    // ---------- bucle ----------
    let raf = 0
    let last = performance.now()
    let slowT = 0
    let fpsAcc = 0
    let fpsN = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const rawDt = (now - last) / 1000
      last = now
      const dt = Math.min(0.05, Math.max(0, rawDt))
      time += dt
      hud.touch = touchRef.current

      // calidad adaptativa
      fpsAcc += rawDt
      fpsN++
      if (fpsN >= 60) {
        const avg = fpsAcc / fpsN
        if (avg > 0.0205 && (scr === 'race' || scr === 'title')) {
          slowT++
          if (slowT >= 2) {
            slowT = 0
            if (R.dd > 170) R.dd -= 30
            else if (quality > 1) {
              quality = Math.max(1, quality - 0.25)
              resize()
            }
          }
        } else slowT = 0
        fpsAcc = 0
        fpsN = 0
      }

      // entrada
      const jp = justPressedRef.current
      if (jp.size) {
        if (jp.has('pause') && scr === 'race' && race && race.phase !== 'done') {
          isPaused = !isPaused
          setPaused(isPaused)
          audio.sfx('select')
        } else if (scr === 'race' && isPaused && jp.has('action')) {
          act.current.resume()
        } else if (scr === 'over') {
          if (jp.has('action')) act.current.restart()
        } else if (scr !== 'race') {
          for (const k of ['up', 'down', 'left', 'right', 'action', 'action2'] as LogicalKey[]) {
            if (jp.has(k)) navRef.current?.(k)
          }
        }
        jp.clear()
      }

      const gdt = juice.update(isPaused ? 0 : dt)
      if (hud.banner) hud.banner.t += dt
      if (hud.radio) hud.radio.t -= dt

      // simulación
      if (race) {
        if (scr === 'race' && !isPaused) {
          const p = pressedRef.current
          const keySteer = p.has('left') || p.has('right')
          // prioridad: teclas, luego el dedo en el pad, luego la inclinación
          const input: Input = {
            up: p.has('up'),
            down: p.has('down'),
            left: p.has('left'),
            right: p.has('right'),
            nitro: p.has('action') || p.has('action2'),
            steer: keySteer ? null : (touchSteerRef.current ?? tiltRef.current),
            auto: touchRef.current && autoRef.current,
          }
          stepRace(race, input, gdt, fx)
          const P = race.cars[0]
          const sp = P.speed / race.stats.top
          const throttle = input.up || (input.auto && !input.down)
          const skid = race.pl.drift ? 1 : race.pl.braking && sp > 0.4 ? 0.6 : race.pl.hardTurn > 0.7 ? 0.25 : 0
          audio.setEngine(sp, throttle, race.pl.nitroOn, skid, race.pl.offroad, true)
          if (race.phase === 'done' && !raceDone) finishRace()
        } else if (scr === 'race' && isPaused) {
          audio.setEngine(0, false, false, 0, false, false)
        } else if (scr !== 'intro' && scr !== 'podium') {
          stepRace(race, idleInput, dt, nullFx)
        }
      }

      // dibujo
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.imageSmoothingEnabled = false
      const W = R.W
      const H = VIEW_H
      const tr = juice.trauma * juice.trauma * 7
      const sx = tr ? Math.sin(time * 97) * tr : 0
      const sy = tr ? Math.cos(time * 131) * tr : 0
      if ((scr === 'podium' || (scr === 'over' && podium)) && podium) {
        const stds = standingsOf(C)
        const top3 = stds.slice(0, 3).map((s) => ({ frames: carFrames(s.body, s.colors, false), name: s.player ? 'TU' : s.name.toUpperCase(), player: s.player }))
        drawPodium(ctx, W, H, R, podium, top3, dt, font, CUPS[C.cup].color)
      } else if (race) {
        R.draw(race, { time, dt: isPaused ? 0 : dt, shakeX: sx, shakeY: sy })
      }
      if (scr === 'race' && race) {
        juice.drawParticles(ctx)
        juice.drawTexts(ctx, font)
        drawHud(ctx, W, H, race, map, hud, time)
        if (isPaused) drawPause(ctx, W, H, font)
      } else if (scr === 'results' || scr === 'garage') {
        juice.drawParticles(ctx)
      }
      juice.drawFlash(ctx, W, H)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('blur', pauseNow)
      document.removeEventListener('visibilitychange', onVis)
      audio.destroy()
    }
  }, [])

  const stds = standingsOf(camp)
  const A = act.current
  const lastRace = camp.race >= 3
  const over = screen === 'over'
  const gridPos = (() => {
    if (camp.race === 0) return 8
    return stds.length - stds.findIndex((s) => s.player)
  })()

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden">
      <div ref={areaRef} className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          className="relative overflow-hidden rounded-none border-orange-500/30 bg-[#140a10] sm:rounded-xl sm:border"
          style={stage ? { width: stage.w, height: stage.h } : { width: '100%', height: '100%' }}
        >
          <canvas ref={canvasRef} className="block touch-none select-none" aria-label="Juego Sunset Run" />
          {screen === 'title' && (
            <TitleScreen
              best={best}
              touch={touch}
              auto={auto}
              setAuto={setAuto}
              tilt={tilt}
              setTilt={setTilt}
              onStart={() => A.toCar()}
              setNav={setNav}
            />
          )}
          {screen === 'car' && (
            <CarSelect sel={carSel} setSel={(i) => A.selectCar(i)} onConfirm={() => A.toRadio()} onBack={() => A.toTitle()} setNav={setNav} />
          )}
          {screen === 'radio' && <RadioSelect sel={station} setSel={(i) => A.selectStation(i)} onConfirm={() => A.start()} setNav={setNav} />}
          {screen === 'intro' && (
            <TrackIntro cup={camp.cup} race={camp.race} gridPos={gridPos} standings={stds} touch={touch} onGo={() => A.grid()} setNav={setNav} />
          )}
          {screen === 'results' && result && <Results res={result} standings={stds} last={lastRace} onNext={() => A.resultsNext()} setNav={setNav} />}
          {screen === 'garage' && (
            <Garage
              money={camp.money}
              up={camp.up}
              car={CARS[camp.car]}
              standings={stds}
              onBuy={(id) => A.buy(id)}
              onNext={() => A.garageNext()}
              nextLabel={camp.race >= 3 ? `Ir a ${CUPS[Math.min(camp.cup + 1, CUPS.length - 1)].name}` : 'Siguiente carrera'}
              setNav={setNav}
            />
          )}
          {screen === 'podium' && (
            <PodiumPanel
              cup={camp.cup}
              standings={stds}
              advance={camp.cupRank <= 3}
              final={camp.cup >= CUPS.length - 1}
              onNext={() => A.podiumNext()}
              setNav={setNav}
            />
          )}
          {screen === 'race' && paused && (
            <PauseMenu
              station={station}
              touch={touch}
              auto={auto}
              setAuto={setAuto}
              tilt={tilt}
              setTilt={setTilt}
              onResume={() => A.resume()}
              onRadio={() => A.radio()}
              onQuit={() => A.quit()}
              setNav={setNav}
            />
          )}
          {screen === 'race' && !paused && touch && (
            <TouchControls press={virtualPress} release={virtualRelease} auto={auto} onRadio={() => A.radio()} onSteer={setTouchSteer} />
          )}
          {over && (
            <GameOverOverlay
              title={camp.victory ? 'LEYENDA DEL ASFALTO' : 'FIN DE LA GIRA'}
              accent={ACCENT}
              score={camp.score}
              best={best}
              newBest={camp.newBest}
              stats={[
                { label: 'Copas ganadas', value: `${camp.cupsWon}/3` },
                { label: 'Mejor posición', value: camp.bestPos <= 8 ? `${camp.bestPos}º` : '—' },
                { label: 'Coche', value: CARS[camp.car].name },
                { label: 'Rebases', value: camp.overtakes },
              ]}
              onRestart={() => A.restart()}
            />
          )}
          {portrait && <RotateNotice />}
        </div>
      </div>
    </div>
  )
}
