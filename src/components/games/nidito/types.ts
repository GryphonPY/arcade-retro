// Contrato compartido de Nidito (juego de pareja, casa y vestuario).
// Lo usan varias piezas a la vez: no cambies nombres sin avisar al orquestador.

export type Genero = 'chica' | 'chico'

export type SlotRopa = 'arriba' | 'abajo' | 'zapatos' | 'accesorio' | 'pijama'

export interface Look {
  piel: string // color hex
  pelo: string // id de peinado (ver wardrobe-data)
  colorPelo: string // hex
  ojos: string // id de ojos
  colorOjos: string // hex
  rubor: boolean
  genero?: Genero // opcional: partidas viejas no lo tienen (ver guardado.ts)
  ropa: Partial<Record<SlotRopa, string>> // id de prenda por espacio
}

export interface Personaje {
  nombre: string
  look: Look
}

export type CuartoId = 'sala' | 'recamara' | 'cocina' | 'jardin' | 'bano' | 'estudio'

export interface MuebleColocado {
  uid: string // único por pieza colocada
  id: string // id del mueble en el catálogo
  x: number // 0..1 dentro del cuarto (centro)
  y: number // 0..1 dentro del cuarto (base del mueble)
  flip: boolean
}

export interface Cuarto {
  id: CuartoId
  pared: string // id de tapiz/pintura
  piso: string // id de piso
  muebles: MuebleColocado[]
}

export interface Mascota {
  tipo: 'gato' | 'perro' | 'conejo'
  nombre: string
  color: string
  felicidad: number // 0..100
}

export interface Partida {
  version: 1
  creada: number // epoch ms
  pareja: [Personaje, Personaje]
  monedas: number
  corazones: number // experiencia de amor acumulada
  nivelAmor: number // sube con corazones
  cuartos: Cuarto[] // los desbloqueados
  inventario: Record<string, number> // muebles comprados sin colocar: id -> cantidad
  ropaComprada: string[] // ids de prendas compradas
  mascotas: Mascota[]
  citasHechas: Record<string, number> // id de cita -> veces
  ultimoRegalo: string // fecha YYYY-MM-DD del regalo diario
  mejores: Record<string, number> // récords de minijuegos
  // Opcionales: partidas anteriores no los tienen (ver cargarPartida).
  dia?: DiaTareas // tareas del día y su avance
  fotos?: Foto[] // álbum de fotos del cuarto (máximo 30, más reciente primero)
}

/** Tareas del día: se eligen al empezar el día y se renuevan a medianoche (fecha local). */
export interface DiaTareas {
  fecha: string // YYYY-MM-DD
  lista: string[] // ids de tarea (ver tareas.ts)
  cuentas: Record<string, number> // avance por clave de acción
  hechas: string[] // ids de tareas ya completadas (ya dieron recompensa)
}

/** Foto del cuarto: descripción compacta del estado (se vuelve a dibujar en miniatura). */
export interface Foto {
  id: string
  dia: string // YYYY-MM-DD
  t: number // epoch ms
  cuarto: CuartoId
  pared: string
  piso: string
  muebles: MuebleColocado[]
  pareja: Array<{ nombre: string; look: Look; x: number; y: number; dir: 1 | -1 }>
}

/** Props de cada minijuego: al terminar entrega las monedas ganadas (y la puntuación). */
export interface MinijuegoProps {
  onFinish: (resultado: { monedas: number; puntos: number }) => void
  onSalir: () => void
}
