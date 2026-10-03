/**
 * Audio propio de Búnker 93: efectos sintetizados con peso (escopeta brutal,
 * explosiones con sub-grave) y un secuenciador de metal chiptune con guitarra
 * distorsionada, bajo, doble bombo y solista. Respeta isMuted() / isMusicEnabled().
 */
import { isMuted } from '../sfx'
import { isMusicEnabled } from '../music'

export type TrackId = 'calm' | 'combat' | 'boss' | null

type Ctx = AudioContext

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }
function midi(n: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(n)
  if (!m) return 40
  return (parseInt(m[2], 10) + 1) * 12 + NOTE[m[1]]
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

interface Step {
  /** nota raíz de la guitarra (midi) o -1 */
  g: number
  /** 0 = apagado (palm mute), 1 = abierto, 2 = ligado (continúa) */
  gm: number
  b: number
  lead: number
  drum: string
}

interface Song {
  bpm: number
  steps: Step[]
  /** volumen de la guitarra */
  gv: number
  leadType: OscillatorType
}

/**
 * Compositor por compases: cada compás tiene 16 semicorcheas.
 * riff: tokens separados por espacio: 'E2' nota apagada, 'E2!' abierta,
 * '.' sostiene, '-' silencio. drums: k=bombo s=caja h=charles c=platillo x=bombo+charles
 */
function compose(bpm: number, gv: number, leadType: OscillatorType, bars: { riff: string; drums: string; lead?: string }[]): Song {
  const steps: Step[] = []
  for (const bar of bars) {
    const r = bar.riff.split(/\s+/).filter(Boolean)
    const l = (bar.lead ?? '').split(/\s+/).filter(Boolean)
    const d = bar.drums.replace(/\s+/g, '')
    for (let i = 0; i < 16; i++) {
      const tok = r[i] ?? '-'
      let g = -1
      let gm = 0
      if (tok === '.') {
        gm = 2
      } else if (tok !== '-') {
        const open = tok.endsWith('!')
        g = midi(open ? tok.slice(0, -1) : tok)
        gm = open ? 1 : 0
      }
      const lt = l[i] ?? '-'
      const lead = lt === '-' ? -1 : lt === '.' ? -2 : midi(lt)
      steps.push({ g, gm, b: g >= 0 ? g - 12 : -1, lead, drum: d[i] ?? '-' })
    }
  }
  return { bpm, steps, gv, leadType }
}

const K8 = 'k-h-s-h-k-h-s-h-'
const DK = 'kkskkkskkkskkksk'
const GALLOP = 'x-xxs-xxx-xxs-xx'
const BLAST = 'kskskskskskskscs'

// Pista de combate: Mi frigio, 172 bpm
const COMBAT = compose(172, 0.11, 'square', [
  { riff: 'E2 E2 E2 - E2 E2 G2! . E2 E2 E2 - E2 E2 A#2! .', drums: 'c-h-s-h-' + 'k-h-s-hh' },
  { riff: 'E2 E2 E2 - E2 E2 G2! . E2 E2 A2! . G2! . F2! .', drums: K8 },
  { riff: 'E2 E2 E2 - E2 E2 G2! . E2 E2 E2 - E2 E2 A#2! .', drums: GALLOP },
  { riff: 'E2 E2 E2 - E2 E2 G2! . A#2! . A2! . G2! . F#2! .', drums: 'kkskkkskkkskssss' },
  // B: con solista
  { riff: 'C3! . . . C3 C3 C3 C3 D3! . . . D3 D3 D3 D3', drums: DK, lead: 'E5 . . G5 . . A5 . B5 . . A5 . G5 . .' },
  { riff: 'E2! . . . E2 E2 E2 E2 E2 E2 G2! . F#2! . F2! .', drums: DK, lead: 'E5 . . . D5 . E5 . G5 . F#5 . E5 . . .' },
  { riff: 'C3! . . . C3 C3 C3 C3 D3! . . . D3 D3 D3 D3', drums: DK, lead: 'B5 . . A5 . . G5 . A5 . . B5 . C6 . .' },
  { riff: 'E2! . . . E2 E2 E2 E2 A#2! . A2! . G2! . F2! .', drums: 'kkskkkskssssscsc', lead: 'B5 . A5 . G5 . F5 . E5 . . . . . . .' },
  // C: breakdown a medio tiempo
  { riff: 'E2! . . . - - E2 E2 E2! . . . - - F2! .', drums: 'c---k---s---k-k-' },
  { riff: 'E2! . . . - - E2 E2 G2! . . . F#2! . F2! .', drums: 'k---k---s---kkkk' },
])

// Pista del jefe: disminuida, 196 bpm, blast beats
const BOSS = compose(196, 0.12, 'sawtooth', [
  { riff: 'E2 E2 F2 E2 E2 A#2! . . E2 E2 F2 E2 B2! . A#2! .', drums: 'c-h-s-h-k-h-s-hh' },
  { riff: 'E2 E2 F2 E2 E2 A#2! . . E2 E2 G2! . F#2! . F2! .', drums: GALLOP },
  { riff: 'E2 E2 F2 E2 E2 A#2! . . E2 E2 F2 E2 B2! . A#2! .', drums: BLAST, lead: 'E6 . . . A#5 . . . E6 . . . F6 . E6 .' },
  { riff: 'G2! . . . F#2! . . . F2! . . . E2 E2 E2 E2', drums: BLAST, lead: 'G6 . F#6 . F6 . E6 . A#5 . . . . . . .' },
  { riff: 'C3 C3 C#3 C3 C3 F#3! . . C3 C3 C#3 C3 G3! . F#3! .', drums: DK, lead: 'C6 . . C#6 . . F#6 . . . G6 . F#6 . . .' },
  { riff: 'E2 E2 F2 E2 E2 A#2! . . A2! . G#2! . G2! . F2! .', drums: 'kskskskssssscccc', lead: 'E6 . D#6 . D6 . C#6 . C6 . B5 . A#5 . . .' },
])

// Respiro / título: arpegio lúgubre
const CALM = compose(84, 0.05, 'triangle', [
  { riff: 'E2! . . . . . . . . . . . . . . .', drums: 'k-------h-------', lead: 'E4 G4 B4 E5 B4 G4 E4 G4 B4 E5 B4 G4 E4 G4 B4 G4' },
  { riff: 'C3! . . . . . . . . . . . . . . .', drums: 'k-------h-----h-', lead: 'C4 E4 G4 C5 G4 E4 C4 E4 G4 C5 G4 E4 C4 E4 G4 E4' },
  { riff: 'A2! . . . . . . . . . . . . . . .', drums: 'k-------h-------', lead: 'A3 C4 E4 A4 E4 C4 A3 C4 E4 A4 E4 C4 A3 C4 E4 C4' },
  { riff: 'B2! . . . . . . . A#2! . . . . . . .', drums: 'k-------h---s---', lead: 'B3 D#4 F#4 B4 F#4 D#4 B3 D#4 A#3 D4 F4 A#4 F4 D4 A#3 D4' },
])

const SONGS: Record<Exclude<TrackId, null>, Song> = { combat: COMBAT, boss: BOSS, calm: CALM }

export class Audio93 {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private dist: WaveShaperNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private track: TrackId = null
  private stepIdx = 0
  private nextT = 0
  private duck = 1
  private lastSfx: Record<string, number> = {}

  /** Debe llamarse desde un gesto del usuario la primera vez. */
  unlock() {
    if (typeof window === 'undefined') return
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return
        const c = new AC()
        this.ctx = c
        const comp = c.createDynamicsCompressor()
        comp.threshold.value = -14
        comp.knee.value = 10
        comp.ratio.value = 4
        comp.attack.value = 0.003
        comp.release.value = 0.15
        comp.connect(c.destination)
        this.master = c.createGain()
        this.master.gain.value = 0.9
        this.master.connect(comp)
        this.sfxBus = c.createGain()
        this.sfxBus.gain.value = 0.85
        this.sfxBus.connect(this.master)
        this.musicBus = c.createGain()
        this.musicBus.gain.value = 0
        this.musicBus.connect(this.master)
        // distorsión para la guitarra
        const ws = c.createWaveShaper()
        const n = 1024
        const curve = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * 2 - 1
          curve[i] = Math.tanh(x * 6) * 0.8
        }
        ws.curve = curve
        ws.oversample = 'none'
        const cab = c.createBiquadFilter()
        cab.type = 'lowpass'
        cab.frequency.value = 3200
        cab.Q.value = 0.9
        ws.connect(cab)
        cab.connect(this.musicBus)
        this.dist = ws
        // ruido blanco reutilizable
        const len = c.sampleRate * 2
        const buf = c.createBuffer(1, len, c.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
        this.noiseBuf = buf
        this.timer = setInterval(() => this.tick(), 30)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
    } catch {
      this.ctx = null
    }
  }

  setTrack(t: TrackId) {
    if (t === this.track) return
    this.track = t
    this.stepIdx = 0
    if (this.ctx) this.nextT = this.ctx.currentTime + 0.08
  }

  setDuck(v: number) {
    this.duck = v
  }

  private tick() {
    const c = this.ctx
    if (!c || !this.musicBus) return
    if (c.state === 'suspended') return
    const on = !isMuted() && isMusicEnabled() && this.track !== null
    const target = on ? 0.55 * this.duck : 0
    this.musicBus.gain.setTargetAtTime(target, c.currentTime, 0.08)
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(isMuted() ? 0 : 0.85, c.currentTime, 0.02)
    if (!on || !this.track) {
      this.nextT = c.currentTime + 0.05
      return
    }
    const song = SONGS[this.track]
    const spb = 60 / song.bpm / 4
    if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05
    while (this.nextT < c.currentTime + 0.14) {
      this.playStep(song, this.stepIdx, this.nextT, spb)
      this.stepIdx = (this.stepIdx + 1) % song.steps.length
      this.nextT += spb
    }
  }

  private playStep(song: Song, i: number, t: number, spb: number) {
    const c = this.ctx
    if (!c || !this.musicBus || !this.dist) return
    const s = song.steps[i]
    if (s.g >= 0) {
      // duración: cuenta los pasos ligados que siguen
      let n = 1
      while (n < 16 && song.steps[(i + n) % song.steps.length].gm === 2) n++
      const open = s.gm === 1
      const dur = open ? spb * n * 0.95 : spb * 0.55
      for (const iv of [0, 7, 12]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = hz(s.g + iv)
        o.detune.value = iv === 0 ? -6 : iv === 7 ? 5 : 0
        const g = c.createGain()
        const v = song.gv * (iv === 12 ? 0.5 : 1)
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(v, t + 0.004)
        g.gain.setValueAtTime(v, t + dur * 0.7)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        o.connect(g)
        if (open) {
          g.connect(this.dist)
        } else {
          const f = c.createBiquadFilter()
          f.type = 'lowpass'
          f.frequency.value = 900
          g.connect(f)
          f.connect(this.dist)
        }
        o.start(t)
        o.stop(t + dur + 0.02)
      }
      // bajo
      const b = c.createOscillator()
      b.type = 'triangle'
      b.frequency.value = hz(s.b)
      const bg = c.createGain()
      bg.gain.setValueAtTime(0.32, t)
      bg.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(spb * 0.9, dur))
      b.connect(bg)
      bg.connect(this.musicBus)
      b.start(t)
      b.stop(t + Math.max(spb, dur) + 0.02)
    }
    if (s.lead >= 0) {
      let n = 1
      while (n < 16 && song.steps[(i + n) % song.steps.length].lead === -2) n++
      const dur = spb * n * 0.95
      const o = c.createOscillator()
      o.type = song.leadType
      o.frequency.value = hz(s.lead)
      // vibrato
      const lfo = c.createOscillator()
      lfo.frequency.value = 6
      const lg = c.createGain()
      lg.gain.setValueAtTime(0, t)
      lg.gain.linearRampToValueAtTime(hz(s.lead) * 0.012, t + Math.min(0.25, dur))
      lfo.connect(lg)
      lg.connect(o.frequency)
      const g = c.createGain()
      const v = song.leadType === 'triangle' ? 0.09 : 0.05
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(v, t + 0.01)
      g.gain.setValueAtTime(v, t + dur * 0.8)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g)
      g.connect(this.musicBus)
      o.start(t)
      lfo.start(t)
      o.stop(t + dur + 0.02)
      lfo.stop(t + dur + 0.02)
    }
    const d = s.drum
    if (d === 'k' || d === 'x') this.kick(t, 0.5)
    if (d === 's') this.snare(t, 0.32)
    if (d === 'h' || d === 'x') this.hat(t, 0.07)
    if (d === 'c') {
      this.kick(t, 0.5)
      this.noiseHit(this.musicBus, t, 0.9, 0.14, 'highpass', 5000)
    }
  }

  private kick(t: number, v: number) {
    const c = this.ctx
    if (!c || !this.musicBus) return
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.09)
    const g = c.createGain()
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(g)
    g.connect(this.musicBus)
    o.start(t)
    o.stop(t + 0.18)
    this.noiseHit(this.musicBus, t, 0.012, v * 0.4, 'highpass', 3000)
  }

  private snare(t: number, v: number) {
    const c = this.ctx
    if (!c || !this.musicBus) return
    this.noiseHit(this.musicBus, t, 0.14, v, 'bandpass', 1800)
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(240, t)
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08)
    const g = c.createGain()
    g.gain.setValueAtTime(v * 0.6, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    o.connect(g)
    g.connect(this.musicBus)
    o.start(t)
    o.stop(t + 0.1)
  }

  private hat(t: number, v: number) {
    if (this.musicBus) this.noiseHit(this.musicBus, t, 0.03, v, 'highpass', 7000)
  }

  private noiseHit(dest: AudioNode, t: number, dur: number, v: number, type: BiquadFilterType, freq: number, freqTo?: number, q = 0.8) {
    const c = this.ctx
    if (!c || !this.noiseBuf) return
    const src = c.createBufferSource()
    src.buffer = this.noiseBuf
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur)
    f.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(dest)
    const off = Math.random() * 1.5
    src.start(t, off, dur + 0.05)
  }

  private osc(t: number, type: OscillatorType, f0: number, f1: number, dur: number, v: number, pan = 0, dest?: AudioNode) {
    const c = this.ctx
    if (!c || !this.sfxBus) return
    const o = c.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    this.route(g, pan, dest)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private route(node: AudioNode, pan: number, dest?: AudioNode) {
    const c = this.ctx
    if (!c || !this.sfxBus) return
    const out = dest ?? this.sfxBus
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner()
      p.pan.value = Math.max(-1, Math.min(1, pan))
      node.connect(p)
      p.connect(out)
    } else node.connect(out)
  }

  private nz(t: number, dur: number, v: number, type: BiquadFilterType, f0: number, f1?: number, pan = 0, q = 0.8) {
    const c = this.ctx
    if (!c || !this.sfxBus || !this.noiseBuf) return
    const src = c.createBufferSource()
    src.buffer = this.noiseBuf
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(f0, t)
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur)
    f.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    this.route(g, pan)
    src.start(t, Math.random() * 1.5, dur + 0.05)
  }

  private ok(key?: string, gap = 0): number {
    const c = this.ctx
    if (!c || isMuted() || c.state !== 'running') return -1
    const now = c.currentTime
    if (key) {
      if (now - (this.lastSfx[key] ?? -1) < gap) return -1
      this.lastSfx[key] = now
    }
    return now
  }

  // ----------------------------------------------------------------- armas
  pistol() {
    const t = this.ok()
    if (t < 0) return
    this.nz(t, 0.14, 0.7, 'bandpass', 2400, 600, 0, 0.7)
    this.osc(t, 'square', 520, 110, 0.09, 0.22)
    this.osc(t, 'sine', 150, 50, 0.12, 0.4)
  }

  shotgun(double = false) {
    const t = this.ok()
    if (t < 0) return
    const v = double ? 1.3 : 1
    // estallido
    this.nz(t, 0.45 * v, 1.1 * v, 'lowpass', 7000, 260)
    this.nz(t, 0.08, 0.8, 'highpass', 3000)
    this.osc(t, 'sine', 130, 34, 0.35, 0.9 * v)
    this.osc(t, 'sawtooth', 90, 40, 0.18, 0.35)
    // corredera: chk-chk
    const p = t + (double ? 0.5 : 0.38)
    this.nz(p, 0.05, 0.45, 'bandpass', 1500, 900, 0, 2)
    this.osc(p, 'square', 300, 180, 0.03, 0.08)
    this.nz(p + 0.13, 0.06, 0.5, 'bandpass', 1100, 1800, 0, 2)
    this.osc(p + 0.13, 'square', 220, 340, 0.03, 0.08)
  }

  chaingun() {
    const t = this.ok()
    if (t < 0) return
    const k = 0.9 + Math.random() * 0.2
    this.nz(t, 0.1, 0.6, 'bandpass', 2000 * k, 500, 0, 0.8)
    this.osc(t, 'sine', 160 * k, 55, 0.08, 0.38)
    this.osc(t, 'square', 700 * k, 200, 0.04, 0.08)
  }

  rocketLaunch() {
    const t = this.ok()
    if (t < 0) return
    this.nz(t, 0.6, 0.7, 'lowpass', 1600, 300)
    this.osc(t, 'sawtooth', 220, 70, 0.35, 0.22)
    this.osc(t, 'sine', 90, 40, 0.25, 0.5)
  }

  plasma() {
    const t = this.ok()
    if (t < 0) return
    this.osc(t, 'sawtooth', 1500 + Math.random() * 200, 260, 0.13, 0.13)
    this.osc(t, 'sine', 2600, 900, 0.1, 0.12)
    this.nz(t, 0.06, 0.2, 'highpass', 4000)
  }

  click() {
    const t = this.ok('click', 0.2)
    if (t < 0) return
    this.osc(t, 'square', 900, 700, 0.03, 0.12)
  }

  weaponSwitch() {
    const t = this.ok('switch', 0.05)
    if (t < 0) return
    this.nz(t, 0.05, 0.3, 'bandpass', 1400, 2200, 0, 3)
    this.nz(t + 0.08, 0.05, 0.3, 'bandpass', 2000, 1200, 0, 3)
  }

  // ----------------------------------------------------------- impactos
  explosion(size = 1, pan = 0, vol = 1) {
    const t = this.ok('expl', 0.03)
    if (t < 0) return
    const v = Math.min(1.4, vol)
    this.nz(t, 0.9 * size, 1.2 * v, 'lowpass', 2400, 120, pan)
    this.nz(t, 0.15, 0.6 * v, 'highpass', 2000, undefined, pan)
    this.osc(t, 'sine', 90, 24, 0.7 * size, 1.0 * v, pan)
    this.osc(t, 'triangle', 60, 20, 0.5 * size, 0.6 * v, pan)
  }

  ricochet(pan = 0) {
    const t = this.ok('ric', 0.04)
    if (t < 0) return
    this.osc(t, 'square', 1800 + Math.random() * 1500, 600, 0.06, 0.05, pan)
  }

  fleshHit(pan = 0) {
    const t = this.ok('flesh', 0.03)
    if (t < 0) return
    this.nz(t, 0.08, 0.5, 'lowpass', 900, 300, pan)
    this.osc(t, 'sine', 120, 60, 0.07, 0.25, pan)
  }

  metalHit(pan = 0) {
    const t = this.ok('metal', 0.04)
    if (t < 0) return
    this.osc(t, 'square', 1400, 900, 0.05, 0.08, pan)
    this.osc(t, 'triangle', 2600, 2200, 0.08, 0.06, pan)
  }

  // ------------------------------------------------------------ enemigos
  growl(kind: string, pan = 0, vol = 0.5) {
    const t = this.ok('growl', 0.25)
    if (t < 0) return
    const base = kind === 'tank' ? 55 : kind === 'swarm' ? 420 : kind === 'spitter' ? 90 : kind === 'soldier' ? 140 : 110
    const c = this.ctx
    if (!c) return
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(base * 1.3, t)
    o.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.45)
    const lfo = c.createOscillator()
    lfo.frequency.value = 23
    const lg = c.createGain()
    lg.gain.value = base * 0.25
    lfo.connect(lg)
    lg.connect(o.frequency)
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = base * 6
    f.Q.value = 1.5
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35 * vol, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(f)
    f.connect(g)
    this.route(g, pan)
    o.start(t)
    lfo.start(t)
    o.stop(t + 0.55)
    lfo.stop(t + 0.55)
  }

  enemyPain(kind: string, pan = 0) {
    const t = this.ok('pain', 0.06)
    if (t < 0) return
    const b = kind === 'tank' ? 120 : kind === 'swarm' ? 900 : 260
    this.osc(t, 'square', b * 1.5, b * 0.6, 0.12, 0.12, pan)
    this.nz(t, 0.06, 0.2, 'bandpass', b * 4, b * 2, pan)
  }

  enemyDeath(kind: string, pan = 0, gib = false) {
    const t = this.ok('death', 0.05)
    if (t < 0) return
    const b = kind === 'tank' ? 90 : kind === 'swarm' ? 700 : kind === 'spitter' ? 160 : 220
    this.osc(t, 'sawtooth', b * 1.6, b * 0.3, 0.5, 0.2, pan)
    this.nz(t, 0.35, 0.3, 'lowpass', 1200, 200, pan)
    if (gib) {
      this.nz(t, 0.25, 0.7, 'lowpass', 900, 150, pan)
      this.osc(t + 0.05, 'sine', 80, 30, 0.2, 0.5, pan)
    }
  }

  enemyShot(pan = 0, vol = 0.6) {
    const t = this.ok('eshot', 0.05)
    if (t < 0) return
    this.nz(t, 0.12, 0.5 * vol, 'bandpass', 1600, 500, pan)
    this.osc(t, 'square', 380, 120, 0.08, 0.12 * vol, pan)
  }

  spit(pan = 0) {
    const t = this.ok('spit', 0.08)
    if (t < 0) return
    this.nz(t, 0.25, 0.5, 'bandpass', 600, 2400, pan, 3)
    this.osc(t, 'sine', 300, 900, 0.18, 0.18, pan)
  }

  splat(pan = 0) {
    const t = this.ok('splat', 0.05)
    if (t < 0) return
    this.nz(t, 0.2, 0.5, 'lowpass', 1400, 200, pan)
  }

  swing(pan = 0) {
    const t = this.ok('swing', 0.08)
    if (t < 0) return
    this.nz(t, 0.16, 0.45, 'bandpass', 800, 2600, pan, 2)
  }

  spawn(pan = 0) {
    const t = this.ok('spawn', 0.1)
    if (t < 0) return
    this.osc(t, 'sawtooth', 120, 900, 0.35, 0.08, pan)
    this.nz(t, 0.35, 0.18, 'bandpass', 500, 3000, pan, 2)
  }

  bossRoar(kind: string) {
    const t = this.ok('roar', 0.6)
    if (t < 0) return
    const b = kind === 'boss2' ? 70 : kind === 'boss3' ? 50 : 60
    for (const k of [1, 1.5, 2.02]) this.osc(t, 'sawtooth', b * k * 1.4, b * k * 0.7, 1.4, 0.18)
    this.nz(t, 1.3, 0.6, 'lowpass', 1200, 150)
    if (kind === 'boss2') {
      this.osc(t, 'square', 880, 440, 0.4, 0.08)
      this.osc(t + 0.4, 'square', 880, 440, 0.4, 0.08)
    }
  }

  stomp() {
    const t = this.ok('stomp', 0.2)
    if (t < 0) return
    this.osc(t, 'sine', 70, 28, 0.35, 0.8)
    this.nz(t, 0.2, 0.4, 'lowpass', 500, 100)
  }

  laserCharge() {
    const t = this.ok('charge', 0.4)
    if (t < 0) return
    this.osc(t, 'sawtooth', 200, 1600, 0.6, 0.08)
  }

  // ------------------------------------------------------------- jugador
  hurt() {
    const t = this.ok('hurt', 0.18)
    if (t < 0) return
    const c = this.ctx
    if (!c) return
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(190, t)
    o.frequency.exponentialRampToValueAtTime(110, t + 0.22)
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 700
    f.Q.value = 2
    const g = c.createGain()
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    o.connect(f)
    f.connect(g)
    this.route(g, 0)
    o.start(t)
    o.stop(t + 0.27)
    this.nz(t, 0.08, 0.4, 'lowpass', 800, 200)
  }

  playerDeath() {
    const t = this.ok()
    if (t < 0) return
    this.osc(t, 'sawtooth', 260, 60, 1.2, 0.3)
    this.osc(t, 'sawtooth', 300, 70, 1.2, 0.2)
    this.nz(t, 0.6, 0.6, 'lowpass', 1200, 100)
  }

  step(v = 1) {
    const t = this.ok('step', 0.15)
    if (t < 0) return
    this.nz(t, 0.05, 0.12 * v, 'lowpass', 400, 120)
  }

  pickup(kind: 'health' | 'armor' | 'ammo' | 'weapon' | 'upgrade') {
    const t = this.ok('pick', 0.05)
    if (t < 0) return
    if (kind === 'weapon') {
      ;[0, 4, 7, 12, 16].forEach((s, i) => this.osc(t + i * 0.06, 'square', hz(64 + s), hz(64 + s), 0.12, 0.09))
      this.shotgunRack(t + 0.32)
    } else if (kind === 'upgrade') {
      ;[0, 7, 12, 16, 19, 24].forEach((s, i) => this.osc(t + i * 0.05, 'triangle', hz(72 + s), hz(72 + s), 0.25, 0.14))
    } else if (kind === 'health') {
      this.osc(t, 'square', 660, 660, 0.06, 0.08)
      this.osc(t + 0.06, 'square', 990, 990, 0.1, 0.08)
    } else if (kind === 'armor') {
      this.osc(t, 'triangle', 440, 880, 0.12, 0.14)
      this.nz(t, 0.08, 0.2, 'highpass', 3000)
    } else {
      this.nz(t, 0.04, 0.3, 'bandpass', 1800, 1800, 0, 3)
      this.osc(t, 'square', 520, 520, 0.05, 0.06)
    }
  }

  private shotgunRack(t: number) {
    this.nz(t, 0.05, 0.45, 'bandpass', 1500, 900, 0, 2)
    this.nz(t + 0.13, 0.06, 0.5, 'bandpass', 1100, 1800, 0, 2)
  }

  waveStart() {
    const t = this.ok()
    if (t < 0) return
    for (let i = 0; i < 3; i++) {
      this.osc(t + i * 0.5, 'square', 520, 880, 0.24, 0.08)
      this.osc(t + i * 0.5 + 0.25, 'square', 880, 520, 0.24, 0.08)
    }
  }

  waveClear() {
    const t = this.ok()
    if (t < 0) return
    ;[0, 3, 7, 12].forEach((s, i) => this.osc(t + i * 0.09, 'square', hz(64 + s), hz(64 + s), 0.18, 0.1))
    this.osc(t + 0.36, 'square', hz(76), hz(76), 0.5, 0.1)
  }

  select() {
    const t = this.ok('sel', 0.04)
    if (t < 0) return
    this.osc(t, 'square', 700, 900, 0.05, 0.07)
  }

  shockwave() {
    const t = this.ok()
    if (t < 0) return
    this.osc(t, 'sine', 60, 400, 0.5, 0.6)
    this.nz(t, 0.6, 0.7, 'bandpass', 300, 3000, 0, 1)
  }

  zap(pan = 0) {
    const t = this.ok('zap', 0.05)
    if (t < 0) return
    this.nz(t, 0.12, 0.35, 'bandpass', 3000, 6000, pan, 4)
    this.osc(t, 'square', 1200, 2400, 0.08, 0.06, pan)
  }

  dispose() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.ctx) {
      try {
        void this.ctx.close()
      } catch {
        // ya cerrado
      }
    }
    this.ctx = null
  }
}
