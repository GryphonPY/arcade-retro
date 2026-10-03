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

export interface ToneOpts {
  freq: number
  to?: number
  dur: number
  type?: OscillatorType
  vol?: number
  delay?: number
}

/** Tono sintetizado; útil para crear efectos propios en cada juego. */
export function tone(o: ToneOpts): void {
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

export interface NoiseOpts {
  dur: number
  vol?: number
  freq?: number
  delay?: number
}

/** Ráfaga de ruido filtrado (explosiones, golpes, motor). */
export function noise(o: NoiseOpts): void {
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
  /** Comer fantasma asustado */
  eatGhost() {
    tone({ freq: 440, to: 880, dur: 0.18, vol: 0.06, type: 'square' })
    tone({ freq: 880, to: 1320, dur: 0.18, vol: 0.05, type: 'triangle', delay: 0.08 })
  },
  /** Fruta / orbe dorado */
  golden() {
    ;[659, 880, 1175, 1397].forEach((f, i) =>
      tone({ freq: f, dur: 0.08, vol: 0.05, delay: i * 0.06, type: 'triangle' }),
    )
  },
  /** Platillo OVNI */
  ufo() {
    tone({ freq: 900, to: 1100, dur: 0.12, vol: 0.03, type: 'sine' })
  },
  /** Rebase peligroso rozando coche */
  nearMiss() {
    tone({ freq: 480, to: 720, dur: 0.12, vol: 0.04, type: 'sine' })
  },
  /** Sonido de espada / tajo cuerpo a cuerpo */
  slash() {
    tone({ freq: 880, to: 220, dur: 0.08, vol: 0.05, type: 'sawtooth' })
    noise({ dur: 0.07, vol: 0.06, freq: 1600 })
  },
  /** Impacto / golpe recibido por enemigo */
  hit() {
    tone({ freq: 280, to: 70, dur: 0.12, vol: 0.07, type: 'square' })
    noise({ dur: 0.08, vol: 0.07, freq: 700 })
  },
  /** Beber poción / curación */
  potion() {
    ;[523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.06, vol: 0.04, delay: i * 0.04, type: 'sine' }),
    )
  },
  /** Recoger llave / tesoro */
  key() {
    ;[784, 988, 1319, 1568].forEach((f, i) =>
      tone({ freq: f, dur: 0.08, vol: 0.045, delay: i * 0.05, type: 'triangle' }),
    )
  },
  /** Salto hiperespacial / teletransporte */
  warp() {
    tone({ freq: 200, to: 1800, dur: 0.22, vol: 0.05, type: 'sawtooth' })
    noise({ dur: 0.2, vol: 0.04, freq: 2400 })
  },
  /** Disparo láser vector */
  laser() {
    tone({ freq: 1800, to: 400, dur: 0.08, vol: 0.04, type: 'sawtooth' })
  },
  /** Bomba inteligente / explosión masiva */
  bomb() {
    noise({ dur: 0.6, vol: 0.14, freq: 600 })
    tone({ freq: 160, to: 25, dur: 0.5, vol: 0.09, type: 'triangle' })
  },
  /** Inserción física de moneda mecánica */
  coinInsert() {
    tone({ freq: 1200, dur: 0.04, vol: 0.05, type: 'sine' })
    tone({ freq: 1600, dur: 0.08, vol: 0.06, delay: 0.04, type: 'triangle' })
    noise({ dur: 0.09, vol: 0.05, freq: 2800, delay: 0.07 })
    tone({ freq: 880, dur: 0.12, vol: 0.04, delay: 0.11, type: 'sine' })
  },
  /** Pausar o reanudar */
  pause() {
    tone({ freq: 520, to: 440, dur: 0.09, vol: 0.04, type: 'triangle' })
  },
  /** Fin de partida (melodía descendente) */
  gameOver() {
    ;[392, 330, 262, 196].forEach((f, i) =>
      tone({ freq: f, dur: 0.16, vol: 0.05, delay: i * 0.14, type: 'triangle' }),
    )
  },
}

