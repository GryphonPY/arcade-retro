/**
 * Banda sonora chiptune de Nebula Strike: secuenciador propio con 4 voces
 * (melodía con eco, arpegio, bajo y batería) y pistas definidas por acordes +
 * melodía por compás. Lee isMuted()/isMusicEnabled() en cada tick.
 */
import { isMuted } from '../sfx'
import { isMusicEnabled } from '../music'
import { audio, drumHit, musicOut, setWave, type Wave } from './audio'

export type SongId = 'title' | 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 'boss'

type BassStyle = 'gallop' | 'drive' | 'synco' | 'pulse' | 'half'
type ArpStyle = 'up' | 'updown' | 'broken'
type DrumStyle = 'rock' | 'dnb' | 'four' | 'half' | 'title' | 'boss'

interface SongDef {
  bpm: number
  chords: string[]
  mel: string[]
  chordsB: string[]
  melB: string[]
  bass: BassStyle
  arp: ArpStyle
  drums: DrumStyle
  lead: Wave
  leadVol?: number
  arpVol?: number
  bassVol?: number
}

// ===================== Composiciones =====================

const SONGS: Record<SongId, SongDef> = {
  // Tema principal: heroico en Mi menor
  title: {
    bpm: 132,
    chords: ['Em', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'B'],
    mel: [
      'E5 . B4 . E5 F#5 G5 .',
      'G5 . F#5 E5 D5 . E5 .',
      'F#5 . A5 . D6 . C6 B5',
      'B5 . . . A5 . F#5 .',
      'E5 . B4 . E5 F#5 G5 .',
      'G5 A5 B5 . C6 . B5 A5',
      'A5 . F#5 . D5 . A5 .',
      'B5 . . . D#5 . F#5 .',
    ],
    chordsB: ['C', 'D', 'Em', 'Em', 'Am', 'B', 'Em', 'Em'],
    melB: [
      'E6 . D6 . C6 . G5 .',
      'F#5 . A5 . D6 . . .',
      'B5 . G5 . E5 . G5 B5',
      'E6 . . . . . - -',
      'C6 . B5 . A5 . E5 .',
      'D#6 . . . B5 . F#5 .',
      'G5 F#5 G5 B5 E6 . D6 .',
      'E6 . . . - - - -',
    ],
    bass: 'drive',
    arp: 'up',
    drums: 'title',
    lead: 'pulse25',
  },
  // Sector 1: Nebulosa Cian (La menor, enérgico)
  s1: {
    bpm: 150,
    chords: ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E'],
    mel: [
      'A4 . C5 . E5 . A5 .',
      'G5 . F5 . E5 . C5 .',
      'D5 . G5 . B5 . D6 .',
      'B5 . . . G5 . E5 .',
      'A5 . G5 A5 C6 . A5 .',
      'F5 . A5 . C6 . F6 .',
      'D6 . B5 . G5 . D5 .',
      'E5 . G#5 . B5 . E6 .',
    ],
    chordsB: ['Dm', 'Am', 'Bb', 'C', 'Dm', 'Am', 'E', 'E'],
    melB: [
      'D6 . . A5 F5 . D5 .',
      'E5 . A5 . C6 . E6 .',
      'D6 . C6 . A#5 . F5 .',
      'G5 . . . E5 . C5 .',
      'F5 . A5 . D6 . F6 .',
      'E6 . C6 . A5 . E5 .',
      'G#5 . B5 . E6 . D6 .',
      'B5 . . . G#5 . E5 .',
    ],
    bass: 'gallop',
    arp: 'updown',
    drums: 'rock',
    lead: 'pulse25',
  },
  // Sector 2: Cinturón Magenta (Re menor, sincopado)
  s2: {
    bpm: 156,
    chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'],
    mel: [
      'D5 - F5 D5 - A5 - G5',
      'F5 - E5 D5 - C5 D5 -',
      'A#4 - D5 F5 - A#5 - A5',
      'G5 - E5 C5 - G5 . .',
      'D6 - C6 A5 - F5 - A5',
      'G5 - F5 E5 - D5 - E5',
      'F5 - G5 A#5 - D6 - C6',
      'A5 . . . C#6 . E6 .',
    ],
    chordsB: ['F', 'C', 'Gm', 'A', 'F', 'C', 'Bb', 'A'],
    melB: [
      'C6 . A5 . F5 . A5 C6',
      'E6 . . . C6 . G5 .',
      'D6 . A#5 . G5 . A#5 D6',
      'C#6 . . . A5 . E5 .',
      'F5 A5 C6 F6 . . C6 A5',
      'G5 C6 E6 G6 . . E6 C6',
      'F6 . D6 . A#5 . F5 .',
      'E6 . C#6 . A5 . - -',
    ],
    bass: 'synco',
    arp: 'broken',
    drums: 'dnb',
    lead: 'square',
    leadVol: 0.03,
  },
  // Sector 3: Mar de Plasma (Mi frigio, galope)
  s3: {
    bpm: 164,
    chords: ['Em', 'F', 'Em', 'F', 'G', 'F', 'Em', 'Em'],
    mel: [
      'E5 . B4 . E5 . G5 F#5',
      'F5 . C5 . F5 . A5 G5',
      'E5 . G5 . B5 . E6 .',
      'F6 . E6 . C6 . A5 .',
      'G5 . B5 . D6 . B5 .',
      'A5 . C6 . F6 . C6 .',
      'B5 . G5 . E5 . B4 .',
      'E5 . . . - - E5 F5',
    ],
    chordsB: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'B', 'B'],
    melB: [
      'A5 . . . E5 . A5 .',
      'C6 . B5 . A5 . E5 .',
      'F5 . A5 . C6 . F6 .',
      'D6 . . . B5 . G5 .',
      'E6 . C6 . A5 . C6 .',
      'E6 . A6 . E6 . C6 .',
      'D#6 . . . F#6 . . .',
      'B5 . . . D#6 . F#6 .',
    ],
    bass: 'gallop',
    arp: 'up',
    drums: 'dnb',
    lead: 'pulse25',
  },
  // Sector 4: Astillero Fantasma (Sol menor, misterioso)
  s4: {
    bpm: 150,
    chords: ['Gm', 'Eb', 'Cm', 'D', 'Gm', 'Eb', 'F', 'D'],
    mel: [
      'G5 . . . A#5 . D6 .',
      'D#6 . . . D6 . A#5 .',
      'C6 . . . G5 . D#5 .',
      'F#5 . . . A5 . D6 .',
      'D6 . A#5 . G5 . D5 .',
      'D#5 . G5 . A#5 . D#6 .',
      'F6 . D#6 . D6 . C6 .',
      'A5 . . . F#5 . D5 .',
    ],
    chordsB: ['Eb', 'F', 'Gm', 'Gm', 'Cm', 'D', 'Gm', 'Gm'],
    melB: [
      'G5 A#5 D#6 . . . D6 C6',
      'A5 C6 F6 . . . D#6 D6',
      'D6 . A#5 . G5 . A#5 .',
      'D6 . . . . . - -',
      'D#6 . D6 . C6 . G5 .',
      'F#5 . A5 . C6 . D6 .',
      'A#5 . A5 . G5 . D5 .',
      'G5 . . . - - - -',
    ],
    bass: 'pulse',
    arp: 'broken',
    drums: 'half',
    lead: 'triangle',
    leadVol: 0.05,
  },
  // Sector 5: Tormenta Solar (Si menor, frenético)
  s5: {
    bpm: 172,
    chords: ['Bm', 'G', 'A', 'F#', 'Bm', 'G', 'Em', 'F#'],
    mel: [
      'B4 D5 F#5 B5 . . A5 F#5',
      'G5 . B5 . D6 . B5 .',
      'A5 C#6 E6 . . . C#6 A5',
      'A#5 . . . F#5 . C#5 .',
      'B5 . D6 . F#6 . D6 B5',
      'G5 . B5 . D6 . G6 .',
      'E6 . D6 . B5 . G5 .',
      'F#5 . A#5 . C#6 . E6 .',
    ],
    chordsB: ['G', 'A', 'Bm', 'Bm', 'G', 'A', 'F#', 'F#'],
    melB: [
      'D6 . . . B5 . G5 .',
      'E6 . . . C#6 . A5 .',
      'F#6 . E6 . D6 . C#6 .',
      'B5 . F#5 . D5 . F#5 .',
      'G5 B5 D6 G6 . . D6 B5',
      'A5 C#6 E6 A6 . . E6 C#6',
      'A#5 . C#6 . F#6 . E6 .',
      'C#6 . . . A#5 . F#5 .',
    ],
    bass: 'gallop',
    arp: 'updown',
    drums: 'rock',
    lead: 'pulse25',
  },
  // Sector 6: Corazón del Vacío (Do menor, épico)
  s6: {
    bpm: 142,
    chords: ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Fm', 'G'],
    mel: [
      'C5 . G5 . C6 . . D6',
      'D#6 . C6 . G#5 . D#5 .',
      'G5 . . A#5 . . D#6 .',
      'D6 . . . A#5 . F5 .',
      'G5 . C6 . D#6 . G6 .',
      'G#6 . G6 . D#6 . C6 .',
      'C6 . G#5 . F5 . C6 .',
      'B5 . . . D6 . G6 .',
    ],
    chordsB: ['Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'Bb', 'G', 'G'],
    melB: [
      'C6 . . . D#6 . G#6 .',
      'D6 . . . F6 . A#6 .',
      'G6 . D#6 . C6 . G5 .',
      'C6 . . . . . - -',
      'G#5 C6 D#6 G#6 . . D#6 C6',
      'A#5 D6 F6 A#6 . . F6 D6',
      'B5 . D6 . G6 . F6 .',
      'D6 . . . B5 . G5 .',
    ],
    bass: 'drive',
    arp: 'up',
    drums: 'four',
    lead: 'pulse25',
  },
  // Jefe: amenaza cromática en La menor
  boss: {
    bpm: 174,
    chords: ['Am', 'Am', 'Bb', 'Bb', 'Am', 'Am', 'G#', 'G#'],
    mel: [
      'A5 . . E5 A5 . C6 .',
      'B5 . A5 . G#5 . E5 .',
      'A#5 . . F5 A#5 . D6 .',
      'C6 . A#5 . A5 . F5 .',
      'E6 . D6 . C6 . A5 .',
      'C6 . B5 . A5 . E5 .',
      'D#6 . C6 . G#5 . D#5 .',
      'G#5 . C6 . D#6 . G#6 .',
    ],
    chordsB: ['Dm', 'Dm', 'E', 'E', 'F', 'G', 'E', 'E'],
    melB: [
      'A5 . F5 . D5 . F5 A5',
      'D6 . . . C6 . A5 .',
      'G#5 . B5 . E6 . . .',
      'D6 . B5 . G#5 . E5 .',
      'F5 A5 C6 F6 . . C6 A5',
      'G5 B5 D6 G6 . . D6 B5',
      'G#6 . E6 . B5 . G#5 .',
      'E6 . . . E5 . - -',
    ],
    bass: 'gallop',
    arp: 'broken',
    drums: 'boss',
    lead: 'square',
    leadVol: 0.03,
  },
}

// ===================== Teoría mínima =====================

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function midiOf(n: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(n)
  if (!m) return 69
  return (parseInt(m[3], 10) + 1) * 12 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** Acorde → semitonos (raíz MIDI en octava 2 + intervalos). */
function chordOf(sym: string): { root: number; iv: number[] } {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym)
  if (!m) return { root: 45, iv: [0, 4, 7] }
  const root = 36 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  const q = m[3]
  const iv = q === 'm' ? [0, 3, 7] : q === '5' ? [0, 7, 12] : q === 'dim' ? [0, 3, 6] : [0, 4, 7]
  return { root: root < 40 ? root + 12 : root, iv }
}

// ===================== Construcción de la rejilla =====================

interface Ev {
  f: number
  len: number
}
interface Built {
  spb: number
  len: number
  lead: (Ev | null)[]
  arp: (number | null)[]
  bass: (Ev | null)[]
  drums: string[]
  def: SongDef
}

const BASS_PAT: Record<BassStyle, string> = {
  // r = raíz, R = raíz octava arriba, f = quinta, '-' silencio, '.' sostener
  gallop: 'rrRrrrRrrrRrrrRf',
  drive: 'r-R-r-R-r-R-r-Rf',
  synco: 'r--r--r-r-R-r-f-',
  pulse: 'r.r.r.r.r.r.f.R.',
  half: 'r.......f.......',
}
const ARP_PAT: Record<ArpStyle, number[]> = {
  up: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
  updown: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3],
  broken: [0, 2, 1, 3, 0, 2, 1, 3, 1, 3, 2, 0, 1, 3, 2, 3],
}
const DRUM_PAT: Record<DrumStyle, [string, string]> = {
  rock: ['k-h-s-h-k-k-s-h-', 'k-h-s-hkk-s-ssss'],
  dnb: ['k-h-s-hkh-k-s-ho', 'k-h-s-hks-ksssss'],
  four: ['k-hhs-hhk-hhs-hh', 'k-hhs-hhk-s-ssss'],
  half: ['k-h-h-h-s-h-h-hh', 'k-h-h-h-s-h-ssss'],
  title: ['k-h-s-hkk-h-s-h-', 'k-h-s-hkk-s-ttts'],
  boss: ['kkh-s-hkk-hks-sh', 'kks-s-kks-sssstt'],
}

function buildSection(def: SongDef, chords: string[], mel: string[], first: boolean) {
  const bars = chords.length
  const n = bars * 16
  const lead: (Ev | null)[] = new Array(n).fill(null)
  const arp: (number | null)[] = new Array(n).fill(null)
  const bass: (Ev | null)[] = new Array(n).fill(null)
  const drums: string[] = new Array(n).fill('-')
  let lastLead: Ev | null = null
  for (let b = 0; b < bars; b++) {
    const ch = chordOf(chords[b])
    // melodía
    const toks = (mel[b] ?? '').trim().split(/\s+/)
    const unit = toks.length <= 8 ? 2 : 1
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]
      const at = b * 16 + i * unit
      if (t === '.') {
        if (lastLead) lastLead.len += unit
      } else if (t === '-') lastLead = null
      else {
        lastLead = { f: freq(midiOf(t)), len: unit }
        lead[at] = lastLead
      }
    }
    // arpegio (acorde en octava 4-5)
    const tones = [ch.iv[0], ch.iv[1], ch.iv[2], 12].map((v) => freq(ch.root + 24 + v))
    const ap = ARP_PAT[def.arp]
    for (let i = 0; i < 16; i++) arp[b * 16 + i] = tones[ap[i]]
    // bajo
    const bp = BASS_PAT[def.bass]
    let lastBass: Ev | null = null
    for (let i = 0; i < 16; i++) {
      const c = bp[i]
      const at = b * 16 + i
      if (c === '.') {
        if (lastBass) lastBass.len++
      } else if (c === '-') lastBass = null
      else {
        const m = c === 'r' ? ch.root : c === 'R' ? ch.root + 12 : ch.root + 7
        lastBass = { f: freq(m), len: 1 }
        bass[at] = lastBass
      }
    }
    // batería (relleno en el último compás de cada 4)
    const [main, fill] = DRUM_PAT[def.drums]
    const pat = b % 4 === 3 ? fill : main
    for (let i = 0; i < 16; i++) drums[b * 16 + i] = pat[i]
    if (b === 0 && first) drums[0] = 'c'
    if (b === 4) drums[b * 16] = 'c'
  }
  return { lead, arp, bass, drums }
}

const built = new Map<SongId, Built>()
function build(id: SongId): Built {
  const hit = built.get(id)
  if (hit) return hit
  const def = SONGS[id]
  const a = buildSection(def, def.chords, def.mel, true)
  const b = buildSection(def, def.chordsB, def.melB, true)
  const out: Built = {
    spb: 60 / def.bpm / 4,
    len: a.lead.length + b.lead.length,
    lead: [...a.lead, ...b.lead],
    arp: [...a.arp, ...b.arp],
    bass: [...a.bass, ...b.bass],
    drums: [...a.drums, ...b.drums],
    def,
  }
  built.set(id, out)
  return out
}

// ===================== Voces =====================

function note(c: AudioContext, out: AudioNode, when: number, f: number, dur: number, w: Wave, vol: number, vib = false) {
  try {
    const osc = c.createOscillator()
    const g = c.createGain()
    setWave(osc, w)
    osc.frequency.setValueAtTime(f, when)
    if (vib && dur > 0.25) {
      const lfo = c.createOscillator()
      const lg = c.createGain()
      lfo.frequency.value = 6
      lg.gain.setValueAtTime(0, when)
      lg.gain.linearRampToValueAtTime(f * 0.012, when + 0.2)
      lfo.connect(lg)
      lg.connect(osc.frequency)
      lfo.start(when)
      lfo.stop(when + dur + 0.05)
    }
    g.gain.setValueAtTime(0.0001, when)
    g.gain.linearRampToValueAtTime(vol, when + 0.005)
    g.gain.setValueAtTime(vol, when + Math.max(0.01, dur * 0.6))
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.05, dur))
    osc.connect(g)
    g.connect(out)
    osc.start(when)
    osc.stop(when + dur + 0.03)
  } catch {
    // audio no disponible
  }
}

// ===================== Secuenciador =====================

let timer: ReturnType<typeof setInterval> | null = null
let current: SongId | null = null
let step = 0
let nextT = 0
let tempo = 1
let level = 0
let target = 0

function tick() {
  const c = audio()
  const out = musicOut()
  if (!c || !out) return
  if (c.state === 'suspended') {
    void c.resume().catch(() => {})
    return
  }
  const on = isMusicEnabled() && !isMuted() && current !== null
  const want = on ? target : 0
  level += (want - level) * 0.25
  if (Math.abs(want - level) < 0.002) level = want
  out.gain.setTargetAtTime(level * 0.5, c.currentTime, 0.03)
  if (!on || !current) {
    nextT = c.currentTime + 0.06
    return
  }
  const s = build(current)
  const spb = s.spb / tempo
  if (nextT < c.currentTime - 0.2) nextT = c.currentTime + 0.05
  while (nextT < c.currentTime + 0.14) {
    const i = step
    const d = s.def
    const ln = s.lead[i]
    if (ln) {
      note(c, out, nextT, ln.f, spb * ln.len * 0.95, d.lead, d.leadVol ?? 0.042, true)
      // eco: copia suave 3 pasos después
      note(c, out, nextT + spb * 3, ln.f, spb * Math.min(ln.len, 3) * 0.9, d.lead, (d.leadVol ?? 0.042) * 0.3)
    }
    const an = s.arp[i]
    if (an) note(c, out, nextT, an, spb * 0.7, 'pulse12', d.arpVol ?? 0.014)
    const bn = s.bass[i]
    if (bn) note(c, out, nextT, bn.f, spb * bn.len * 0.9, 'triangle', d.bassVol ?? 0.12)
    if (bn) note(c, out, nextT, bn.f * 2, spb * bn.len * 0.5, 'pulse25', 0.012)
    const dk = s.drums[i]
    if (dk && dk !== '-') drumHit(nextT, dk)
    step = (step + 1) % s.len
    nextT += spb
  }
}

/** Cambia de pista (null = silencio). `speed` acelera el tempo (2ª vuelta). */
export function playSong(id: SongId | null, speed = 1) {
  tempo = speed
  if (id !== current) {
    current = id
    step = 0
    level = 0
    const c = audio()
    nextT = c ? c.currentTime + 0.08 : 0
  }
  target = id ? 1 : 0
  if (!timer && typeof window !== 'undefined') timer = setInterval(tick, 25)
}

/** Baja el volumen de la música (p. ej. en pausa o alarma). */
export function duckMusic(v: number) {
  target = current ? v : 0
}

export function stopSoundtrack() {
  if (timer) clearInterval(timer)
  timer = null
  current = null
  level = 0
}
