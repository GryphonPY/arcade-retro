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
  /** Juego estrella: aparece primero y con tarjeta grande en la sala. */
  flagship?: boolean
  /** Se juega mejor con el celular acostado. */
  landscape?: boolean
  /** En desarrollo: no se muestra en el build de producción. */
  wip?: boolean
  /** Cómo se juega en celular, si no usa la cruceta y los botones A/B estándar. */
  touchHelp?: string
  accent: string
  /** Fondo de la vista de juego. */
  viewBg: string
}

const MOVE: ControlHint = { keys: ['←', '↑', '→', '↓'], label: 'mover' }

const ALL_GAMES: GameMeta[] = [
  {
    id: 'nebula-strike',
    flagship: true,
    isNew: true,
    category: 'accion',
    name: 'Nebula Strike',
    genre: 'Shooter de naves',
    year: '1995',
    desc: 'Elige tu nave y atraviesa lluvias de balas neón, mejora tus armas en pleno vuelo y derriba jefes colosales sector tras sector.',
    controls: [
      { keys: ['←', '↑', '→', '↓'], label: 'mover (dispara solo)' },
      { keys: ['Espacio'], label: 'modo concentrado' },
      { keys: ['Shift', 'X'], label: 'bomba' },
    ],
    touchHelp:
      'Arrastra en cualquier parte para mover la nave (dispara sola). Un segundo dedo activa el modo concentrado y el botón BOMBA limpia las balas.',
    accent: '#22d3ee',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(34,211,238,0.14), transparent), #04060f',
  },
  {
    id: 'bunker-93',
    flagship: true,
    landscape: true,
    isNew: true,
    category: 'accion',
    name: 'Búnker 93',
    genre: 'FPS retro',
    year: '1993',
    desc: 'Shooter en primera persona: una base militar tomada por mutantes, oleadas cada vez más brutales y jefes que hacen temblar el piso.',
    controls: [
      { keys: ['W', 'A', 'S', 'D'], label: 'moverse' },
      { keys: ['Mouse'], label: 'apuntar' },
      { keys: ['Clic', 'Espacio'], label: 'disparar' },
      { keys: ['1-5', 'Q'], label: 'armas' },
      { keys: ['E'], label: 'doble cañón' },
    ],
    touchHelp:
      'Con el celular acostado: joystick a la izquierda para moverte, arrastra en la mitad derecha para girar, FUEGO para disparar y ARMA para cambiar. Tiene ayuda de puntería.',
    accent: '#ef4444',
    viewBg: '#0a0505',
  },
  {
    id: 'sunset-run',
    flagship: true,
    landscape: true,
    isNew: true,
    category: 'reflejos',
    name: 'Sunset Run',
    genre: 'Carreras',
    year: '1986',
    desc: 'Carreras en pseudo 3D al atardecer: elige coche y estación de radio, y gana copas contra siete rivales entre curvas, colinas y nitro.',
    controls: [
      { keys: ['←', '→'], label: 'girar' },
      { keys: ['↑'], label: 'acelerar' },
      { keys: ['↓'], label: 'frenar / derrapar' },
      { keys: ['Espacio'], label: 'nitro' },
      { keys: ['R'], label: 'radio' },
    ],
    touchHelp:
      'Con el celular acostado: flechas grandes a la izquierda para girar; FRENO y NITRO a la derecha. Acelera solo por defecto, y puedes activar girar inclinando el teléfono.',
    accent: '#f97316',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(249,115,22,0.14), transparent), #0f0905',
  },
  {
    id: 'pong-duelo',
    category: 'clasicos',
    name: 'Duelo Pong',
    genre: 'Versus',
    year: '1972',
    desc: 'El primer arcade, reinventado: contra la máquina o contra un amigo en el mismo celular, cada quien en su mitad.',
    controls: [
      { keys: ['←', '→'], label: 'paleta azul' },
      { keys: ['J', 'L'], label: 'paleta rosa (2J)' },
      { keys: ['Espacio'], label: 'empezar' },
    ],
    accent: '#60a5fa',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(96,165,250,0.14), transparent), #070b14',
  },
  {
    id: 'defensa-final',
    category: 'accion',
    name: 'Defensa Final',
    genre: 'Defensa',
    year: '1980',
    desc: 'Los misiles caen sobre tus ciudades. Toca o haz clic donde quieras detonar y atrapa varios en una sola explosión.',
    controls: [
      { keys: ['Clic', 'Toque'], label: 'disparar ahí' },
      { keys: ['←', '↑', '→', '↓'], label: 'mira' },
      { keys: ['Espacio'], label: 'disparar' },
    ],
    accent: '#fb7185',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(251,113,133,0.14), transparent), #120710',
  },
  {
    id: 'horda',
    category: 'accion',
    name: 'Horda Nocturna',
    genre: 'Supervivencia',
    year: '1991',
    desc: 'Tu personaje ataca solo: tú solo te mueves. Sobrevive a oleadas infinitas, sube de nivel y combina armas.',
    controls: [{ keys: ['←', '↑', '→', '↓'], label: 'moverse' }],
    accent: '#c084fc',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(192,132,252,0.14), transparent), #0d0814',
  },
  {
    id: 'bloques',
    category: 'clasicos',
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
      { keys: ['↓', 'Shift'], label: 'hiperespacio' },
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
    desc: 'Pisos generados al azar: corta, esquiva justo a tiempo, elige mejoras y derrota al jefe cada cinco pisos.',
    controls: [MOVE, { keys: ['Espacio'], label: 'espada' }, { keys: ['Shift'], label: 'esquiva' }],
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
    desc: 'Embiste taxis, derrapa, cumple misiones y escapa de patrullas, bloqueos y helicópteros a puro turbo.',
    controls: [
      MOVE,
      { keys: ['Espacio'], label: 'turbo' },
      { keys: ['Shift'], label: 'derrape' },
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
    desc: 'Dispara en 8 direcciones, recoge armas, rescata rehenes, súbete al tanque y derrota a un jefe por zona.',
    controls: [
      { keys: ['←', '→'], label: 'correr' },
      { keys: ['↑', '↓'], label: 'apuntar' },
      { keys: ['Espacio'], label: 'disparar' },
      { keys: ['Shift'], label: 'saltar' },
    ],
    accent: '#ff8a3d',
    viewBg: 'radial-gradient(900px 520px at 50% 0%, rgba(255,138,61,0.14), transparent), #17100a',
  },
]

// Los juegos marcados como `wip` solo aparecen en desarrollo.
export const GAMES: GameMeta[] =
  process.env.NODE_ENV === 'production' ? ALL_GAMES.filter((g) => !g.wip) : ALL_GAMES
