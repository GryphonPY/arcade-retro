/** Catálogo de juegos: metadatos que usan la sala principal y la vista de juego. */

export interface ControlHint {
  /** Teclas que se muestran como chips de teclado. */
  keys: string[]
  label: string
}

export type Category = 'accion' | 'clasicos' | 'reflejos'

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'accion', label: 'Acción' },
  { id: 'clasicos', label: 'Clásicos' },
  { id: 'reflejos', label: 'Reflejos' },
]

export interface GameMeta {
  id: string
  category: Category
  name: string
  genre: string
  year: string
  desc: string
  controls: ControlHint[]
  /** Color de acento principal del juego. */
  /** Marca el juego como novedad en la sala. */
  isNew?: boolean
  accent: string
  /** Fondo de la vista de juego. */
  viewBg: string
}

const MOVE: ControlHint = { keys: ['←', '↑', '→', '↓'], label: 'mover' }

export const GAMES: GameMeta[] = [
  {
    id: 'bloques',
    category: 'clasicos',
    isNew: true,
    name: 'Bloques',
    genre: 'Puzle',
    year: '1984',
    desc: 'Encaja las piezas que caen y borra líneas. Guarda una pieza, encadena combos y busca el tetra.',
    controls: [
      { keys: ['←', '→'], label: 'mover' },
      { keys: ['↑'], label: 'girar' },
      { keys: ['↓'], label: 'bajar' },
      { keys: ['Espacio'], label: 'soltar' },
      { keys: ['Shift'], label: 'guardar' },
    ],
    accent: '#a78bfa',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(167,139,250,0.16), transparent), #0b0916',
  },
  {
    id: 'flap-pixel',
    category: 'reflejos',
    isNew: true,
    name: 'Flap Pixel',
    genre: 'Un botón',
    year: '1989',
    desc: 'Aletea entre tuberías sin tocarlas. Un solo botón, cero piedad. ¿Cuántas pasas?',
    controls: [{ keys: ['Espacio', '↑'], label: 'aletear' }],
    accent: '#4ade80',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(74,222,128,0.14), transparent), #07130c',
  },
  {
    id: 'cruza-camino',
    category: 'reflejos',
    isNew: true,
    name: 'Cruza el Camino',
    genre: 'Esquiva',
    year: '1981',
    desc: 'Avanza sin fin entre autopistas, ríos con troncos y vías de tren. No te quedes quieto.',
    controls: [MOVE],
    accent: '#38f0a0',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(56,240,160,0.12), transparent), #08120f',
  },
  {
    id: 'torre-neon',
    category: 'reflejos',
    isNew: true,
    name: 'Torre Neón',
    genre: 'Precisión',
    year: '1985',
    desc: 'Apila bloques que se deslizan. Lo que sobresale se corta: los encajes perfectos te recompensan.',
    controls: [{ keys: ['Espacio'], label: 'soltar bloque' }],
    accent: '#f472b6',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(244,114,182,0.16), transparent), #120812',
  },
  {
    id: 'asteroid-drift',
    category: 'accion',
    name: 'Asteroid Drift',
    genre: 'Shooter vectorial',
    year: '1979',
    desc: 'Física inercial en 360°. Pulveriza asteroides vectoriales y esquiva los ovnis que te cazan.',
    controls: [
      { keys: ['←', '→'], label: 'girar' },
      { keys: ['↑'], label: 'empuje' },
      { keys: ['Espacio'], label: 'láser' },
      { keys: ['↓'], label: 'hiperespacio' },
    ],
    accent: '#38bdf8',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(56,189,248,0.14), transparent), #050710',
  },
  {
    id: 'cyber-dungeon',
    category: 'accion',
    name: 'Cyber Dungeon',
    genre: 'Mazmorra rogue',
    year: '1986',
    desc: 'Baja piso a piso, corta esqueletos con tu espada y encuentra la llave dorada para escapar.',
    controls: [MOVE, { keys: ['Espacio'], label: 'espada' }, { keys: ['Shift'], label: 'poción' }],
    accent: '#f59e0b',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(245,158,11,0.14), transparent), #100c08',
  },
  {
    id: 'snake-neon',
    category: 'clasicos',
    name: 'Snake Neón',
    genre: 'Clásico',
    year: '1976',
    desc: 'La serpiente de siempre en una rejilla synthwave. Cada cinco orbes aparece uno dorado.',
    controls: [MOVE],
    accent: '#22f7c5',
    viewBg: 'radial-gradient(900px 520px at 50% -10%, rgba(176,38,255,0.2), transparent), radial-gradient(700px 420px at 80% 110%, rgba(34,247,197,0.12), transparent), #0c0a14',
  },
  {
    id: 'space-invasion',
    category: 'accion',
    name: 'Invasión Espacial',
    genre: 'Matamarcianos',
    year: '1978',
    desc: 'Oleadas de invasores pixelados bajan sin descanso. Eres la última línea de defensa.',
    controls: [{ keys: ['←', '→'], label: 'mover' }, { keys: ['Espacio'], label: 'disparar' }],
    accent: '#5fe8de',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(95,232,222,0.1), transparent), #050510',
  },
  {
    id: 'desert-runner',
    category: 'reflejos',
    name: 'Corredor del Desierto',
    genre: 'Endless runner',
    year: '1984',
    desc: 'Un armadillo a toda velocidad esquiva cactus, rocas y buitres bajo el sol poniente.',
    controls: [{ keys: ['↑', 'Espacio'], label: 'saltar' }, { keys: ['↓'], label: 'agacharse' }],
    accent: '#e8a94f',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(232,169,79,0.18), transparent), #1c1308',
  },
  {
    id: 'ghost-maze',
    category: 'clasicos',
    name: 'Laberinto Fantasma',
    genre: 'Laberinto',
    year: '1980',
    desc: 'Come todas las bolitas mientras tres fantasmas te persiguen. Las grandes los asustan.',
    controls: [MOVE],
    accent: '#ffe23d',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(77,99,255,0.16), transparent), #04040e',
  },
  {
    id: 'traffic-racer',
    category: 'reflejos',
    name: 'Carrera de Tráfico',
    genre: 'Carreras',
    year: '1982',
    desc: 'Autopista nocturna a fondo: zigzaguea entre coches y suma kilómetros sin chocar.',
    controls: [
      { keys: ['←', '→'], label: 'carril' },
      { keys: ['↑', 'Espacio'], label: 'turbo' },
      { keys: ['↓'], label: 'freno' },
    ],
    accent: '#e85d5d',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(232,93,93,0.14), transparent), #14121c',
  },
  {
    id: 'brick-breaker',
    category: 'clasicos',
    name: 'Rompe Ladrillos',
    genre: 'Paleta',
    year: '1976',
    desc: 'Paleta, bola y un muro de colores pastel que pide a gritos ser derribado.',
    controls: [{ keys: ['←', '→'], label: 'paleta' }, { keys: ['Espacio'], label: 'lanzar' }],
    accent: '#7dd8b7',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(125,216,183,0.16), transparent), #0a1410',
  },
  {
    id: 'hit-and-run',
    category: 'accion',
    name: 'Hit & Run',
    genre: 'Persecución',
    year: '1988',
    desc: 'Embiste taxis por la ciudad pixelada y escapa de la policía a puro turbo.',
    controls: [
      { keys: ['←', '→'], label: 'mover' },
      { keys: ['↑', 'Espacio'], label: 'turbo' },
      { keys: ['↓'], label: 'freno' },
    ],
    accent: '#ffc531',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(255,197,49,0.12), transparent), #0e0e1e',
  },
  {
    id: 'gun-and-run',
    category: 'accion',
    name: 'Gun & Run',
    genre: 'Run & gun',
    year: '1987',
    desc: 'Corre, salta y dispara por la selva al atardecer contra soldados, drones y torretas.',
    controls: [
      { keys: ['←', '→'], label: 'correr' },
      { keys: ['↑'], label: 'saltar' },
      { keys: ['Espacio'], label: 'disparar' },
    ],
    accent: '#ff8a3d',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(255,138,61,0.14), transparent), #17100a',
  },
]
