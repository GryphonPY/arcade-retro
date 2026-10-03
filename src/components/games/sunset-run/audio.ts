/**
 * Audio propio de Sunset Run: secuenciador chiptune para la radio (4
 * estaciones), motor sintetizado del coche, derrapes y efectos.
 * Respeta isMuted() (silencio total) e isMusicEnabled() (solo música).
 */
import { isMuted } from '../sfx'
import { isMusicEnabled } from '../music'
import { SONGS, type InstDef, type SongDef } from './songs'
import type { SoundId } from './race'

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
function midiOf(n: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n)
  if (!m) return 69
  return (parseInt(m[3], 10) + 1) * 12 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** Acorde → semitonos sobre la raíz (raíz como pitch class). */
function parseChord(sym: string): { root: number; iv: number[] } {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym)
  if (!m) return { root: 0, iv: [0, 4, 7] }
  const root = (SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12
  const q = m[3]
  const iv =
    q === 'm' ? [0, 3, 7, 12]
    : q === 'm7' ? [0, 3, 7, 10]
    : q === '7' ? [0, 4, 7, 10]
    : q === 'maj7' ? [0, 4, 7, 11]
    : q === '5' ? [0, 7, 12, 19]
    : [0, 4, 7, 12]
  return { root, iv }
}

interface Ev {
  inst: 'lead' | 'bass' | 'arp' | 'stab' | 'power'
  f: number[]
  steps: number
  vol: number
}
interface Step {
  ev: Ev[]
  drums: string[]
}
interface Built {
  spb: number
  swing: number
  steps: Step[]
  def: SongDef
}

function buildSong(def: SongDef): Built {
  const steps: Step[] = []
  for (const secName of def.order) {
    const sec = def.sections[secName]
    const bars = sec.bars.length
    const total = bars * 16
    const base = steps.length
    for (let i = 0; i < total; i++) steps.push({ ev: [], drums: [] })
    const chords = sec.bars.map(parseChord)
    // melodía
    let pos = 0
    for (const tok of sec.lead.trim().split(/\s+/)) {
      const [n, d] = tok.split('/')
      const dur = parseInt(d, 10) || 1
      if (pos >= total) break
      if (n !== '-') {
        steps[base + pos].ev.push({ inst: 'lead', f: [mtof(midiOf(n))], steps: Math.min(dur, total - pos), vol: 1 })
      }
      pos += dur
    }
    for (let b = 0; b < bars; b++) {
      const ch = chords[b]
      const bassPat = Array.isArray(sec.bass) ? sec.bass[b % sec.bass.length] : sec.bass
      const bassOct = def.bass.oct ?? 2
      const rootMidi = (bassOct + 1) * 12 + ch.root
      // bajo
      let prev: Ev | null = null
      for (let i = 0; i < 16; i++) {
        const c = bassPat[i] ?? '-'
        if (c === '.') {
          if (prev) prev.steps++
          continue
        }
        prev = null
        if (c === '-') continue
        let m = rootMidi
        if (c === 'O' || c === 'g') m += 12
        else if (c === '5') m += 7
        else if (c === '3') m += ch.iv[1]
        else if (c === '7') m += ch.iv[3] === 12 ? 10 : ch.iv[3]
        prev = { inst: 'bass', f: [mtof(m)], steps: 1, vol: c === 'g' ? 0.5 : 1 }
        steps[base + b * 16 + i].ev.push(prev)
      }
      // arpegio
      if (sec.arp && def.arp) {
        const o = ((def.arp.oct ?? 5) + 1) * 12 + ch.root
        for (let i = 0; i < 16; i++) {
          const c = sec.arp[i] ?? '-'
          if (c < '0' || c > '3') continue
          const k = parseInt(c, 10)
          steps[base + b * 16 + i].ev.push({ inst: 'arp', f: [mtof(o + (ch.iv[k] ?? 12))], steps: 1, vol: 1 })
        }
      }
      // acordes
      for (const kind of ['stab', 'power'] as const) {
        const pat = sec[kind]
        const inst = def[kind]
        if (!pat || !inst) continue
        const o = ((inst.oct ?? 4) + 1) * 12 + ch.root
        for (let i = 0; i < 16; i++) {
          const c = pat[i] ?? '-'
          if (c !== 'x' && c !== 'X') continue
          let len = 1
          if (c === 'X') while (i + len < 16 && (pat[i + len] ?? '-') === '-') len++
          const f = kind === 'power' ? [mtof(o), mtof(o + 7), mtof(o + 12)] : ch.iv.slice(0, 3).map((v) => mtof(o + v))
          steps[base + b * 16 + i].ev.push({ inst: kind, f, steps: len, vol: c === 'X' ? 1 : 0.9 })
        }
      }
      // batería
      const quiet = sec.quiet?.includes(b + 1)
      if (!quiet) {
        const last = b === bars - 1
        const rows: Record<string, string> = { ...sec.drums, ...(last && sec.fill ? sec.fill : {}) }
        for (const row of Object.keys(rows)) {
          const pat = rows[row]
          for (let i = 0; i < 16; i++) {
            const c = pat[i]
            if (!c || c === '-') continue
            steps[base + b * 16 + i].drums.push(row + c)
          }
        }
        if (b === 0 && secName !== def.order[0] && !sec.drums.C) steps[base].drums.push('Cx')
      }
    }
  }
  return { spb: 60 / def.bpm / 4, swing: def.swing, steps, def }
}

export class SunsetAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private echoIn: GainNode | null = null
  private distIn: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private built: (Built | null)[] = SONGS.map(() => null)
  private station = 0
  private step = 0
  private nextT = 0
  private playing = false
  // motor
  private eng: {
    o1: OscillatorNode
    o2: OscillatorNode
    lp: BiquadFilterNode
    g: GainNode
    skid: GainNode
    skidF: BiquadFilterNode
    rumble: GainNode
    whoosh: GainNode
    srcs: AudioBufferSourceNode[]
  } | null = null
  /** Volumen de la radio (se baja en menús de pausa). */
  radioOn = true

  private ac(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return null
        const c = new AC()
        this.ctx = c
        const comp = c.createDynamicsCompressor()
        comp.threshold.value = -16
        comp.knee.value = 18
        comp.ratio.value = 3.5
        comp.attack.value = 0.003
        comp.release.value = 0.2
        comp.connect(c.destination)
        this.master = c.createGain()
        this.master.gain.value = 0.9
        this.master.connect(comp)
        this.musicBus = c.createGain()
        this.musicBus.gain.value = 0
        this.musicBus.connect(this.master)
        this.sfxBus = c.createGain()
        this.sfxBus.gain.value = isMuted() ? 0 : 1
        this.sfxBus.connect(this.master)
        // eco para la melodía
        this.echoIn = c.createGain()
        const dl = c.createDelay(1)
        dl.delayTime.value = 0.3
        const fb = c.createGain()
        fb.gain.value = 0.32
        const wet = c.createGain()
        wet.gain.value = 0.28
        const dlp = c.createBiquadFilter()
        dlp.type = 'lowpass'
        dlp.frequency.value = 2400
        this.echoIn.connect(dl)
        dl.connect(dlp)
        dlp.connect(fb)
        fb.connect(dl)
        dlp.connect(wet)
        wet.connect(this.musicBus)
        // distorsión de guitarra
        this.distIn = c.createGain()
        const ws = c.createWaveShaper()
        const curve = new Float32Array(1024)
        for (let i = 0; i < 1024; i++) {
          const x = (i / 1023) * 2 - 1
          curve[i] = Math.tanh(x * 4.5) * 0.7
        }
        ws.curve = curve
        const dlp2 = c.createBiquadFilter()
        dlp2.type = 'lowpass'
        dlp2.frequency.value = 2800
        this.distIn.connect(ws)
        ws.connect(dlp2)
        dlp2.connect(this.musicBus)
        // ruido compartido
        const len = c.sampleRate * 2
        const buf = c.createBuffer(1, len, c.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
        this.noiseBuf = buf
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
      return this.ctx
    } catch {
      return null
    }
  }

  /** Llamar desde un gesto del usuario para desbloquear el audio. */
  unlock() {
    this.ac()
    this.ensureLoop()
  }

  private ensureLoop() {
    if (this.timer || typeof window === 'undefined') return
    this.timer = setInterval(() => this.tick(), 25)
  }

  getStation() {
    return this.station
  }

  /** Cambia de estación (-1 = apagada) con estática de sintonía. */
  setStation(i: number, staticFx = true) {
    const c = this.ac()
    this.ensureLoop()
    if (staticFx) this.radioStatic()
    this.station = i
    this.step = 0
    if (c) this.nextT = c.currentTime + (staticFx ? 0.32 : 0.05)
  }

  /** Detiene o reanuda la música sin perder la posición. */
  setPlaying(v: boolean) {
    this.playing = v
    const c = this.ctx
    if (c && v) this.nextT = c.currentTime + 0.05
  }

  private tick() {
    const c = this.ctx
    if (!c || !this.musicBus || !this.sfxBus) return
    if (c.state === 'suspended') return
    const muted = isMuted()
    this.sfxBus.gain.setTargetAtTime(muted ? 0 : 1, c.currentTime, 0.02)
    const musicOk = !muted && isMusicEnabled() && this.playing && this.radioOn && this.station >= 0
    this.musicBus.gain.setTargetAtTime(musicOk ? 0.75 : 0, c.currentTime, 0.04)
    if (!musicOk) {
      this.nextT = c.currentTime + 0.08
      return
    }
    let song = this.built[this.station]
    if (!song) {
      song = buildSong(SONGS[this.station])
      this.built[this.station] = song
    }
    if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05
    while (this.nextT < c.currentTime + 0.14) {
      const sw = this.step % 2 === 1 ? song.swing * song.spb : 0
      this.playStep(c, song, this.step % song.steps.length, this.nextT + sw)
      this.step = (this.step + 1) % song.steps.length
      this.nextT += song.spb
    }
  }

  private playStep(c: AudioContext, s: Built, i: number, when: number) {
    const st = s.steps[i]
    for (const ev of st.ev) {
      const inst = s.def[ev.inst]
      if (!inst) continue
      this.note(c, inst, ev, when, ev.steps * s.spb)
    }
    for (const d of st.drums) this.drum(c, d, when)
  }

  private note(c: AudioContext, inst: InstDef, ev: Ev, when: number, dur: number) {
    if (!this.musicBus) return
    const out = inst.dist ? this.distIn : this.musicBus
    if (!out) return
    const vol = inst.vol * ev.vol
    if (inst.trem && dur > 0.12) {
      // punteo en trémolo estilo guitarra surf
      const n = Math.floor(dur / 0.06)
      for (let k = 0; k < n; k++) this.voice(c, inst, ev.f, when + k * 0.06, 0.055, vol * (k % 2 ? 0.75 : 1), out, false)
      return
    }
    this.voice(c, inst, ev.f, when, dur, vol, out, !!inst.echo)
  }

  private voice(c: AudioContext, inst: InstDef, freqs: number[], when: number, dur: number, vol: number, out: AudioNode, echo: boolean) {
    try {
      const g = c.createGain()
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = inst.lp ?? 6000
      const hold = inst.dec ?? Math.max(0.05, dur * 0.92)
      g.gain.setValueAtTime(0.0001, when)
      g.gain.linearRampToValueAtTime(vol, when + 0.006)
      if (inst.dec) g.gain.exponentialRampToValueAtTime(0.0001, when + hold)
      else {
        g.gain.setValueAtTime(vol * 0.8, when + Math.min(hold, 0.06))
        g.gain.linearRampToValueAtTime(vol * 0.7, when + hold)
        g.gain.exponentialRampToValueAtTime(0.0001, when + hold + 0.05)
      }
      if (inst.brass) {
        lp.frequency.setValueAtTime(500, when)
        lp.frequency.linearRampToValueAtTime(inst.lp ?? 2600, when + 0.04)
        lp.frequency.linearRampToValueAtTime((inst.lp ?? 2600) * 0.55, when + Math.max(0.08, hold))
      }
      lp.connect(g)
      g.connect(out)
      if (echo && this.echoIn) g.connect(this.echoIn)
      const end = when + hold + 0.08
      for (const f of freqs) {
        const o = c.createOscillator()
        o.type = inst.wave
        o.frequency.setValueAtTime(f, when)
        if (inst.detune) o.detune.value = (Math.random() - 0.5) * inst.detune
        if (inst.vib && hold > 0.18) {
          const lfo = c.createOscillator()
          const lg = c.createGain()
          lfo.frequency.value = inst.vib
          lg.gain.setValueAtTime(0, when)
          lg.gain.linearRampToValueAtTime(f * 0.012, when + 0.18)
          lfo.connect(lg)
          lg.connect(o.frequency)
          lfo.start(when)
          lfo.stop(end)
        }
        o.connect(lp)
        o.start(when)
        o.stop(end)
      }
    } catch {
      // audio no disponible
    }
  }

  private noise(c: AudioContext, when: number, dur: number, vol: number, type: BiquadFilterType, freq: number, out: AudioNode, q = 1) {
    if (!this.noiseBuf) return
    try {
      const src = c.createBufferSource()
      src.buffer = this.noiseBuf
      const f = c.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      const g = c.createGain()
      g.gain.setValueAtTime(vol, when)
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
      src.connect(f)
      f.connect(g)
      g.connect(out)
      src.start(when, Math.random() * 1.5, dur + 0.05)
    } catch {
      // audio no disponible
    }
  }

  private tone(c: AudioContext, when: number, f0: number, f1: number, dur: number, vol: number, type: OscillatorType, out: AudioNode) {
    try {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = type
      o.frequency.setValueAtTime(f0, when)
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur)
      g.gain.setValueAtTime(vol, when)
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
      o.connect(g)
      g.connect(out)
      o.start(when)
      o.stop(when + dur + 0.02)
    } catch {
      // audio no disponible
    }
  }

  private drum(c: AudioContext, code: string, when: number) {
    const out = this.musicBus
    if (!out) return
    const row = code[0]
    const v = code[1]
    switch (row) {
      case 'k':
        this.tone(c, when, 150, 42, 0.14, 0.42, 'sine', out)
        break
      case 's':
        this.noise(c, when, v === 'g' ? 0.05 : 0.13, v === 'g' ? 0.05 : 0.16, 'bandpass', 1900, out, 0.8)
        if (v !== 'g') this.tone(c, when, 200, 150, 0.07, 0.1, 'triangle', out)
        break
      case 'c':
        for (let k = 0; k < 3; k++) this.noise(c, when + k * 0.011, 0.05 + (k === 2 ? 0.08 : 0), 0.13, 'bandpass', 1300, out, 1.2)
        break
      case 'h':
        this.noise(c, when, 0.035, 0.05, 'highpass', 7500, out)
        break
      case 'o':
        this.noise(c, when, 0.2, 0.045, 'highpass', 6500, out)
        break
      case 'C':
        this.noise(c, when, 1.1, 0.09, 'highpass', 4800, out)
        break
      case 'q':
        if (v === 'q') this.tone(c, when, 380, 330, 0.12, 0.16, 'sine', out)
        else this.tone(c, when, 240, 210, 0.16, 0.18, 'sine', out)
        break
      case 'v':
        this.tone(c, when, 2500, 2500, 0.045, 0.08, 'triangle', out)
        break
      case 'z':
        this.noise(c, when, 0.04, 0.022, 'highpass', 6000, out)
        break
      case 'b':
        this.tone(c, when, 560, 560, 0.12, 0.04, 'square', out)
        this.tone(c, when, 845, 845, 0.12, 0.03, 'square', out)
        break
      case 't':
        if (v === 'h') this.tone(c, when, 190, 120, 0.16, 0.22, 'sine', out)
        else this.tone(c, when, 120, 70, 0.2, 0.24, 'sine', out)
        break
    }
  }

  private radioStatic() {
    const c = this.ac()
    if (!c || !this.sfxBus || !this.noiseBuf) return
    try {
      const t = c.currentTime
      const src = c.createBufferSource()
      src.buffer = this.noiseBuf
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.Q.value = 2
      f.frequency.setValueAtTime(600, t)
      f.frequency.exponentialRampToValueAtTime(3200, t + 0.15)
      f.frequency.exponentialRampToValueAtTime(900, t + 0.3)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.12, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
      src.connect(f)
      f.connect(g)
      g.connect(this.sfxBus)
      src.start(t, Math.random(), 0.4)
      this.tone(c, t + 0.05, 900, 1800, 0.2, 0.025, 'sine', this.sfxBus)
    } catch {
      // audio no disponible
    }
  }

  // ===================== motor =====================

  startEngine() {
    const c = this.ac()
    if (!c || !this.sfxBus || !this.noiseBuf || this.eng) return
    try {
      const o1 = c.createOscillator()
      const o2 = c.createOscillator()
      o1.type = 'sawtooth'
      o2.type = 'square'
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 400
      lp.Q.value = 2
      const g = c.createGain()
      g.gain.value = 0
      const o2g = c.createGain()
      o2g.gain.value = 0.6
      o1.connect(lp)
      o2.connect(o2g)
      o2g.connect(lp)
      lp.connect(g)
      g.connect(this.sfxBus)
      o1.start()
      o2.start()
      const loop = (type: BiquadFilterType, freq: number, q: number) => {
        const src = c.createBufferSource()
        src.buffer = this.noiseBuf
        src.loop = true
        const f = c.createBiquadFilter()
        f.type = type
        f.frequency.value = freq
        f.Q.value = q
        const gg = c.createGain()
        gg.gain.value = 0
        src.connect(f)
        f.connect(gg)
        gg.connect(this.sfxBus as GainNode)
        src.start()
        return { src, f, gg }
      }
      const sk = loop('bandpass', 1500, 4)
      const ru = loop('lowpass', 240, 1)
      const wh = loop('bandpass', 800, 1.5)
      this.eng = { o1, o2, lp, g, skid: sk.gg, skidF: sk.f, rumble: ru.gg, whoosh: wh.gg, srcs: [sk.src, ru.src, wh.src] }
    } catch {
      this.eng = null
    }
  }

  setEngine(speedPct: number, throttle: boolean, nitro: boolean, skid: number, offroad: boolean, on: boolean) {
    const c = this.ctx
    const e = this.eng
    if (!c || !e) return
    const t = c.currentTime
    const gears = [0, 0.2, 0.38, 0.56, 0.76, 1.0, 1.5]
    let gear = 0
    while (gear < gears.length - 2 && speedPct > gears[gear + 1]) gear++
    const lo = gears[gear]
    const hi = gears[gear + 1]
    const rpm = 0.42 + ((speedPct - lo) / (hi - lo)) * 0.58
    const f = (34 + rpm * 82 + gear * 5) * (nitro ? 1.12 : 1)
    e.o1.frequency.setTargetAtTime(f, t, 0.05)
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05)
    e.lp.frequency.setTargetAtTime(260 + rpm * 900 + (throttle ? 500 : 0) + (nitro ? 600 : 0), t, 0.06)
    e.g.gain.setTargetAtTime(on ? 0.05 + (throttle ? 0.03 : 0) : 0, t, 0.08)
    e.skid.gain.setTargetAtTime(on ? Math.min(1, skid) * 0.09 : 0, t, 0.05)
    e.skidF.frequency.setTargetAtTime(1300 + Math.random() * 500, t, 0.05)
    e.rumble.gain.setTargetAtTime(on && offroad ? 0.25 * Math.min(1, speedPct + 0.2) : 0, t, 0.06)
    e.whoosh.gain.setTargetAtTime(on && nitro ? 0.09 : 0, t, 0.06)
  }

  stopEngine() {
    const e = this.eng
    if (!e) return
    this.eng = null
    try {
      const t = this.ctx?.currentTime ?? 0
      e.g.gain.setTargetAtTime(0, t, 0.05)
      e.o1.stop(t + 0.3)
      e.o2.stop(t + 0.3)
      for (const s of e.srcs) s.stop(t + 0.3)
    } catch {
      // ya detenido
    }
  }

  // ===================== efectos =====================

  sfx(id: SoundId | 'move' | 'select' | 'buy' | 'deny' | 'podium' | 'gameover' | 'start') {
    const c = this.ac()
    const o = this.sfxBus
    if (!c || !o || isMuted()) return
    const t = c.currentTime + 0.005
    const T = (d: number, f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'square') => this.tone(c, t + d, f0, f1, dur, vol, type, o)
    const N = (d: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1) => this.noise(c, t + d, dur, vol, type, freq, o, q)
    switch (id) {
      case 'beep':
        T(0, 440, 440, 0.22, 0.09)
        break
      case 'go':
        T(0, 880, 880, 0.5, 0.1)
        T(0, 1320, 1320, 0.5, 0.04, 'triangle')
        break
      case 'crash':
        N(0, 0.55, 0.35, 'lowpass', 900)
        T(0, 110, 35, 0.4, 0.2, 'triangle')
        N(0.05, 0.25, 0.12, 'highpass', 3000)
        break
      case 'bump':
        N(0, 0.14, 0.2, 'lowpass', 700)
        T(0, 140, 60, 0.12, 0.12, 'triangle')
        break
      case 'scrape':
        N(0, 0.16, 0.12, 'highpass', 2600)
        break
      case 'coin':
        T(0, 988, 988, 0.06, 0.05)
        T(0.06, 1319, 1319, 0.12, 0.05)
        break
      case 'nitroPick':
        T(0, 300, 1200, 0.22, 0.06, 'sawtooth')
        T(0.08, 600, 1800, 0.18, 0.04, 'square')
        break
      case 'shield':
        ;[523, 659, 784, 1047].forEach((f, i) => T(i * 0.05, f, f, 0.12, 0.05, 'triangle'))
        break
      case 'magnet':
        T(0, 200, 800, 0.15, 0.05)
        T(0.15, 800, 200, 0.15, 0.05)
        break
      case 'shieldHit':
        T(0, 1400, 300, 0.2, 0.07, 'sine')
        N(0, 0.15, 0.1, 'bandpass', 2000)
        break
      case 'lap':
        T(0, 784, 784, 0.1, 0.06)
        T(0.1, 1047, 1047, 0.18, 0.06)
        break
      case 'finalLap':
        ;[523, 659, 784, 1047, 784, 1047].forEach((f, i) => T(i * 0.09, f, f, 0.12, 0.06))
        break
      case 'finish':
        ;[523, 659, 784, 1047, 1319].forEach((f, i) => T(i * 0.1, f, f, i === 4 ? 0.5 : 0.12, 0.07))
        ;[262, 330, 392].forEach((f) => T(0.4, f, f, 0.6, 0.05, 'triangle'))
        break
      case 'overtake':
        T(0, 660, 990, 0.1, 0.05, 'triangle')
        break
      case 'driftStart':
        N(0, 0.12, 0.08, 'bandpass', 1600, 3)
        break
      case 'driftBoost':
        T(0, 200, 700, 0.25, 0.06, 'sawtooth')
        N(0, 0.3, 0.1, 'bandpass', 1000, 1.5)
        break
      case 'nitroOn':
        N(0, 0.4, 0.16, 'bandpass', 700, 1)
        T(0, 120, 260, 0.35, 0.06, 'sawtooth')
        break
      case 'nitroEmpty':
        T(0, 300, 150, 0.12, 0.05)
        break
      case 'perfect':
        ;[784, 988, 1175, 1568].forEach((f, i) => T(i * 0.05, f, f, 0.1, 0.06, 'triangle'))
        break
      case 'move':
        T(0, 660, 660, 0.04, 0.035)
        break
      case 'select':
        T(0, 988, 988, 0.06, 0.045)
        T(0.06, 1480, 1480, 0.12, 0.045)
        break
      case 'start':
        ;[523, 659, 784, 1047].forEach((f, i) => T(i * 0.07, f, f, 0.12, 0.05))
        break
      case 'buy':
        T(0, 1319, 1319, 0.05, 0.05)
        T(0.05, 1760, 1760, 0.16, 0.05)
        N(0.02, 0.08, 0.06, 'highpass', 4000)
        break
      case 'deny':
        T(0, 160, 120, 0.18, 0.06, 'square')
        break
      case 'podium':
        ;[523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => T(i * 0.13, f, f, i === 7 ? 0.7 : 0.11, 0.06))
        ;[262, 330, 392, 523].forEach((f, i) => T(0.91 + i * 0.02, f, f, 0.8, 0.035, 'triangle'))
        break
      case 'gameover':
        ;[392, 330, 262, 196].forEach((f, i) => T(i * 0.16, f, f, 0.18, 0.06, 'triangle'))
        break
    }
  }

  destroy() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.stopEngine()
    const c = this.ctx
    this.ctx = null
    if (c) void c.close().catch(() => {})
  }
}
