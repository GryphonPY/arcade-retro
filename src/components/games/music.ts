'use client'

/**
 * Motor de música chiptune por juego: mini-secuenciador WebAudio con
 * bajo, melodía y percusión sintetizados (sin archivos externos).
 * - La preferencia de música se persiste en localStorage (arcade-music).
 * - El silencio global (arcade-muted de sfx.ts) también pausa la música.
 * - Requiere un gesto del usuario: primeMusic() engancha el primer
 *   pointerdown/keydown para arrancar el AudioContext.
 */
import { isMuted } from './sfx'

let musicOn = true

export function loadMusicPref(): boolean {
  if (typeof window === 'undefined') return musicOn
  try {
    musicOn = window.localStorage.getItem('arcade-music') !== '0'
  } catch {
    // sin acceso a localStorage
  }
  return musicOn
}

export function isMusicEnabled(): boolean {
  return musicOn
}

export function setMusicEnabled(v: boolean): void {
  musicOn = v
  try {
    window.localStorage.setItem('arcade-music', v ? '1' : '0')
  } catch {
    // sin acceso a localStorage
  }
  if (v) {
    ac()
    ensureLoop()
  }
}

// ===== AudioContext propio (independiente al de sfx) =====

let ctx: AudioContext | null = null
let master: GainNode | null = null

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

function getMaster(c: AudioContext): GainNode {
  if (!master) {
    master = c.createGain()
    master.gain.value = 0.55
    master.connect(c.destination)
  }
  return master
}

// ===== Notas =====

const NOTE_CACHE = new Map<string, number>()
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function noteFreq(n: string): number {
  const hit = NOTE_CACHE.get(n)
  if (hit) return hit
  const m = /^([A-G])(#?)(\d)$/.exec(n)
  if (!m) return 440
  const midi = (parseInt(m[3], 10) + 1) * 12 + SEMI[m[1]] + (m[2] ? 1 : 0)
  const f = 440 * Math.pow(2, (midi - 69) / 12)
  NOTE_CACHE.set(n, f)
  return f
}

// ===== Definición de pistas (rejilla de corcheas, '-' silencio, '.' ata la nota previa) =====

interface TrackDef {
  bpm: number
  bass: string
  lead: string
  leadType: OscillatorType
  bassType?: OscillatorType
  leadVol?: number
  bassVol?: number
  drums?: string
}

interface NoteEv {
  f: number
  steps: number
}

interface Built {
  spb: number
  len: number
  bass: (NoteEv | null)[]
  lead: (NoteEv | null)[]
  drums: string[]
  leadType: OscillatorType
  bassType: OscillatorType
  leadVol: number
  bassVol: number
}

const R8 = 'k-h-s-h-'
const R8F = 'k-h-s-h-k-h-s-sh' // con contratiempo funky
const HAT = 'h-h-h-h-'

const DEFS: Record<string, TrackDef> = {
  // Sala arcade: chill, C – Am – F – G
  hub: {
    bpm: 92,
    bass: 'C3 - - - G2 - - - A2 - - - E2 - - - F2 - - - C3 - - - G2 - - - B2 - - -',
    lead: 'E4 G4 C5 G4 E4 C5 - - C4 E4 A4 E4 C4 A4 - - C4 F4 A4 F4 C4 A4 - - B3 D4 G4 D4 B3 G4 - -',
    leadType: 'triangle',
    leadVol: 0.034,
    bassVol: 0.05,
    drums: HAT.repeat(4),
  },
  // Snake Neón: synthwave Am – F – C – G
  'snake-neon': {
    bpm: 112,
    bass: 'A2 A2 A3 A2 A2 A3 A2 A3 F2 F2 F3 F2 F2 F3 F2 F3 C3 C3 C4 C3 C3 C4 C3 C4 G2 G2 G3 G2 G2 G3 G2 B2',
    lead: 'A4 - C5 E5 A5 - E5 C5 F4 - A4 C5 F5 - C5 A4 C5 - E5 G5 C6 - G5 E5 B4 - D5 G5 B5 - G5 D5',
    leadType: 'square',
    leadVol: 0.026,
    drums: R8.repeat(4),
  },
  // Invasión Espacial: driver Em – C – D – Em
  'space-invasion': {
    bpm: 140,
    bassType: 'sawtooth',
    bass: 'E2 E2 E3 E2 E2 E3 E2 E3 C2 C2 C3 C2 C2 C3 C2 C3 D2 D2 D3 D2 D2 D3 D2 D3 E2 E2 E3 E2 E2 E3 E2 E3',
    lead: 'E4 G4 B4 E5 - D5 B4 G4 A4 - C5 - E5 C5 A4 - B4 - G4 - E4 G4 B4 D5 E5 - B4 G4 E5 - - -',
    leadType: 'square',
    leadVol: 0.028,
    bassVol: 0.045,
    drums: R8.repeat(4),
  },
  // Corredor del Desierto: country bounce C – F – G – C
  'desert-runner': {
    bpm: 138,
    bass: 'C3 - G2 - C3 - E3 - F2 - C3 - F2 - A2 - G2 - D3 - G2 - B2 - C3 - G2 - E3 - G2 -',
    lead: 'E4 G4 A4 G4 E4 D4 C4 - D4 E4 G4 E4 D4 C4 A3 - C4 D4 E4 G4 A4 G4 E4 G4 A4 G4 E4 D4 C4 - G4 -',
    leadType: 'square',
    leadVol: 0.026,
    drums: R8.repeat(3) + 'k-h-s-hh',
  },
  // Laberinto Fantasma: saltarín F – Dm – Bb – C
  'ghost-maze': {
    bpm: 120,
    bass: 'F2 - F2 - C3 - F2 - D2 - D2 - A2 - D2 - A#2 - A#2 - F2 - A#2 - C3 - C3 - G2 - C3 -',
    lead: 'A4 C5 F5 C5 A4 F4 A4 - D4 F4 A4 F5 D5 A4 D4 - F4 A#4 D5 A#4 F5 D5 A#4 F4 E4 G4 C5 G4 E5 C5 G4 E4',
    leadType: 'triangle',
    leadVol: 0.032,
    drums: 'h-h-s-h-'.repeat(4),
  },
  // Carrera de Tráfico: dark wave Dm – Bb – G – A
  'traffic-racer': {
    bpm: 118,
    bassType: 'sawtooth',
    bass: 'D2 D2 D3 D2 D2 D3 D2 D3 A#2 A#2 A#3 A#2 A#2 A#3 A#2 A#3 G2 G2 G3 G2 G2 G3 G2 G3 A2 A2 A3 A2 A2 A3 A2 C#3',
    lead: 'D4 - F4 - A4 - F4 - D5 - C5 - A4 - F4 - A4 - C5 - D5 - F5 - D5 C5 A4 - C#5 - E5 -',
    leadType: 'square',
    leadVol: 0.024,
    bassVol: 0.048,
    drums: R8.repeat(4),
  },
  // Rompe Ladrillos: pastel G – Em – C – D
  'brick-breaker': {
    bpm: 102,
    bass: 'G2 - D3 - G2 - B2 - E2 - B2 - E3 - B2 - C3 - G2 - C3 - E3 - D3 - A2 - D3 - F#2 -',
    lead: 'B4 - D5 - G5 - D5 - E5 - B4 - G4 - B4 - C5 - E5 - G5 - E5 - D5 - A4 - F#4 - A4 -',
    leadType: 'triangle',
    leadVol: 0.034,
    drums: 'k-h-h-h-'.repeat(4),
  },
  // Hit & Run: funk persecución Em – A – E – C
  'hit-and-run': {
    bpm: 126,
    bassType: 'sawtooth',
    bass: 'E2 - E2 E3 - E2 G2 - A2 - A2 A3 - A2 B2 - E2 - E2 E3 - E2 D2 - C2 - C2 C3 - C2 B1 -',
    lead: 'E4 G4 A4 - G4 E4 - - E4 G4 A4 - B4 A4 G4 - E4 G4 A4 - G4 E4 D4 - C4 D4 E4 - B3 - D4 -',
    leadType: 'square',
    leadVol: 0.024,
    bassVol: 0.048,
    drums: R8F.repeat(2),
  },
  // Gun & Run: acción heroica Am – F – G – Am
  'gun-and-run': {
    bpm: 140,
    bassType: 'sawtooth',
    bass: 'A2 A2 A2 A3 A2 A2 A2 A3 F2 F2 F2 F3 F2 F2 F2 F3 G2 G2 G2 G3 G2 G2 G2 G3 A2 A2 A2 A3 G2 G2 G2 B2',
    lead: 'A4 - E5 - A5 - E5 - F5 - E5 - D5 - C5 - B4 - D5 - G5 - D5 - E5 D5 C5 B4 A4 - E4 -',
    leadType: 'square',
    leadVol: 0.028,
    bassVol: 0.048,
    drums: R8F.repeat(2),
  },
  // Asteroid Drift: vector space synthwave Fm – C# – D# – Fm
  'asteroid-drift': {
    bpm: 144,
    bassType: 'sawtooth',
    bass: 'F2 F2 F3 F2 F2 F3 F2 F3 C#2 C#2 C#3 C#2 C#2 C#3 C#2 C#3 D#2 D#2 D#3 D#2 D#2 D#3 D#2 D#3 F2 F2 F3 F2 G#2 - C3 -',
    lead: 'F4 - G#4 - C5 - G#4 - F5 - D#5 - C5 - G#4 - C#5 - F5 - G#5 - F5 - D#5 - F5 - C5 - G#4 -',
    leadType: 'square',
    leadVol: 0.026,
    bassVol: 0.046,
    drums: R8F.repeat(2),
  },
  // Cyber Dungeon: mazecraft rogue Dm – Gm – Bb – A
  'cyber-dungeon': {
    bpm: 114,
    bassType: 'sawtooth',
    bass: 'D2 - D2 A2 D3 - D2 - G2 - G2 D3 G3 - G2 - A#2 - A#2 F3 A#3 - A#2 - A2 - A2 E3 A3 - C#3 -',
    lead: 'D4 F4 A4 D5 - C5 A4 F4 G4 - A#4 - D5 A#4 G4 - F4 A4 D5 F5 E5 D5 C#5 D5 E5 - A4 - C#5 -',
    leadType: 'triangle',
    leadVol: 0.032,
    bassVol: 0.048,
    drums: R8.repeat(4),
  },
}

function build(id: string): Built {
  const d = DEFS[id] ?? DEFS.hub
  const bass = d.bass.trim().split(/\s+/)
  const lead = d.lead.trim().split(/\s+/)
  const drums = (d.drums ?? '').split('')
  const len = Math.max(bass.length, lead.length, drums.length, 1)
  while (bass.length < len) bass.push('-')
  while (lead.length < len) lead.push('-')
  while (drums.length < len) drums.push('-')

  const toEvents = (toks: string[]) =>
    toks.map<NoteEv | null>((t) => (t === '-' || t === '.' ? null : { f: noteFreq(t), steps: 1 }))

  const bassEv = toEvents(bass)
  const leadEv = toEvents(lead)
  // '.' extiende la nota anterior (sustain)
  const tie = (evs: (NoteEv | null)[], toks: string[]) => {
    let last: NoteEv | null = null
    for (let i = 0; i < evs.length; i++) {
      if (toks[i] === '.' && last) last.steps++
      else last = evs[i]
    }
    return evs
  }

  return {
    spb: 60 / d.bpm / 2,
    len,
    bass: tie(bassEv, bass),
    lead: tie(leadEv, lead),
    drums,
    leadType: d.leadType,
    bassType: d.bassType ?? 'triangle',
    leadVol: d.leadVol ?? 0.028,
    bassVol: d.bassVol ?? 0.05,
  }
}

// ===== Voz: notas y percusión =====

function playNote(c: AudioContext, when: number, f: number, dur: number, type: OscillatorType, vol: number) {
  try {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f, when)
    g.gain.setValueAtTime(vol, when)
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.04, dur))
    osc.connect(g)
    g.connect(getMaster(c))
    osc.start(when)
    osc.stop(when + dur + 0.03)
  } catch {
    // audio no disponible
  }
}

function noiseBurst(c: AudioContext, when: number, dur: number, vol: number, freq: number, hp: boolean) {
  try {
    const len = Math.max(1, Math.floor(c.sampleRate * dur))
    const buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    const filter = c.createBiquadFilter()
    filter.type = hp ? 'highpass' : 'bandpass'
    filter.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(vol, when)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(getMaster(c))
    src.start(when)
  } catch {
    // audio no disponible
  }
}

function drum(c: AudioContext, when: number, kind: string) {
  if (kind === 'k') {
    try {
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(150, when)
      osc.frequency.exponentialRampToValueAtTime(42, when + 0.12)
      g.gain.setValueAtTime(0.1, when)
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.13)
      osc.connect(g)
      g.connect(getMaster(c))
      osc.start(when)
      osc.stop(when + 0.15)
    } catch {
      // audio no disponible
    }
  } else if (kind === 's') {
    noiseBurst(c, when, 0.09, 0.05, 1800, false)
  } else if (kind === 'h') {
    noiseBurst(c, when, 0.03, 0.016, 6500, true)
  }
}

// ===== Secuenciador =====

let timer: ReturnType<typeof setInterval> | null = null
let currentId = 'hub'
let step = 0
let nextT = 0

function scheduleStep(c: AudioContext, t: Built, i: number, when: number) {
  const d = t.spb
  const bn = t.bass[i]
  if (bn) playNote(c, when, bn.f, d * 0.92 * bn.steps, t.bassType, t.bassVol)
  const ln = t.lead[i]
  if (ln) playNote(c, when, ln.f, d * 0.88 * ln.steps, t.leadType, t.leadVol)
  const dk = t.drums[i]
  if (dk && dk !== '-') drum(c, when, dk)
}

function ensureLoop() {
  if (timer || typeof window === 'undefined') return
  timer = setInterval(() => {
    const c = ac()
    if (!c) return
    if (c.state === 'suspended') {
      void c.resume().catch(() => {})
      return
    }
    if (!musicOn || isMuted() || !DEFS[currentId]) {
      // pausa: congela la posición del loop sin acumular retraso
      nextT = c.currentTime + 0.08
      return
    }
    const t = build(currentId)
    if (nextT < c.currentTime - 0.25) nextT = c.currentTime + 0.06
    while (nextT < c.currentTime + 0.16) {
      scheduleStep(c, t, step, nextT)
      step = (step + 1) % t.len
      nextT += t.spb
    }
  }, 40)
}

/** Cambia la pista musical (por id de juego) sin cortar el AudioContext. */
export function startMusic(id: string): void {
  if (currentId !== id) {
    currentId = DEFS[id] ? id : 'hub'
    step = 0
    nextT = 0
  }
  ac()
  ensureLoop()
}

/** Engancha el primer gesto del usuario para arrancar la música (autoplay policy). */
let primed = false
export function primeMusic(): void {
  if (primed || typeof window === 'undefined') return
  primed = true
  const kick = () => {
    if (!musicOn || isMuted()) return
    ac()
    ensureLoop()
    window.removeEventListener('pointerdown', kick)
    window.removeEventListener('keydown', kick)
  }
  window.addEventListener('pointerdown', kick)
  window.addEventListener('keydown', kick)
}
