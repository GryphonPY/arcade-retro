/**
 * Audio propio de Nebula Strike: un AudioContext con dos buses (música y
 * efectos), sintetizadores de efectos con limitador de frecuencia y búfer de
 * ruido precalculado. Respeta el silencio global (isMuted de ../sfx).
 */
import { isMuted } from '../sfx'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let pulse25: PeriodicWave | null = null
let pulse12: PeriodicWave | null = null

export function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.9
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -16
      comp.knee.value = 18
      comp.ratio.value = 4
      comp.attack.value = 0.003
      comp.release.value = 0.18
      master.connect(comp)
      comp.connect(ctx.destination)
      musicBus = ctx.createGain()
      musicBus.gain.value = 0
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 8500
      musicBus.connect(lp)
      lp.connect(master)
      sfxBus = ctx.createGain()
      sfxBus.gain.value = 0.8
      sfxBus.connect(master)
      const len = ctx.sampleRate
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      pulse25 = makePulse(ctx, 0.25)
      pulse12 = makePulse(ctx, 0.125)
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

function makePulse(c: AudioContext, duty: number): PeriodicWave {
  const n = 32
  const re = new Float32Array(n)
  const im = new Float32Array(n)
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty)
  return c.createPeriodicWave(re, im)
}

export function musicOut(): GainNode | null {
  return musicBus
}

export type Wave = OscillatorType | 'pulse25' | 'pulse12'

export function setWave(osc: OscillatorNode, w: Wave) {
  if (w === 'pulse25' && pulse25) osc.setPeriodicWave(pulse25)
  else if (w === 'pulse12' && pulse12) osc.setPeriodicWave(pulse12)
  else osc.type = w === 'pulse25' || w === 'pulse12' ? 'square' : w
}

/** Libera el contexto (al desmontar el juego). */
export function closeAudio() {
  stopLaserHum()
  const c = ctx
  ctx = null
  master = musicBus = sfxBus = null
  noiseBuf = null
  pulse25 = pulse12 = null
  if (c) void c.close().catch(() => {})
}

// ===================== Primitivas =====================

interface ToneO {
  f: number
  to?: number
  dur: number
  w?: Wave
  vol?: number
  delay?: number
  /** Ataque en segundos. */
  a?: number
}

export function blip(o: ToneO, out?: AudioNode | null) {
  if (isMuted()) return
  const c = audio()
  const dest = out ?? sfxBus
  if (!c || !dest) return
  try {
    const t0 = c.currentTime + (o.delay ?? 0)
    const osc = c.createOscillator()
    const g = c.createGain()
    setWave(osc, o.w ?? 'square')
    osc.frequency.setValueAtTime(o.f, t0)
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur)
    const v = o.vol ?? 0.05
    const a = o.a ?? 0.004
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(v, t0 + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
    osc.connect(g)
    g.connect(dest)
    osc.start(t0)
    osc.stop(t0 + o.dur + 0.02)
  } catch {
    // audio no disponible
  }
}

interface NoiseO {
  dur: number
  vol?: number
  f?: number
  to?: number
  type?: BiquadFilterType
  q?: number
  delay?: number
}

export function hiss(o: NoiseO, out?: AudioNode | null) {
  if (isMuted()) return
  const c = audio()
  const dest = out ?? sfxBus
  if (!c || !dest || !noiseBuf) return
  try {
    const t0 = c.currentTime + (o.delay ?? 0)
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const filt = c.createBiquadFilter()
    filt.type = o.type ?? 'lowpass'
    filt.frequency.setValueAtTime(o.f ?? 1200, t0)
    if (o.to) filt.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t0 + o.dur)
    filt.Q.value = o.q ?? 0.8
    const g = c.createGain()
    g.gain.setValueAtTime(o.vol ?? 0.08, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
    src.connect(filt)
    filt.connect(g)
    g.connect(dest)
    src.start(t0, Math.random() * 0.5)
    src.stop(t0 + o.dur + 0.02)
  } catch {
    // audio no disponible
  }
}

/** Ruido para la batería del secuenciador (bus de música, tiempo absoluto). */
export function drumHit(when: number, kind: string, vol = 1) {
  const c = ctx
  if (!c || !musicBus || !noiseBuf) return
  try {
    if (kind === 'k') {
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(160, when)
      osc.frequency.exponentialRampToValueAtTime(40, when + 0.11)
      g.gain.setValueAtTime(0.16 * vol, when)
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14)
      osc.connect(g)
      g.connect(musicBus)
      osc.start(when)
      osc.stop(when + 0.16)
      return
    }
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    const f = c.createBiquadFilter()
    const g = c.createGain()
    let dur = 0.04
    let v = 0.02
    if (kind === 's') {
      f.type = 'bandpass'
      f.frequency.value = 1700
      f.Q.value = 0.7
      dur = 0.11
      v = 0.075
      // cuerpo del redoble
      const o = c.createOscillator()
      const og = c.createGain()
      o.type = 'triangle'
      o.frequency.setValueAtTime(220, when)
      o.frequency.exponentialRampToValueAtTime(120, when + 0.06)
      og.gain.setValueAtTime(0.05 * vol, when)
      og.gain.exponentialRampToValueAtTime(0.0001, when + 0.07)
      o.connect(og)
      og.connect(musicBus)
      o.start(when)
      o.stop(when + 0.08)
    } else if (kind === 'h') {
      f.type = 'highpass'
      f.frequency.value = 7000
      dur = 0.03
      v = 0.022
    } else if (kind === 'o') {
      f.type = 'highpass'
      f.frequency.value = 6000
      dur = 0.16
      v = 0.024
    } else if (kind === 'c') {
      f.type = 'highpass'
      f.frequency.value = 4200
      dur = 0.7
      v = 0.04
    } else if (kind === 't') {
      f.type = 'lowpass'
      f.frequency.value = 500
      dur = 0.14
      v = 0.08
    }
    g.gain.setValueAtTime(v * vol, when)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(f)
    f.connect(g)
    g.connect(musicBus)
    src.start(when, Math.random() * 0.5)
    src.stop(when + dur + 0.02)
  } catch {
    // audio no disponible
  }
}

// ===================== Limitador =====================

const lastAt = new Map<string, number>()
function gate(key: string, min: number): boolean {
  const now = performance.now() / 1000
  const prev = lastAt.get(key) ?? -1
  if (now - prev < min) return false
  lastAt.set(key, now)
  return true
}

// ===================== Zumbido del láser (voz continua) =====================

let hum: { osc: OscillatorNode; osc2: OscillatorNode; g: GainNode } | null = null
export function laserHum(on: boolean, level = 1) {
  const c = ctx
  if (!c || !sfxBus) return
  if (on && !isMuted()) {
    try {
      if (!hum) {
        const osc = c.createOscillator()
        const osc2 = c.createOscillator()
        const g = c.createGain()
        const f = c.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = 2400
        osc.type = 'sawtooth'
        osc2.type = 'square'
        osc.frequency.value = 110
        osc2.frequency.value = 220.7
        g.gain.value = 0
        osc.connect(f)
        osc2.connect(f)
        f.connect(g)
        g.connect(sfxBus)
        osc.start()
        osc2.start()
        hum = { osc, osc2, g }
      }
      const t = c.currentTime
      hum.g.gain.setTargetAtTime(0.022, t, 0.03)
      hum.osc.frequency.setTargetAtTime(105 + level * 6 + Math.random() * 6, t, 0.05)
    } catch {
      // audio no disponible
    }
  } else if (hum) {
    hum.g.gain.setTargetAtTime(0, c.currentTime, 0.04)
  }
}
function stopLaserHum() {
  if (!hum) return
  try {
    hum.osc.stop()
    hum.osc2.stop()
  } catch {
    // ya detenido
  }
  hum = null
}

// ===================== Efectos =====================

export const fx = {
  shot(ship: number) {
    if (!gate('shot', 0.085)) return
    if (ship === 0) blip({ f: 1500, to: 900, dur: 0.035, w: 'pulse12', vol: 0.012 })
    else if (ship === 1) blip({ f: 700, to: 420, dur: 0.045, w: 'pulse25', vol: 0.014 })
    else blip({ f: 1100, to: 700, dur: 0.04, w: 'triangle', vol: 0.02 })
  },
  missile() {
    if (!gate('missile', 0.12)) return
    hiss({ dur: 0.12, vol: 0.025, f: 3000, to: 900, type: 'bandpass' })
  },
  hit() {
    if (!gate('hit', 0.045)) return
    blip({ f: 260 + Math.random() * 60, to: 160, dur: 0.035, w: 'square', vol: 0.016 })
  },
  hitArmor() {
    if (!gate('hitA', 0.07)) return
    blip({ f: 1800, to: 1400, dur: 0.03, w: 'triangle', vol: 0.012 })
  },
  pop() {
    if (!gate('pop', 0.03)) return
    hiss({ dur: 0.16, vol: 0.06, f: 2600, to: 400 })
    blip({ f: 420, to: 90, dur: 0.12, w: 'square', vol: 0.03 })
  },
  boom() {
    if (!gate('boom', 0.05)) return
    hiss({ dur: 0.45, vol: 0.12, f: 1600, to: 120 })
    blip({ f: 140, to: 35, dur: 0.4, w: 'triangle', vol: 0.09 })
  },
  bigBoom() {
    hiss({ dur: 1.1, vol: 0.18, f: 2200, to: 60 })
    blip({ f: 90, to: 25, dur: 1.0, w: 'triangle', vol: 0.14 })
    blip({ f: 180, to: 40, dur: 0.6, w: 'sawtooth', vol: 0.04 })
  },
  bossDeath() {
    hiss({ dur: 2.6, vol: 0.2, f: 3000, to: 40 })
    blip({ f: 70, to: 20, dur: 2.4, w: 'triangle', vol: 0.18 })
    blip({ f: 400, to: 30, dur: 1.6, w: 'sawtooth', vol: 0.05, delay: 0.1 })
    hiss({ dur: 1.4, vol: 0.12, f: 900, to: 50, delay: 0.9 })
  },
  graze(streak: number) {
    if (!gate('graze', 0.035)) return
    blip({ f: 1900 + Math.min(streak, 40) * 22, dur: 0.03, w: 'sine', vol: 0.02 })
  },
  power() {
    ;[523, 784, 1047, 1568].forEach((f, i) => blip({ f, dur: 0.08, w: 'pulse25', vol: 0.04, delay: i * 0.045 }))
  },
  medal(idx: number) {
    const base = 880 * Math.pow(2, Math.min(idx, 9) / 12)
    blip({ f: base, dur: 0.06, w: 'triangle', vol: 0.045 })
    blip({ f: base * 1.5, dur: 0.1, w: 'triangle', vol: 0.04, delay: 0.05 })
  },
  medalLost() {
    blip({ f: 600, to: 200, dur: 0.25, w: 'triangle', vol: 0.04 })
  },
  item() {
    ;[660, 990, 1320].forEach((f, i) => blip({ f, dur: 0.07, w: 'square', vol: 0.035, delay: i * 0.05 }))
  },
  oneUp() {
    ;[784, 988, 1175, 1568, 1976].forEach((f, i) => blip({ f, dur: 0.1, w: 'pulse25', vol: 0.045, delay: i * 0.07 }))
  },
  bomb() {
    hiss({ dur: 1.2, vol: 0.16, f: 200, to: 4000, type: 'bandpass', q: 0.6 })
    blip({ f: 60, to: 30, dur: 1.2, w: 'sawtooth', vol: 0.08 })
    blip({ f: 200, to: 1600, dur: 0.6, w: 'triangle', vol: 0.05 })
  },
  shield() {
    blip({ f: 1200, to: 300, dur: 0.3, w: 'triangle', vol: 0.07 })
    hiss({ dur: 0.3, vol: 0.06, f: 5000, type: 'highpass' })
  },
  die() {
    hiss({ dur: 1.2, vol: 0.18, f: 3000, to: 80 })
    blip({ f: 600, to: 40, dur: 1.0, w: 'sawtooth', vol: 0.08 })
    blip({ f: 300, to: 30, dur: 1.2, w: 'triangle', vol: 0.1 })
  },
  warning() {
    blip({ f: 440, to: 880, dur: 0.38, w: 'sawtooth', vol: 0.05 })
    blip({ f: 880, to: 440, dur: 0.38, w: 'sawtooth', vol: 0.05, delay: 0.4 })
    blip({ f: 110, dur: 0.75, w: 'square', vol: 0.03 })
  },
  phase() {
    blip({ f: 160, to: 60, dur: 0.6, w: 'sawtooth', vol: 0.08 })
    hiss({ dur: 0.6, vol: 0.1, f: 600, to: 3000, type: 'bandpass' })
  },
  cancel() {
    if (!gate('cancel', 0.2)) return
    hiss({ dur: 0.4, vol: 0.07, f: 6000, to: 1500, type: 'highpass' })
  },
  chain(level: number) {
    blip({ f: 660 * Math.pow(2, Math.min(level, 12) / 12), dur: 0.09, w: 'pulse25', vol: 0.035 })
  },
  menu() {
    blip({ f: 880, dur: 0.04, w: 'pulse25', vol: 0.035 })
  },
  select() {
    blip({ f: 660, dur: 0.06, w: 'pulse25', vol: 0.045 })
    blip({ f: 1320, dur: 0.12, w: 'pulse25', vol: 0.045, delay: 0.06 })
  },
  launch() {
    hiss({ dur: 0.9, vol: 0.1, f: 300, to: 5000, type: 'bandpass' })
    blip({ f: 120, to: 900, dur: 0.8, w: 'sawtooth', vol: 0.04 })
  },
  upgrade() {
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => blip({ f, dur: 0.12, w: 'pulse25', vol: 0.045, delay: i * 0.06 }))
  },
  clear() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568]
    seq.forEach((f, i) => blip({ f, dur: 0.14, w: 'pulse25', vol: 0.045, delay: i * 0.1 }))
    ;[262, 330, 392, 523].forEach((f, i) => blip({ f, dur: 0.35, w: 'triangle', vol: 0.06, delay: i * 0.2 }))
  },
  tally() {
    if (!gate('tally', 0.05)) return
    blip({ f: 1400, dur: 0.025, w: 'square', vol: 0.02 })
  },
  gameOver() {
    ;[392, 349, 311, 262, 196].forEach((f, i) => blip({ f, dur: 0.3, w: 'triangle', vol: 0.07, delay: i * 0.22 }))
    ;[196, 175, 156, 131, 98].forEach((f, i) => blip({ f, dur: 0.3, w: 'pulse25', vol: 0.03, delay: i * 0.22 }))
  },
  pause() {
    blip({ f: 520, to: 440, dur: 0.09, w: 'triangle', vol: 0.04 })
  },
  laserStart() {
    blip({ f: 300, to: 1200, dur: 0.12, w: 'sawtooth', vol: 0.03 })
  },
}
