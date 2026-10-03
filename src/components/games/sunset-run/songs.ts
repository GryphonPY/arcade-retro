/**
 * Canciones originales de las cuatro estaciones de radio. Notación:
 * - lead: "NOTA/duración" en semicorcheas ("-/4" = silencio).
 * - bass: 16 pasos por compás: R raíz, O octava, 5 quinta, 3 tercera, 7 séptima,
 *   g raíz fantasma (corta), '.' liga, '-' silencio.
 * - arp: índices de nota del acorde (0..3) por semicorchea.
 * - stab / power: x golpe corto, X golpe largo.
 * - drums: filas de 16 pasos (k bombo, s caja [x/g], c palmas, h charles,
 *   o charles abierto, C platillo, q congas [q aguda / w grave], v clave,
 *   z shaker, t toms [h/l]).
 */

export interface InstDef {
  wave: OscillatorType
  vol: number
  lp?: number
  vib?: number
  echo?: boolean
  dist?: boolean
  brass?: boolean
  trem?: boolean
  /** Caída (s) para sonidos punteados; si falta, sostiene la duración. */
  dec?: number
  oct?: number
  detune?: number
}

export interface SectionDef {
  bars: string[]
  lead: string
  bass: string | string[]
  arp?: string
  stab?: string
  power?: string
  drums: Record<string, string>
  fill?: Record<string, string>
  /** Compases (1-based) sin batería. */
  quiet?: number[]
}

export interface SongDef {
  bpm: number
  swing: number
  lead: InstDef
  bass: InstDef
  arp?: InstDef
  stab?: InstDef
  power?: InstDef
  sections: Record<string, SectionDef>
  order: string[]
}

export const SONGS: SongDef[] = [
  // ===== BRISA FM: synth-pop veraniego en Mi mayor =====
  {
    bpm: 118,
    swing: 0,
    lead: { wave: 'square', vol: 0.05, vib: 5, echo: true, lp: 3800 },
    bass: { wave: 'sawtooth', vol: 0.07, lp: 800, dec: 0.18, oct: 2 },
    arp: { wave: 'square', vol: 0.018, lp: 2600, dec: 0.09, oct: 5 },
    stab: { wave: 'sawtooth', vol: 0.016, lp: 1500, oct: 4 },
    sections: {
      A: {
        bars: ['E', 'C#m', 'A', 'B', 'E', 'C#m', 'A', 'B'],
        lead: [
          'B4/4 E5/2 F#5/2 G#5/4 F#5/2 E5/2',
          'G#5/6 F#5/2 E5/4 C#5/4',
          'E5/2 C#5/2 E5/2 F#5/2 A5/4 G#5/2 F#5/2',
          'F#5/8 D#5/4 B4/4',
          'B4/4 E5/2 F#5/2 G#5/4 B5/4',
          'C#6/4 B5/2 G#5/2 E5/4 G#5/4',
          'A5/2 G#5/2 F#5/2 E5/2 C#5/4 E5/4',
          'F#5/12 -/4',
        ].join(' '),
        bass: 'R-R-O-R-R-R-O-R-',
        arp: '0123212301232121',
        drums: {
          k: 'x-------x-x-----',
          c: '----x-------x---',
          h: 'x-x-x-x-x-x-x-x-',
        },
        fill: { k: 'x-------x-x-x-x-', c: '----x-------xxxx', h: 'x-x-x-x-x-x-----' },
      },
      B: {
        bars: ['A', 'B', 'G#m', 'C#m', 'A', 'B', 'E', 'E'],
        lead: [
          'C#6/4 C#6/2 B5/2 A5/4 E5/4',
          'D#6/4 D#6/2 C#6/2 B5/4 F#5/4',
          'B5/2 B5/2 C#6/2 D#6/2 E6/4 D#6/2 B5/2',
          'C#6/12 -/2 G#5/2',
          'A5/2 B5/2 C#6/4 E6/4 C#6/4',
          'D#6/2 E6/2 F#6/4 D#6/4 B5/4',
          'E6/8 B5/4 G#5/4',
          'E6/12 -/4',
        ].join(' '),
        bass: 'R-RRO-R-R-RRO-5-',
        arp: '0123012301230123',
        stab: 'X---------------',
        drums: {
          k: 'x---x---x---x---',
          c: '----x-------x---',
          h: 'xxxxxxxxxxxxxxxx',
          o: '--o---o---o---o-',
        },
        fill: { k: 'x---x---x---x-x-', c: '----x---x-x-xxxx', h: 'xxxxxxxxxxxx----', C: '' },
      },
      C: {
        bars: ['C#m', 'A', 'E', 'B', 'C#m', 'A', 'E', 'B'],
        lead: [
          'G#5/8 E5/8',
          'A5/8 C#6/8',
          'B5/8 G#5/4 E5/4',
          'F#5/16',
          'G#5/4 B5/4 C#6/4 E6/4',
          'C#6/8 A5/8',
          'B5/4 G#5/4 E5/4 G#5/4',
          'F#5/8 D#6/8',
        ].join(' '),
        bass: 'R-------R-------',
        arp: '0-2-1-3-0-2-1-3-',
        stab: 'X-------X-------',
        drums: { h: 'x-x-x-x-x-x-x-x-', k: 'x-------x-------', c: '------------x---' },
        quiet: [1, 2],
        fill: { k: 'x-x-x-x-x-x-x-x-', c: 'x-x-x-x-xxxxxxxx', h: '' },
      },
    },
    order: ['A', 'B', 'A', 'C', 'B'],
  },

  // ===== FUNK TOTAL: funk en Mi dórico =====
  {
    bpm: 104,
    swing: 0.12,
    lead: { wave: 'sawtooth', vol: 0.04, brass: true, lp: 2600, vib: 3 },
    bass: { wave: 'square', vol: 0.06, lp: 1100, dec: 0.16, oct: 2 },
    stab: { wave: 'square', vol: 0.02, lp: 2400, dec: 0.07, oct: 4 },
    sections: {
      A: {
        bars: ['Em7', 'Em7', 'A7', 'A7', 'Em7', 'Em7', 'A7', 'B7'],
        lead: [
          '-/2 E5/1 G5/1 A5/2 B5/2 -/2 D6/2 B5/2 -/2',
          'A5/2 G5/2 E5/4 -/4 D5/2 E5/2',
          '-/2 E5/1 G5/1 A5/2 C#6/2 -/2 E6/2 C#6/2 -/2',
          'B5/2 A5/2 G5/4 -/4 E5/2 G5/2',
          '-/2 E5/1 G5/1 A5/2 B5/2 -/2 D6/2 B5/2 -/2',
          'A5/2 G5/2 E5/4 -/4 D5/2 E5/2',
          '-/2 E5/1 G5/1 A5/2 C#6/2 -/2 E6/2 C#6/2 -/2',
          'F#5/2 A5/2 B5/2 D#6/2 F#6/4 -/4',
        ].join(' '),
        bass: 'R--RO--gR-5-O-gR',
        stab: '--x---x---x--x--',
        drums: {
          k: 'x--x---x-x---x--',
          s: '----x--g-g--x--g',
          h: 'xxxxxxxxxxxxxxxx',
          o: '------o-------o-',
        },
        fill: { k: 'x--x---x-x---x--', s: '----x--g-gxxx-xx', h: 'xxxxxxxxxxxx----', o: '' },
      },
      B: {
        bars: ['Cmaj7', 'Cmaj7', 'B7', 'B7', 'Am7', 'Am7', 'B7', 'B7'],
        lead: [
          'G5/4 B5/4 E6/6 D6/2',
          'C6/4 B5/2 G5/2 E5/8',
          'F#5/4 A5/4 D#6/6 C#6/2',
          'B5/12 -/4',
          'E5/2 G5/2 A5/2 C6/2 E6/4 D6/2 C6/2',
          'A5/8 G5/4 E5/4',
          'D#5/2 F#5/2 A5/2 B5/2 D#6/4 F#6/4',
          'B5/8 -/8',
        ].join(' '),
        bass: 'R-.RO-5-R-.R7-O-',
        stab: 'x--x--x---x--x--',
        drums: {
          k: 'x--x---x-x-x-x--',
          s: '----x--g----x-g-',
          h: 'x-xxx-xxx-xxx-xx',
          o: '-o-------o------',
          b: 'x---x---x---x---',
        },
        fill: { s: '----x--g-xxxxxxx' },
      },
      C: {
        bars: ['Em7', 'Em7', 'Em7', 'Em7', 'A7', 'A7', 'B7', 'B7'],
        lead: '-/128',
        bass: ['R--RO--gR-5-O-gR', 'R-gRO-gR-7O-5-gR', 'R--RO--gR-5-O-gR', 'RO-RO5-gR-7-O5gR'],
        stab: 'x-x---x-x-x--x--',
        drums: {
          k: 'x--x---x-x---x--',
          s: '----x--g-g--x--g',
          h: 'xxxxxxxxxxxxxxxx',
          c: '----x-------x---',
        },
        quiet: [1],
      },
    },
    order: ['A', 'A', 'B', 'C', 'B'],
  },

  // ===== TURBO ROCK: rock de guitarras en La menor =====
  {
    bpm: 150,
    swing: 0,
    lead: { wave: 'sawtooth', vol: 0.032, dist: true, vib: 6, lp: 3000 },
    bass: { wave: 'sawtooth', vol: 0.06, lp: 650, dec: 0.15, oct: 2 },
    power: { wave: 'sawtooth', vol: 0.024, dist: true, dec: 0.09, oct: 3, detune: 7 },
    sections: {
      A: {
        bars: ['A5', 'A5', 'F5', 'G5', 'A5', 'A5', 'F5', 'E5'],
        lead: [
          'A4/2 C5/2 D5/2 E5/4 G5/2 E5/2 D5/2',
          'E5/8 C5/4 A4/4',
          'F5/2 E5/2 C5/2 A4/2 C5/4 F5/4',
          'G5/4 F5/2 E5/2 D5/4 B4/4',
          'A4/2 C5/2 D5/2 E5/4 A5/2 G5/2 E5/2',
          'A5/8 G5/4 E5/4',
          'F5/2 G5/2 A5/2 C6/2 A5/4 F5/4',
          'E5/4 G#5/4 B5/4 E6/4',
        ].join(' '),
        bass: 'R-R-R-R-R-R-R-R-',
        power: 'x-x-x-x-x-x-x-x-',
        drums: {
          k: 'x-----x-x-------',
          s: '----x-------x---',
          h: 'x-x-x-x-x-x-x-x-',
          C: 'x---------------',
        },
        fill: { k: 'x-----x-x-------', s: '----x-------xxxx', t: '--------hhhhllll', h: 'x-x-x-x-' },
      },
      B: {
        bars: ['D5', 'F5', 'C5', 'G5', 'D5', 'F5', 'E5', 'E5'],
        lead: [
          'A5/6 G5/2 F5/4 D5/4',
          'C6/6 A5/2 F5/4 C5/4',
          'G5/4 A5/2 G5/2 E5/4 C5/4',
          'D5/4 G5/4 B5/4 D6/4',
          'F6/6 E6/2 D6/4 A5/4',
          'C6/4 D6/2 C6/2 A5/4 F5/4',
          'G#5/4 B5/4 E6/8',
          'E6/8 D6/2 B5/2 G#5/4',
        ].join(' '),
        bass: 'R-RRR-RRR-RRR-O-',
        power: 'X-------x-x-x-x-',
        drums: {
          k: 'x-x---x-x-x---x-',
          s: '----x-------x---',
          h: 'xxxxxxxxxxxxxxxx',
          C: 'x-------x-------',
        },
        fill: { s: '----x---xxxxxxxx', t: '', C: 'x---------------' },
      },
      C: {
        bars: ['F5', 'G5', 'A5', 'A5', 'F5', 'G5', 'E5', 'E5'],
        lead: [
          'A5/1 C6/1 A5/1 F5/1 A5/1 C6/1 A5/1 F5/1 G5/1 C6/1 G5/1 E5/1 G5/1 C6/1 G5/1 E5/1',
          'B5/1 D6/1 B5/1 G5/1 B5/1 D6/1 B5/1 G5/1 D6/2 B5/2 G5/4',
          'A5/1 B5/1 C6/1 D6/1 E6/4 D6/2 C6/2 B5/2 A5/2',
          'A5/12 -/4',
          'A5/1 C6/1 A5/1 F5/1 A5/1 C6/1 A5/1 F5/1 G5/1 C6/1 G5/1 E5/1 G5/1 C6/1 G5/1 E5/1',
          'B5/1 D6/1 B5/1 G5/1 B5/1 D6/1 B5/1 G5/1 D6/2 B5/2 G5/4',
          'G#5/2 B5/2 E6/2 G#6/2 B6/8',
          'E6/8 -/8',
        ].join(' '),
        bass: 'R-R-R-R-R-R-R-R-',
        power: 'X-------X-------',
        drums: {
          k: 'x-x-x-x-x-x-x-x-',
          s: '----x-------x---',
          h: 'x-x-x-x-x-x-x-x-',
          C: 'x---------------',
        },
        fill: { s: 'x-x-x-x-xxxxxxxx', t: 'hhhhllll--------' },
      },
    },
    order: ['A', 'B', 'A', 'B', 'C', 'B'],
  },

  // ===== OLA LATINA: surf con percusión latina en Re menor =====
  {
    bpm: 158,
    swing: 0,
    lead: { wave: 'square', vol: 0.034, trem: true, echo: true, lp: 3200 },
    bass: { wave: 'triangle', vol: 0.11, dec: 0.22, oct: 2 },
    arp: { wave: 'triangle', vol: 0.03, dec: 0.08, oct: 5 },
    sections: {
      A: {
        bars: ['Dm', 'C', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A'],
        lead: [
          'D5/4 E5/2 F5/2 A5/8',
          'G5/4 F5/2 E5/2 G5/8',
          'F5/4 E5/2 D5/2 F5/4 D5/4',
          'C#5/8 E5/4 A4/4',
          'D5/4 F5/2 A5/2 D6/8',
          'C6/4 A#5/2 A5/2 G5/8',
          'F5/4 G5/2 F5/2 E5/4 D5/4',
          'A4/4 C#5/4 E5/4 A5/4',
        ].join(' '),
        bass: 'R--5--O-R--5--O-',
        arp: '0-12-01-20-12-01',
        drums: {
          k: 'x-------x-------',
          s: '----x-------x---',
          v: 'x--x--x---x-x---',
          q: '--q-w-qq--q-w-qq',
          z: 'zzzzzzzzzzzzzzzz',
        },
        fill: { s: '----x-------x-xx', t: '--------hh-hll-l' },
      },
      B: {
        bars: ['Gm', 'Dm', 'A', 'Dm', 'Gm', 'Dm', 'Bb', 'A'],
        lead: [
          'A#5/6 A5/2 G5/8',
          'A5/6 F5/2 D5/8',
          'E5/4 F5/2 G5/2 A5/4 C#6/4',
          'D6/12 -/4',
          'D6/4 C6/2 A#5/2 G5/4 A#5/4',
          'A5/4 G5/2 F5/2 D5/8',
          'F5/2 G5/2 A5/2 A#5/2 D6/8',
          'C#6/8 A5/4 E5/4',
        ].join(' '),
        bass: 'R--R--5-O--R--5-',
        arp: '0-12-01-20-12-01',
        drums: {
          k: 'x-----x-x-------',
          s: '----x-------x---',
          v: '--x-x---x--x--x-',
          q: 'q-qwq-qwq-qwq-qw',
          z: 'z-zzz-zzz-zzz-zz',
          b: 'x---x---x---x---',
        },
        fill: { s: '----x-------xxxx', C: '' },
      },
      C: {
        bars: ['Dm', 'Dm', 'A#', 'A', 'Dm', 'Dm', 'A#', 'A'],
        lead: [
          'A5/2 A5/2 -/4 A5/2 A#5/2 A5/4',
          'F5/8 -/8',
          'G5/2 G5/2 -/4 G5/2 A5/2 G5/4',
          'E5/8 -/8',
          'D6/4 C6/4 A#5/4 A5/4',
          'G5/4 F5/4 E5/4 D5/4',
          'F5/4 E5/4 D5/4 C#5/4',
          'D5/16',
        ].join(' '),
        bass: 'R-------R--5--O-',
        drums: {
          v: 'x--x--x---x-x---',
          q: 'qwqwq-qwqwq-qqww',
          z: 'zzzzzzzzzzzzzzzz',
          k: 'x-------x-------',
        },
        fill: { t: 'hhllhhllhhllhhll', s: '------------xxxx' },
      },
    },
    order: ['A', 'B', 'A', 'C', 'B'],
  },
]

