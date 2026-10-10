// Catálogo de Nidito: cuartos, muebles (con su dibujo SVG), paredes y pisos.
// Los dibujos usan viewBox 0 0 100 100 con la base del mueble en y = 100 aprox.
// Medidas: `ancho` es fracción del ancho del cuarto; `alto` también va en unidades
// del ancho del cuarto (así el mueble conserva su proporción en cualquier pantalla).

import type { CuartoId } from './types'

export interface CuartoInfo {
  nombre: string
  emoji: string
  precio: number // 0 = ya desbloqueado al empezar
  paredInicial: string
  pisoInicial: string
}

export interface Mueble {
  id: string
  nombre: string
  cuarto: CuartoId
  precio: number
  ancho: number
  alto: number
  colgado?: boolean // va en la pared (cuadros, espejos)
  asiento?: number // altura del asiento sobre la base, en unidades del ancho del cuarto
  luz?: boolean // lámpara: se enciende de noche
  amor?: number // nivel de amor necesario para comprarlo
  svg: string
}

export interface Superficie {
  id: string
  nombre: string
  precio: number
  fondo: string // valor CSS de `background`
  amor?: number
}

export const CUARTOS: Record<CuartoId, CuartoInfo> = {
  sala: { nombre: 'Sala', emoji: '🛋️', precio: 0, paredInicial: 'pared-menta', pisoInicial: 'piso-madera' },
  recamara: { nombre: 'Recámara', emoji: '🛏️', precio: 0, paredInicial: 'pared-lila', pisoInicial: 'piso-alfombra' },
  cocina: { nombre: 'Cocina', emoji: '🍳', precio: 150, paredInicial: 'pared-ladrillo', pisoInicial: 'piso-azulejo' },
  bano: { nombre: 'Baño', emoji: '🛁', precio: 120, paredInicial: 'pared-burbujas', pisoInicial: 'piso-cuadros-menta' },
  jardin: { nombre: 'Jardín', emoji: '🌷', precio: 200, paredInicial: 'pared-cielo', pisoInicial: 'piso-pasto' },
  estudio: { nombre: 'Estudio', emoji: '📚', precio: 250, paredInicial: 'pared-lila', pisoInicial: 'piso-madera-oscura' },
}

// ---------- ayudantes de dibujo (devuelven fragmentos SVG) ----------

const OSC = '#7a5068'
const SOMBRA_FILL = 'rgba(96,56,84,0.16)'

const r = (x: number, y: number, w: number, h: number, f: string, rx = 3, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${extra}/>`
const c = (cx: number, cy: number, rad: number, f: string, extra = '') =>
  `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${f}" ${extra}/>`
const el = (cx: number, cy: number, rx: number, ry: number, f: string, extra = '') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${extra}/>`
const pa = (d: string, f: string, extra = '') => `<path d="${d}" fill="${f}" ${extra}/>`
const ln = (x1: number, y1: number, x2: number, y2: number, s: string, w = 2) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${w}" stroke-linecap="round"/>`
const sombra = (w = 70) => el(50, 96, w / 2, 3.5, SOMBRA_FILL)
const corazon = (x: number, y: number, s: number, f: string) =>
  pa(`M${x} ${y + s * 0.3} C${x} ${y - s * 0.2} ${x - s * 0.6} ${y - s * 0.2} ${x - s * 0.6} ${y + s * 0.15} C${x - s * 0.6} ${y + s * 0.5} ${x} ${y + s * 0.7} ${x} ${y + s} C${x} ${y + s * 0.7} ${x + s * 0.6} ${y + s * 0.5} ${x + s * 0.6} ${y + s * 0.15} C${x + s * 0.6} ${y - s * 0.2} ${x} ${y - s * 0.2} ${x} ${y + s * 0.3}Z`, f)

/** Tapa superior: un tono más claro sobre una pieza, para dar volumen. */
const tapa = (x: number, y: number, w: number, h: number, f = '#ffffff') =>
  r(x, y, w, h, f, Math.min(h / 2, 4), 'opacity="0.28"')

const sofa = (b: string, cuerpo: string, cojin: string, ancho = 92) => {
  const x0 = (100 - ancho) / 2
  const cw = (ancho - 28) / 2
  return (
    sombra(ancho + 4) +
    // patas con perspectiva (más oscuras y cortas al frente)
    r(x0 + 6, 86, 6, 9, OSC, 2) +
    r(x0 + ancho - 12, 86, 6, 9, OSC, 2) +
    // respaldo: cara frontal y tapa superior
    r(x0 + 4, 30, ancho - 8, 40, b, 14) +
    tapa(x0 + 10, 32, ancho - 20, 5) +
    c(x0 + 22, 44, 1.6, OSC, 'opacity="0.3"') +
    c(50, 44, 1.6, OSC, 'opacity="0.3"') +
    c(x0 + ancho - 22, 44, 1.6, OSC, 'opacity="0.3"') +
    // brazos con tapa
    r(x0 - 4, 46, 14, 42, cuerpo, 7) +
    tapa(x0 - 2, 47, 10, 4) +
    r(x0 + ancho - 10, 46, 14, 42, cuerpo, 7) +
    tapa(x0 + ancho - 8, 47, 10, 4) +
    // frente del asiento
    r(x0 + 10, 68, ancho - 20, 20, cuerpo, 6) +
    r(x0 + 10, 84, ancho - 20, 4, OSC, 2, 'opacity="0.18"') +
    // cojines con tapa clara y sombra en el borde de abajo
    r(x0 + 14, 56, cw, 18, cojin, 7) +
    tapa(x0 + 16, 57, cw - 4, 4) +
    r(x0 + 14 + cw + 2, 56, cw, 18, cojin, 7) +
    tapa(x0 + 16 + cw + 2, 57, cw - 4, 4)
  )
}

const silla = (madera: string, cojin: string, respaldo: boolean) =>
  (respaldo ? r(30, 14, 40, 44, madera, 6) : '') +
  r(22, 56, 56, 12, madera, 5) +
  r(26, 68, 6, 28, madera, 2) +
  r(68, 68, 6, 28, madera, 2) +
  r(26, 50, 48, 8, cojin, 4)

const mesa = (t: string, pata: string, w = 70) =>
  sombra(w + 6) +
  r(50 - w / 2 + 6, 60, 6, 36, pata, 2) +
  r(50 + w / 2 - 12, 60, 6, 36, pata, 2) +
  r(50 - w / 2 + 4, 56, w - 8, 5, pata, 2, 'opacity="0.6"') +
  r(50 - w / 2, 46, w, 10, t, 4) +
  tapa(50 - w / 2 + 3, 47, w - 6, 3) +
  r(50 - w / 2, 53, w, 3, pata, 1.5, 'opacity="0.35"')

const cama = (cabecera: string, colchon: string, cobija: string, almohada = '#ffffff') =>
  r(4, 30, 10, 62, cabecera, 4) +
  r(10, 62, 84, 22, colchon, 8) +
  r(20, 52, 26, 14, almohada, 7) +
  r(52, 52, 26, 14, almohada, 7) +
  r(44, 64, 50, 20, cobija, 7) +
  r(10, 84, 6, 12, OSC, 2) +
  r(84, 84, 6, 12, OSC, 2)

const planta = (maceta: string, hoja: string, alto = 62) =>
  sombra(30) +
  r(36, 72, 28, 28, maceta, 6) +
  r(33, 68, 34, 7, maceta, 3) +
  tapa(36, 69, 28, 3) +
  pa(`M50 72 C34 60 30 ${100 - alto + 14} 42 ${100 - alto}`, hoja, 'stroke="none"') +
  pa(`M50 72 C66 60 70 ${100 - alto + 14} 58 ${100 - alto}`, hoja, 'stroke="none"') +
  el(50, 100 - alto + 4, 14, 16, hoja) +
  el(34, 100 - alto + 22, 9, 6, hoja) +
  el(66, 100 - alto + 22, 9, 6, hoja) +
  el(44, 100 - alto + 10, 4, 7, '#ffffff', 'opacity="0.25"')

const lampara = (pantalla: string, base: string, alto = 60) =>
  sombra(22) +
  r(47, 100 - alto + 30, 6, alto - 36, base, 2) +
  el(50, 90, 12, 4, base) +
  el(50, 88, 9, 2.5, '#ffffff', 'opacity="0.3"') +
  pa(`M32 ${100 - alto + 30} L68 ${100 - alto + 30} L62 ${100 - alto} L38 ${100 - alto} Z`, pantalla) +
  el(50, 100 - alto, 12, 3, '#ffffff', 'opacity="0.5"') +
  el(50, 100 - alto + 30, 18, 3, '#f5d98a', 'opacity="0.6"')

const cuadro = (marco: string, dentro: string) =>
  r(10, 14, 80, 66, marco, 8) + r(18, 22, 64, 50, dentro, 4)

const peluche = (cuerpo: string, orejas: string, extra = '') =>
  el(50, 76, 24, 20, cuerpo) +
  c(50, 46, 20, cuerpo) +
  c(34, 30, 9, orejas) +
  c(66, 30, 9, orejas) +
  c(42, 44, 2.6, '#3b2a3a') +
  c(58, 44, 2.6, '#3b2a3a') +
  el(50, 52, 5, 3.5, '#ffb3c9') +
  extra

const ALFOMBRA_FONDO = (fondo: string, borde: string) =>
  el(50, 92, 46, 8, borde) + el(50, 91, 42, 6.5, fondo)

// ---------- muebles ----------

const MUEBLES_BASE: Mueble[] = [
  // ----- sala -----
  {
    id: 'sofa-rosa', nombre: 'Sofá rosita', cuarto: 'sala', precio: 120, ancho: 0.36, alto: 0.2, asiento: 0.088,
    svg: sofa('#ff9fbd', '#ffb3c9', '#ffe0ea'),
  },
  {
    id: 'sofa-menta', nombre: 'Sofá menta', cuarto: 'sala', precio: 140, ancho: 0.36, alto: 0.2, asiento: 0.088,
    svg: sofa('#7fcfb2', '#b5ead7', '#e4fbf2'),
  },
  {
    id: 'sillon-lila', nombre: 'Sillón lila', cuarto: 'sala', precio: 90, ancho: 0.2, alto: 0.2, asiento: 0.088,
    svg: sofa('#a98bf0', '#cdb4ff', '#efe6ff', 70),
  },
  {
    id: 'mesa-centro', nombre: 'Mesita de centro', cuarto: 'sala', precio: 60, ancho: 0.18, alto: 0.1,
    svg: sombra(60) + mesa('#ffe6c7', '#c98f62', 60),
  },
  {
    id: 'lampara-pie', nombre: 'Lámpara de pie', cuarto: 'sala', precio: 80, ancho: 0.08, alto: 0.3, luz: true,
    svg: sombra(20) + lampara('#fff1c9', '#c98f62', 92),
  },
  {
    id: 'tele', nombre: 'Tele pastel', cuarto: 'sala', precio: 150, ancho: 0.2, alto: 0.14,
    svg:
      sombra(60) +
      r(4, 14, 92, 56, '#e9e2f5', 6) +
      r(10, 20, 80, 44, '#b8dcff', 4) +
      r(36, 70, 28, 6, '#c9c2d3', 2) +
      r(30, 76, 40, 18, '#ffd9e6', 4),
  },
  {
    id: 'planta-grande', nombre: 'Planta grande', cuarto: 'sala', precio: 50, ancho: 0.12, alto: 0.26,
    svg: sombra(40) + planta('#ff9fbd', '#6cc48b', 84),
  },
  {
    id: 'alfombra-redonda', nombre: 'Alfombra redonda', cuarto: 'sala', precio: 70, ancho: 0.36, alto: 0.08,
    svg: ALFOMBRA_FONDO('#ffe0ea', '#ffb3c9'),
  },
  {
    id: 'estante-libros', nombre: 'Estante de libros', cuarto: 'sala', precio: 110, ancho: 0.2, alto: 0.28,
    svg:
      r(10, 6, 80, 92, '#e8b98a', 5) +
      r(16, 14, 68, 2.5, '#c98f62') +
      r(16, 46, 68, 2.5, '#c98f62') +
      r(16, 76, 68, 2.5, '#c98f62') +
      r(18, 20, 6, 24, '#ff8fb1', 1.5) + r(25, 22, 5, 22, '#b5ead7', 1.5) + r(31, 19, 6, 25, '#cdb4ff', 1.5) +
      r(42, 24, 6, 20, '#ffd98a', 1.5) + r(50, 21, 5, 23, '#ff8fb1', 1.5) +
      r(20, 52, 7, 22, '#b8dcff', 1.5) + r(28, 55, 6, 19, '#ffb3c9', 1.5) + r(60, 54, 6, 20, '#7fcfb2', 1.5) +
      r(22, 80, 9, 14, '#cdb4ff', 1.5) + r(34, 82, 8, 12, '#ffd98a', 1.5) + r(60, 80, 7, 14, '#ffb3c9', 1.5),
  },
  {
    id: 'peluche-oso', nombre: 'Osito de peluche', cuarto: 'sala', precio: 45, ancho: 0.1, alto: 0.14,
    svg: sombra(34) + peluche('#d9a77a', '#c98f62'),
  },
  {
    id: 'florero', nombre: 'Florero con flores', cuarto: 'sala', precio: 25, ancho: 0.07, alto: 0.12,
    svg:
      ln(50, 40, 50, 86, '#6cc48b', 2) +
      c(50, 34, 7, '#ff8fb1') + c(42, 40, 5, '#ffd98a') + c(58, 40, 5, '#cdb4ff') +
      r(38, 84, 24, 16, '#b8dcff', 6),
  },
  {
    id: 'chimenea', nombre: 'Chimenea acogedora', cuarto: 'sala', precio: 260, ancho: 0.26, alto: 0.24, luz: true, amor: 2,
    svg:
      sombra(90) +
      r(8, 10, 84, 88, '#f3d1ae', 6) +
      r(20, 40, 60, 50, '#5b4a6e', 10) +
      pa('M50 84 C40 72 44 62 50 56 C56 64 60 72 50 84Z', '#ffb35c') +
      pa('M50 84 C45 78 47 72 50 68 C53 74 55 78 50 84Z', '#ffe69a') +
      r(14, 90, 72, 6, '#e9b98e', 2),
  },
  {
    id: 'cuadro-corazon', nombre: 'Cuadro corazón', cuarto: 'sala', precio: 40, ancho: 0.14, alto: 0.14, colgado: true,
    svg: cuadro('#ffd98a', '#ffe6ee') + corazon(50, 28, 44, '#ff8fb1'),
  },
  {
    id: 'cuadro-paisaje', nombre: 'Cuadro paisaje', cuarto: 'sala', precio: 55, ancho: 0.16, alto: 0.12, colgado: true,
    svg:
      cuadro('#c98f62', '#cfeeff') +
      el(30, 60, 26, 16, '#a8e6a1') +
      c(72, 36, 8, '#ffd98a'),
  },
  {
    id: 'cuadro-pareja', nombre: 'Foto de la pareja', cuarto: 'sala', precio: 90, ancho: 0.15, alto: 0.12, colgado: true, amor: 2,
    svg:
      r(10, 10, 80, 80, '#ffffff', 6, 'stroke="#ffb3c9" stroke-width="3"') +
      r(18, 18, 64, 54, '#ffe0ea', 4) +
      c(38, 40, 9, '#f2c6a0') + c(62, 40, 9, '#f2c6a0') +
      pa('M32 56 Q50 70 68 56', 'none', 'stroke="#ff8fb1" stroke-width="3" stroke-linecap="round"') +
      corazon(50, 80, 14, '#ff8fb1'),
  },
  {
    id: 'reloj-pared', nombre: 'Reloj de pared', cuarto: 'sala', precio: 35, ancho: 0.1, alto: 0.1, colgado: true,
    svg:
      c(50, 50, 40, '#ffffff', 'stroke="#c98f62" stroke-width="6"') +
      ln(50, 50, 50, 24, '#7a5068', 3) + ln(50, 50, 68, 56, '#7a5068', 2) +
      c(50, 50, 4, '#ff8fb1'),
  },

  // ----- recámara -----
  {
    id: 'cama-doble', nombre: 'Cama matrimonial', cuarto: 'recamara', precio: 180, ancho: 0.34, alto: 0.2, asiento: 0.06,
    svg: sombra(100) + cama('#ffb3c9', '#fff0f5', '#cdb4ff'),
  },
  {
    id: 'cama-osito', nombre: 'Cama de osito', cuarto: 'recamara', precio: 150, ancho: 0.26, alto: 0.18,
    svg: sombra(80) + cama('#d9a77a', '#fff4e6', '#b5ead7'),
  },
  {
    id: 'cama-corazon', nombre: 'Cama corazón', cuarto: 'recamara', precio: 260, ancho: 0.34, alto: 0.22, amor: 3,
    svg:
      sombra(100) +
      cama('#ff8fb1', '#fff0f5', '#ffb3c9') +
      corazon(50, 32, 18, '#ff8fb1') +
      corazon(24, 44, 8, '#ffd98a'),
  },
  {
    id: 'buro', nombre: 'Buró', cuarto: 'recamara', precio: 45, ancho: 0.1, alto: 0.14,
    svg: sombra(44) + r(14, 40, 72, 56, '#f3d1ae', 5) + r(18, 62, 64, 2, '#c98f62') + c(50, 52, 3, '#c98f62'),
  },
  {
    id: 'lampara-buro', nombre: 'Lámpara de buró', cuarto: 'recamara', precio: 30, ancho: 0.06, alto: 0.14, luz: true,
    svg: sombra(20) + lampara('#fff1c9', '#ffb3c9', 56),
  },
  {
    id: 'tocador', nombre: 'Tocador con espejo', cuarto: 'recamara', precio: 130, ancho: 0.2, alto: 0.24,
    svg:
      sombra(64) +
      r(18, 4, 64, 46, '#cfeeff', 30, 'stroke="#ffd98a" stroke-width="4"') +
      r(20, 56, 60, 14, '#ffb3c9', 5) +
      r(28, 70, 6, 26, '#e9b98e', 2) + r(66, 70, 6, 26, '#e9b98e', 2) +
      c(42, 62, 3, '#ffffff') + c(56, 62, 3, '#ffffff'),
  },
  {
    id: 'ropero', nombre: 'Ropero rosa', cuarto: 'recamara', precio: 160, ancho: 0.2, alto: 0.34,
    svg:
      sombra(76) +
      r(10, 4, 80, 92, '#ffb3c9', 6) +
      r(16, 10, 33, 80, '#ffd3e0', 4) + r(51, 10, 33, 80, '#ffd3e0', 4) +
      c(44, 50, 2.5, '#c98f62') + c(56, 50, 2.5, '#c98f62') +
      r(14, 94, 8, 4, OSC, 2) + r(78, 94, 8, 4, OSC, 2),
  },
  {
    id: 'puf-corazon', nombre: 'Puf corazón', cuarto: 'recamara', precio: 55, ancho: 0.1, alto: 0.08, asiento: 0.03,
    svg: sombra(56) + corazon(50, 22, 80, '#ff8fb1') + el(50, 74, 36, 18, '#ff8fb1'),
  },
  {
    id: 'cuadro-luna', nombre: 'Cuadro luna', cuarto: 'recamara', precio: 45, ancho: 0.13, alto: 0.13, colgado: true,
    svg: cuadro('#a98bf0', '#2f2a5a') + c(50, 50, 22, '#ffe69a') + c(58, 42, 18, '#2f2a5a'),
  },
  {
    id: 'nube-luz', nombre: 'Nube de luz', cuarto: 'recamara', precio: 90, ancho: 0.18, alto: 0.1, colgado: true, luz: true,
    svg:
      c(34, 56, 18, '#fff9e6') + c(52, 46, 24, '#fff9e6') + c(70, 58, 16, '#fff9e6') +
      r(18, 54, 66, 18, '#fff9e6', 9) +
      c(44, 58, 2.4, '#7a5068') + c(60, 58, 2.4, '#7a5068'),
  },
  {
    id: 'peluche-conejo', nombre: 'Conejito de peluche', cuarto: 'recamara', precio: 40, ancho: 0.08, alto: 0.14,
    svg:
      sombra(30) +
      el(50, 78, 20, 16, '#ffffff') +
      r(42, 14, 9, 36, '#ffffff', 4.5) + r(55, 14, 9, 36, '#ffffff', 4.5) +
      r(44, 20, 4, 24, '#ffb3c9', 2) + r(57, 20, 4, 24, '#ffb3c9', 2) +
      c(50, 56, 20, '#ffffff') +
      c(43, 53, 2.4, '#3b2a3a') + c(57, 53, 2.4, '#3b2a3a') +
      el(50, 60, 4, 2.6, '#ff8fb1'),
  },
  {
    id: 'alfombra-peluda', nombre: 'Alfombra peluda', cuarto: 'recamara', precio: 65, ancho: 0.3, alto: 0.07,
    svg: el(50, 92, 44, 8, '#e9dcff') + el(50, 90, 40, 6, '#f6efff') + el(50, 90, 30, 4, '#ffffff'),
  },

  // ----- cocina -----
  {
    id: 'estufa', nombre: 'Estufa', cuarto: 'cocina', precio: 120, ancho: 0.16, alto: 0.26,
    svg:
      sombra(60) +
      r(8, 8, 84, 88, '#e4dfea', 6) +
      r(14, 14, 72, 30, '#ffffff', 4) +
      c(30, 28, 6, '#ff8fb1') + c(50, 28, 6, '#ffd98a') + c(70, 28, 6, '#cdb4ff') +
      r(14, 54, 72, 36, '#c9c2d3', 4) +
      r(24, 62, 52, 20, '#7a5068', 3),
  },
  {
    id: 'refri', nombre: 'Refri rosa', cuarto: 'cocina', precio: 160, ancho: 0.14, alto: 0.34,
    svg:
      sombra(60) +
      r(12, 4, 76, 92, '#ffd3e0', 10) +
      r(14, 36, 72, 2, '#ffb3c9') +
      r(72, 14, 4, 16, '#c98f62', 2) + r(72, 44, 4, 26, '#c98f62', 2) +
      r(24, 10, 20, 4, '#ffffff', 2),
  },
  {
    id: 'mesa-comedor', nombre: 'Mesa de comedor', cuarto: 'cocina', precio: 140, ancho: 0.3, alto: 0.18,
    svg: sombra(96) + mesa('#e9b98e', '#c98f62', 90) + c(30, 46, 6, '#ffb3c9') + c(68, 46, 6, '#ffd98a'),
  },
  {
    id: 'silla-cocina', nombre: 'Silla de cocina', cuarto: 'cocina', precio: 40, ancho: 0.1, alto: 0.2, asiento: 0.1,
    svg: sombra(40) + silla('#e9b98e', '#ffb3c9', true),
  },
  {
    id: 'alacena', nombre: 'Alacena', cuarto: 'cocina', precio: 110, ancho: 0.24, alto: 0.14, colgado: true,
    svg:
      r(4, 10, 92, 84, '#f3d1ae', 6) +
      r(10, 16, 38, 72, '#e9b98e', 4) + r(52, 16, 38, 72, '#e9b98e', 4) +
      c(42, 52, 2.4, '#7a5068') + c(58, 52, 2.4, '#7a5068') +
      r(16, 26, 10, 12, '#ffd98a', 2) + r(60, 26, 10, 12, '#ffb3c9', 2),
  },
  {
    id: 'cafetera', nombre: 'Cafetera', cuarto: 'cocina', precio: 35, ancho: 0.07, alto: 0.1,
    svg: sombra(30) + r(22, 30, 56, 66, '#ffb3c9', 10) + r(34, 14, 32, 18, '#c9c2d3', 4) + r(38, 60, 24, 16, '#7a5068', 4),
  },
  {
    id: 'frutero', nombre: 'Frutero', cuarto: 'cocina', precio: 25, ancho: 0.08, alto: 0.07,
    svg: sombra(40) + el(50, 72, 38, 10, '#ffffff') + c(34, 62, 10, '#ff8fb1') + c(52, 58, 11, '#ffd98a') + c(68, 64, 9, '#a8e6a1'),
  },
  {
    id: 'barra-cocina', nombre: 'Barra con cajones', cuarto: 'cocina', precio: 100, ancho: 0.3, alto: 0.2,
    svg:
      sombra(96) +
      r(4, 40, 92, 56, '#ffe6c7', 6) +
      r(10, 46, 38, 44, '#f3d1ae', 4) + r(52, 46, 38, 44, '#f3d1ae', 4) +
      c(29, 56, 2.5, '#7a5068') + c(71, 56, 2.5, '#7a5068') +
      r(2, 34, 96, 8, '#ffffff', 4),
  },

  // ----- baño -----
  {
    id: 'tina', nombre: 'Tina de burbujas', cuarto: 'bano', precio: 200, ancho: 0.3, alto: 0.17,
    svg:
      sombra(96) +
      r(4, 40, 92, 46, '#ffffff', 22, 'stroke="#b8dcff" stroke-width="4"') +
      el(50, 46, 40, 6, '#cfeeff') +
      c(30, 42, 6, '#ffffff') + c(44, 38, 8, '#ffffff') + c(62, 40, 6, '#ffffff') + c(74, 36, 4, '#ffffff'),
  },
  {
    id: 'lavabo', nombre: 'Lavabo', cuarto: 'bano', precio: 90, ancho: 0.16, alto: 0.26,
    svg:
      sombra(60) +
      r(22, 62, 56, 34, '#ffffff', 8, 'stroke="#b8dcff" stroke-width="2"') +
      r(18, 46, 64, 16, '#ffffff', 8) +
      r(46, 30, 8, 18, '#c9c2d3', 3) +
      r(30, 92, 8, 6, '#c9c2d3', 2) + r(62, 92, 8, 6, '#c9c2d3', 2),
  },
  {
    id: 'sanitario', nombre: 'Sanitario', cuarto: 'bano', precio: 110, ancho: 0.14, alto: 0.22,
    svg:
      sombra(50) +
      r(14, 60, 72, 24, '#ffffff', 10, 'stroke="#b8dcff" stroke-width="2"') +
      r(20, 20, 60, 46, '#ffffff', 12) +
      r(30, 10, 40, 14, '#cfeeff', 6) +
      r(40, 84, 20, 10, '#ffffff', 4),
  },
  {
    id: 'espejo-bano', nombre: 'Espejo con luces', cuarto: 'bano', precio: 50, ancho: 0.12, alto: 0.18, colgado: true,
    svg: r(10, 6, 80, 88, '#ffffff', 40, 'stroke="#ffd98a" stroke-width="5"') + r(20, 16, 60, 68, '#cfeeff', 30),
  },
  {
    id: 'toallero', nombre: 'Toallero', cuarto: 'bano', precio: 30, ancho: 0.1, alto: 0.12, colgado: true,
    svg:
      r(6, 30, 88, 6, '#c9c2d3', 3) +
      r(18, 36, 24, 44, '#ffb3c9', 6) + r(50, 36, 24, 44, '#b5ead7', 6) +
      c(30, 48, 2, '#ffffff') + c(62, 48, 2, '#ffffff'),
  },
  {
    id: 'patito', nombre: 'Patito de hule', cuarto: 'bano', precio: 20, ancho: 0.06, alto: 0.07,
    svg: sombra(30) + el(50, 72, 30, 20, '#ffd98a') + c(72, 46, 16, '#ffd98a') + pa('M86 46 L100 50 L86 54Z', '#ff9c4a') + c(76, 40, 2.4, '#3b2a3a'),
  },
  {
    id: 'tapete-bano', nombre: 'Tapete de baño', cuarto: 'bano', precio: 25, ancho: 0.2, alto: 0.05,
    svg: el(50, 92, 46, 6, '#ffffff') + el(50, 91, 36, 3.5, '#b5ead7'),
  },

  // ----- jardín -----
  {
    id: 'arbol-cerezo', nombre: 'Árbol de cerezo', cuarto: 'jardin', precio: 200, ancho: 0.3, alto: 0.5,
    svg:
      sombra(60) +
      r(44, 60, 12, 36, '#b07a58', 4) +
      c(50, 40, 32, '#ffc2d9') + c(30, 52, 20, '#ffb3c9') + c(70, 52, 20, '#ffb3c9') + c(50, 24, 20, '#ffd9e6') +
      c(40, 34, 3, '#ff8fb1') + c(62, 48, 3, '#ff8fb1') + c(52, 60, 3, '#ff8fb1'),
  },
  {
    id: 'flores-maceta', nombre: 'Macetas de flores', cuarto: 'jardin', precio: 40, ancho: 0.12, alto: 0.12,
    svg:
      sombra(50) +
      r(14, 70, 30, 24, '#e8b98a', 5) + r(56, 70, 30, 24, '#e8b98a', 5) +
      c(29, 58, 10, '#ff8fb1') + c(29, 58, 4, '#ffd98a') +
      c(71, 56, 11, '#cdb4ff') + c(71, 56, 4, '#ffffff') +
      ln(29, 70, 29, 84, '#6cc48b', 2) + ln(71, 68, 71, 84, '#6cc48b', 2),
  },
  {
    id: 'banca', nombre: 'Banca de jardín', cuarto: 'jardin', precio: 110, ancho: 0.24, alto: 0.12, asiento: 0.06,
    svg:
      sombra(92) +
      r(6, 30, 88, 10, '#ffffff', 5) +
      r(6, 52, 88, 10, '#ffffff', 5) +
      r(12, 62, 6, 34, '#c98f62', 2) + r(82, 62, 6, 34, '#c98f62', 2) +
      r(10, 40, 80, 2, '#c98f62') +
      r(16, 30, 6, 10, '#c98f62', 2) + r(78, 30, 6, 10, '#c98f62', 2),
  },
  {
    id: 'fuente', nombre: 'Fuente de jardín', cuarto: 'jardin', precio: 220, ancho: 0.22, alto: 0.26,
    svg:
      sombra(80) +
      el(50, 88, 40, 9, '#cfeeff', 'stroke="#b8dcff" stroke-width="2"') +
      r(44, 46, 12, 42, '#ffffff', 4) +
      el(50, 40, 28, 7, '#ffffff') + el(50, 36, 18, 5, '#cfeeff') +
      pa('M50 34 Q44 20 50 12 Q56 20 50 34Z', '#b8dcff'),
  },
  {
    id: 'arco-flores', nombre: 'Arco de flores', cuarto: 'jardin', precio: 220, ancho: 0.24, alto: 0.34, amor: 4,
    svg:
      sombra(80) +
      pa('M14 96 L14 40 Q50 2 86 40 L86 96', 'none', 'stroke="#ffffff" stroke-width="6" stroke-linecap="round"') +
      c(14, 46, 8, '#ff8fb1') + c(28, 22, 8, '#cdb4ff') + c(50, 10, 8, '#ffd98a') + c(72, 22, 8, '#ff8fb1') + c(86, 46, 8, '#cdb4ff') +
      c(22, 60, 6, '#ffb3c9') + c(78, 60, 6, '#ffb3c9'),
  },
  {
    id: 'rosal', nombre: 'Rosal', cuarto: 'jardin', precio: 70, ancho: 0.14, alto: 0.2,
    svg:
      sombra(40) + r(46, 60, 8, 34, '#6cc48b', 3) +
      c(36, 52, 12, '#a8e6a1') + c(64, 52, 12, '#a8e6a1') + c(50, 40, 14, '#a8e6a1') +
      c(40, 46, 4, '#ff8fb1') + c(60, 40, 4, '#ff8fb1') + c(54, 56, 4, '#ff8fb1'),
  },
  {
    id: 'mesa-picnic', nombre: 'Mesa de picnic', cuarto: 'jardin', precio: 130, ancho: 0.26, alto: 0.15, asiento: 0.06,
    svg:
      sombra(92) +
      r(10, 50, 80, 8, '#ffb3c9', 4) +
      r(18, 58, 6, 38, '#c98f62', 2) + r(76, 58, 6, 38, '#c98f62', 2) +
      r(4, 70, 12, 8, '#ffd98a', 4) + r(84, 70, 12, 8, '#ffd98a', 4) +
      r(44, 42, 12, 8, '#ffffff', 3),
  },
  {
    id: 'cerquita', nombre: 'Cerquita blanca', cuarto: 'jardin', precio: 60, ancho: 0.34, alto: 0.1,
    svg:
      r(2, 40, 96, 6, '#ffffff', 3) + r(2, 66, 96, 6, '#ffffff', 3) +
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => r(4 + i * 12, 30, 6, 66, '#ffffff', 3)).join('') +
      c(10, 96, 3, '#ffb3c9'),
  },
  {
    id: 'casita-mascota', nombre: 'Casita de mascota', cuarto: 'jardin', precio: 90, ancho: 0.14, alto: 0.14,
    svg:
      sombra(70) +
      pa('M12 52 L50 16 L88 52 Z', '#ffb3c9') +
      r(20, 50, 60, 46, '#ffd9e6', 4) +
      r(40, 66, 20, 30, '#c98f62', 10) +
      r(8, 50, 84, 4, '#ff8fb1', 2),
  },
  {
    id: 'fuente-amor', nombre: 'Fuente de corazones', cuarto: 'jardin', precio: 400, ancho: 0.24, alto: 0.3, amor: 5,
    svg:
      sombra(84) +
      el(50, 90, 42, 9, '#ffd9e6', 'stroke="#ff8fb1" stroke-width="2"') +
      r(44, 52, 12, 38, '#ffffff', 4) +
      corazon(50, 6, 36, '#ff8fb1') +
      el(50, 46, 26, 6, '#ffffff') + el(50, 42, 14, 4, '#ffd9e6'),
  },

  // ----- estudio -----
  {
    id: 'escritorio', nombre: 'Escritorio', cuarto: 'estudio', precio: 150, ancho: 0.28, alto: 0.2, asiento: 0.1,
    svg: sombra(96) + mesa('#ffe6c7', '#c98f62', 92) + r(60, 36, 22, 16, '#cfeeff', 3),
  },
  {
    id: 'silla-escritorio', nombre: 'Silla giratoria', cuarto: 'estudio', precio: 90, ancho: 0.12, alto: 0.24, asiento: 0.12,
    svg:
      sombra(50) +
      r(38, 10, 24, 40, '#ff9fbd', 10) +
      r(26, 50, 48, 14, '#ffb3c9', 7) +
      ln(50, 64, 50, 80, '#7a5068', 4) +
      ln(26, 88, 74, 88, '#7a5068', 4),
  },
  {
    id: 'librero', nombre: 'Librero alto', cuarto: 'estudio', precio: 170, ancho: 0.18, alto: 0.34,
    svg:
      r(8, 4, 84, 92, '#e8b98a', 5) +
      r(14, 10, 72, 2.5, '#c98f62') + r(14, 36, 72, 2.5, '#c98f62') + r(14, 62, 72, 2.5, '#c98f62') + r(14, 88, 72, 2.5, '#c98f62') +
      r(18, 16, 6, 18, '#cdb4ff', 1.5) + r(26, 18, 5, 16, '#ffb3c9', 1.5) + r(33, 14, 6, 20, '#b5ead7', 1.5) +
      r(18, 42, 7, 18, '#ffd98a', 1.5) + r(27, 44, 6, 16, '#7fcfb2', 1.5) +
      r(18, 68, 6, 18, '#ffb3c9', 1.5) + r(26, 70, 8, 16, '#cdb4ff', 1.5) + r(62, 66, 6, 20, '#b8dcff', 1.5),
  },
  {
    id: 'globo', nombre: 'Globo terráqueo', cuarto: 'estudio', precio: 80, ancho: 0.1, alto: 0.18,
    svg:
      sombra(40) +
      ln(50, 82, 50, 98, '#c98f62', 4) +
      el(50, 40, 30, 4, '#c98f62') +
      c(50, 40, 32, '#b8dcff') +
      el(44, 36, 12, 8, '#a8e6a1') + el(62, 50, 8, 12, '#a8e6a1'),
  },
  {
    id: 'lampara-escritorio', nombre: 'Lámpara de escritorio', cuarto: 'estudio', precio: 55, ancho: 0.07, alto: 0.16, luz: true,
    svg: sombra(30) + ln(50, 90, 36, 40, '#ffb3c9', 4) + ln(36, 40, 60, 24, '#ffb3c9', 4) + pa('M54 22 L72 30 L62 40 Z', '#fff1c9'),
  },
  {
    id: 'diploma', nombre: 'Diploma de amor', cuarto: 'estudio', precio: 70, ancho: 0.15, alto: 0.1, colgado: true,
    svg:
      r(6, 16, 88, 68, '#fff9e6', 4, 'stroke="#ffd98a" stroke-width="5"') +
      r(18, 26, 64, 4, '#ff8fb1', 2) + r(26, 36, 48, 3, '#c9c2d3', 1.5) + r(26, 44, 40, 3, '#c9c2d3', 1.5) +
      c(50, 70, 9, '#ff8fb1'),
  },
  {
    id: 'maquina-escribir', nombre: 'Máquina de escribir', cuarto: 'estudio', precio: 95, ancho: 0.12, alto: 0.1,
    svg:
      sombra(60) +
      r(10, 46, 80, 40, '#ffb3c9', 8) +
      r(20, 26, 60, 22, '#fff9e6', 3) +
      r(14, 60, 72, 6, '#ff8fb1', 3) +
      c(30, 72, 3, '#7a5068') + c(44, 72, 3, '#7a5068') + c(58, 72, 3, '#7a5068') + c(72, 72, 3, '#7a5068'),
  },
]

/** Escala del mobiliario: más grande frente a los personajes (se ve más acogedor). */
const ESCALA_MUEBLE = 1.3

export const MUEBLES: Mueble[] = MUEBLES_BASE.map((m) => ({
  ...m,
  ancho: m.ancho * ESCALA_MUEBLE,
  alto: m.alto * ESCALA_MUEBLE,
  asiento: m.asiento !== undefined ? m.asiento * ESCALA_MUEBLE : undefined,
}))

// ---------- paredes y pisos ----------

export const PAREDES: Superficie[] = [
  { id: 'pared-menta', nombre: 'Menta suave', precio: 0, fondo: 'linear-gradient(180deg,#e6fbf2,#c6eedb)' },
  { id: 'pared-lila', nombre: 'Lila nube', precio: 0, fondo: 'linear-gradient(180deg,#f1eaff,#d8c7ff)' },
  { id: 'pared-rosa', nombre: 'Rosa polvo', precio: 40, fondo: 'linear-gradient(180deg,#fff0f6,#ffd0e0)' },
  { id: 'pared-cielo', nombre: 'Cielito', precio: 0, fondo: 'linear-gradient(180deg,#cfeeff,#fff3f9)' },
  { id: 'pared-rayas', nombre: 'Rayitas rosas', precio: 60, fondo: 'repeating-linear-gradient(90deg,#fff0f6 0 26px,#ffc9dc 26px 34px)' },
  { id: 'pared-burbujas', nombre: 'Burbujitas azules', precio: 70, fondo: 'radial-gradient(circle at 20px 20px,#b8dcff 5px,transparent 6px) 0 0/44px 44px,#eaf6ff' },
  { id: 'pared-flores', nombre: 'Florecitas', precio: 80, fondo: 'radial-gradient(circle at 50% 50%,#ffd76a 3px,transparent 4px) 0 0/36px 36px,radial-gradient(circle at 30% 30%,#ffffff 6px,transparent 7px) 0 0/36px 36px,#ffe9f2' },
  { id: 'pared-ladrillo', nombre: 'Ladrillitos', precio: 60, fondo: 'linear-gradient(#f7d6c4 2px,transparent 2px) 0 0/100% 22px,linear-gradient(90deg,#f7d6c4 2px,transparent 2px) 0 0/44px 22px,#fbe4d6' },
  { id: 'pared-estrellas', nombre: 'Cielo estrellado', precio: 120, fondo: 'radial-gradient(circle,#ffffff 1px,transparent 2px) 0 0/30px 30px,linear-gradient(#5b4b9e,#8c7ad6)' },
  { id: 'pared-dorada', nombre: 'Dorado glam', precio: 150, amor: 4, fondo: 'linear-gradient(135deg,#fff3c4,#ffd98a 50%,#fff3c4)' },
]

export const PISOS: Superficie[] = [
  { id: 'piso-madera', nombre: 'Madera clarita', precio: 0, fondo: 'repeating-linear-gradient(90deg,#f3d1ae 0 60px,#e9c096 60px 62px)' },
  { id: 'piso-madera-oscura', nombre: 'Madera oscura', precio: 60, fondo: 'repeating-linear-gradient(90deg,#d9a77a 0 60px,#c98f62 60px 62px)' },
  { id: 'piso-alfombra', nombre: 'Alfombra rosita', precio: 40, fondo: 'repeating-linear-gradient(0deg,#ffd0e0 0 10px,#ffc2d6 10px 12px)' },
  { id: 'piso-azulejo', nombre: 'Azulejos', precio: 50, fondo: 'repeating-conic-gradient(#ffffff 0 25%,#cfe9ff 0 50%) 0 0/36px 36px' },
  { id: 'piso-pasto', nombre: 'Pastito', precio: 70, fondo: 'repeating-linear-gradient(90deg,#b7e8a8 0 14px,#a4df93 14px 16px),#c4efb0' },
  { id: 'piso-arena', nombre: 'Arenita', precio: 80, fondo: '#f7e2b8' },
  { id: 'piso-marmol', nombre: 'Mármol rosa', precio: 120, fondo: 'linear-gradient(135deg,#ffffff 0 25%,#ffe1ec 25% 50%,#ffffff 50% 75%,#ffe1ec 75%) 0 0/60px 60px' },
  { id: 'piso-cuadros-menta', nombre: 'Cuadritos menta', precio: 90, fondo: 'repeating-conic-gradient(#d3f5e7 0 25%,#ffffff 0 50%) 0 0/48px 48px' },
  { id: 'piso-galaxia', nombre: 'Piso galáctico', precio: 150, amor: 3, fondo: 'radial-gradient(#ffffff 1px,transparent 2px) 0 0/22px 22px,linear-gradient(#6d5bb8,#3f3480)' },
]

// ---------- búsquedas ----------

const MUEBLES_POR_ID = new Map(MUEBLES.map((m) => [m.id, m] as const))
const PAREDES_POR_ID = new Map(PAREDES.map((s) => [s.id, s] as const))
const PISOS_POR_ID = new Map(PISOS.map((s) => [s.id, s] as const))

export function buscarMueble(id: string): Mueble | undefined {
  return MUEBLES_POR_ID.get(id)
}

export function buscarPared(id: string): Superficie {
  return PAREDES_POR_ID.get(id) ?? PAREDES[0]
}

export function buscarPiso(id: string): Superficie {
  return PISOS_POR_ID.get(id) ?? PISOS[0]
}
