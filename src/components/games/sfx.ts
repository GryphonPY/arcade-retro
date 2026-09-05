'use client'

/**
 * Motor de sonido retro (chiptune) con WebAudio: osciladores + ruido.
 * Sin archivos externos. El estado de silencio se persiste en localStorage.
 */

let ctx: AudioContext | null = null
let muted = false

export function isMuted(): boolean {
  return muted
}

export function loadMutePref(): boolean {
  if (typeof window === 'undefined') return false
  try {
    muted = window.localStorage.getItem('arcade-muted') === '1'
  } catch {
    // sin acceso a localStorage
  }
  return muted
}

export function setMuted(v: boolean): void {
  muted = v
  try {
    window.localStorage.setItem('arcade-muted', v ? '1' : '0')
  } catch {
    // sin acceso a localStorage
  }
}

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
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

interface ToneOpts {
  freq: number
  to?: number
  dur: number
  type?: OscillatorType
  vol?: number
  delay?: number
}

function tone(o: ToneOpts): void {
  if (muted) return
  const c = ac()
  if (!c) return
  try {
    const t0 = c.currentTime + (o.delay ?? 0)
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = o.type ?? 'square'
    osc.frequency.setValueAtTime(o.freq, t0)
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + o.dur)
    const v = o.vol ?? 0.05
    g.gain.setValueAtTime(v, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
    osc.connect(g)
    g.connect(c.destination)
    osc.start(t0)
    osc.stop(t0 + o.dur + 0.03)
  } catch {
    // audio no disponible
  }
}

interface NoiseOpts {
  dur: number
  vol?: number
  freq?: number
  delay?: number
}

function noise(o: NoiseOpts): void {
  if (muted) return
  const c = ac()
  if (!c) return
  try {
    const t0 = c.currentTime + (o.delay ?? 0)
    const len = Math.max(1, Math.floor(c.sampleRate * o.dur))
    const buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = c.createBufferSource()
    src.buffer = buf
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = o.freq ?? 1200
    const g = c.createGain()
    g.gain.setValueAtTime(o.vol ?? 0.08, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(c.destination)
    src.start(t0)
  } catch {
    // audio no disponible
  }
}

export const sfx = {
  /** Insertar moneda / seleccionar del menú */
  coin() {
    tone({ freq: 988, dur: 0.07, vol: 0.04 })
    tone({ freq: 1319, dur: 0.16, vol: 0.04, delay: 0.07 })
  },
  /** Arrancar partida (arpegio corto ascendente) */
  start() {
    tone({ freq: 523, dur: 0.09 })
    tone({ freq: 659, dur: 0.09, delay: 0.09 })
    tone({ freq: 784, dur: 0.14, delay: 0.18 })
  },
  /** Comer algo (snake, bolitas pequeñas) */
  eat() {
    tone({ freq: 880, to: 1320, dur: 0.08, vol: 0.045 })
  },
  /** Bolita diminuta del laberinto */
  pellet() {
    tone({ freq: 520, dur: 0.035, vol: 0.02, type: 'sine' })
  },
  /** Bolita grande / power-up */
  power() {
    tone({ freq: 392, dur: 0.08, vol: 0.045 })
    tone({ freq: 523, dur: 0.1, vol: 0.045, delay: 0.08 })
  },
  /** Salto del corredor */
  jump() {
    tone({ freq: 320, to: 720, dur: 0.14, vol: 0.045 })
  },
  /** Aterrizar */
  land() {
    noise({ dur: 0.06, vol: 0.03, freq: 500 })
  },
  /** Disparo láser */
  shoot() {
    tone({ freq: 1200, to: 300, dur: 0.09, vol: 0.035, type: 'sawtooth' })
  },
  /** Invasor destruido / ladrillo roto (tono por fila) */
  pop() {
    tone({ freq: 600, to: 200, dur: 0.1, vol: 0.05 })
  },
  brick(row: number) {
    tone({ freq: 660 + (4 - row) * 90, dur: 0.07, vol: 0.04 })
  },
  /** Rebote suave (paleta, paredes) */
  bounce() {
    tone({ freq: 440, dur: 0.05, vol: 0.035, type: 'triangle' })
  },
  /** Explosión con metralla */
  explode() {
    noise({ dur: 0.35, vol: 0.09, freq: 900 })
    tone({ freq: 110, to: 40, dur: 0.3, vol: 0.06, type: 'triangle' })
  },
  /** Golpe / perder vida */
  hurt() {
    tone({ freq: 220, to: 90, dur: 0.25, vol: 0.06, type: 'sawtooth' })
  },
  /** Choque fuerte (coches) */
  crash() {
    noise({ dur: 0.5, vol: 0.12, freq: 800 })
    tone({ freq: 90, to: 35, dur: 0.4, vol: 0.07, type: 'triangle' })
  },
  /** Nivel superado (fanfarria) */
  levelUp() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.045, delay: i * 0.09 }))
  },
  /** Sirena de policía (doble bip) */
  siren() {
    tone({ freq: 700, to: 950, dur: 0.2, vol: 0.035 })
    tone({ freq: 950, to: 700, dur: 0.2, vol: 0.035, delay: 0.2 })
  },
  /** Turbina / turbo del coche */
  boost() {
    tone({ freq: 180, to: 320, dur: 0.18, vol: 0.03, type: 'sawtooth' })
  },
  /** Fin de partida (melodía descendente) */
  gameOver() {
    ;[392, 330, 262, 196].forEach((f, i) =>
      tone({ freq: f, dur: 0.16, vol: 0.05, delay: i * 0.14, type: 'triangle' }),
    )
  },
}
