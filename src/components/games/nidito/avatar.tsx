'use client'

import { useId, type ReactNode } from 'react'
import type { Look } from './types'
import {
  buscarOjos,
  buscarPeinado,
  buscarPrenda,
  PRENDAS_BASE,
  type EstiloPeinado,
  type FormaOjos,
  type Patron,
  type Prenda,
} from './wardrobe-data'

export type AnimAvatar = 'idle' | 'feliz' | 'abrazo' | 'beso' | 'dormido' | 'saludo'

// Lienzo chibi: cabeza grande (~47% del alto total), cuerpo corto con cintura,
// brazos redondeados con codo suave y piernas cortas con botitas.
const W = 200
const H = 236
const INK = '#5B3A4B' // contorno ciruela suave, más amable que el negro
const BLANCO = '#FFFFFF'
const ROSA = '#FF7AA2'
const LINEA = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

// Cabeza y cara: el centro de la cara, los ojos y la boca comparten estas medidas.
const CABEZA = { cx: 100, cy: 82, rx: 58, ry: 50 }
const OJO_Y = 96
const PIE_Y = 222
const CUELLO_Y = 146

const CORAZON = 'M0 6 C-12 -2 -8 -14 0 -6 C8 -14 12 -2 0 6 Z'
const CORAZON_OJO = 'M0 10 C-18 -2 -12 -20 0 -9 C12 -20 18 -2 0 10 Z'

function estrella(R: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    pts.push(`${(rad * Math.cos(ang)).toFixed(2)} ${(rad * Math.sin(ang)).toFixed(2)}`)
  }
  return `M${pts.join(' L')} Z`
}
const ESTRELLA_OJO = estrella(15, 7)
const ESTRELLA_PEQ = estrella(6, 2.6)

const HEX = /^#[0-9a-f]{6}$/i
function hex(c: string | undefined, fallback: string): string {
  return c && HEX.test(c) ? c : fallback
}
function mezcla(a: string, b: string, t: number): string {
  const canales = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const A = canales(a)
  const B = canales(b)
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}
const aclara = (c: string, t: number) => mezcla(c, '#FFFFFF', t)
const oscurece = (c: string, t: number) => mezcla(c, '#2B1B26', t)

const CSS = `
.nd-svg .nd-respira{transform-box:fill-box;transform-origin:50% 100%;animation:nd-respira 3.6s ease-in-out infinite}
.nd-svg .nd-respira-lento{transform-box:fill-box;transform-origin:50% 100%;animation:nd-respira-lento 5s ease-in-out infinite}
.nd-svg .nd-salta{transform-box:fill-box;transform-origin:50% 100%;animation:nd-salta .85s cubic-bezier(.3,.7,.4,1) infinite}
.nd-svg .nd-meneo{transform-box:fill-box;transform-origin:50% 100%;animation:nd-meneo 2.6s ease-in-out infinite}
.nd-svg .nd-cab-idle{animation:nd-cab-idle 3.6s ease-in-out infinite}
.nd-svg .nd-cab-beso{animation:nd-cab-beso 2.4s ease-in-out infinite}
.nd-svg .nd-cab-dormido{animation:nd-cab-dormido 5s ease-in-out infinite}
.nd-svg .nd-ojos{transform-box:fill-box;transform-origin:50% 50%;animation:nd-parpadeo 4.2s infinite}
.nd-svg .nd-brazo-izq{animation:nd-brazo-izq 2.6s ease-in-out infinite}
.nd-svg .nd-brazo-der{animation:nd-brazo-der 2.6s ease-in-out infinite}
.nd-svg .nd-saluda{animation:nd-saluda 1.1s ease-in-out infinite}
.nd-svg .nd-brillo{transform-box:fill-box;transform-origin:50% 50%;animation:nd-brillo 1.8s ease-in-out infinite}
.nd-svg .nd-flota{transform-box:fill-box;transform-origin:50% 50%;animation:nd-flota 2.4s ease-out infinite}
.nd-svg .nd-pop{transform-box:fill-box;transform-origin:50% 50%;animation:nd-pop 2.2s ease-out infinite}
.nd-svg .nd-zzz{transform-box:fill-box;transform-origin:50% 50%;animation:nd-zzz 2.7s ease-in infinite}
.nd-svg .nd-onda{animation:nd-onda 1.1s ease-in-out infinite}
@keyframes nd-respira{0%,100%{transform:scale(1,1)}50%{transform:scale(1.02,1.035)}}
@keyframes nd-respira-lento{0%,100%{transform:scale(1,1)}50%{transform:scale(1.025,1.045)}}
@keyframes nd-parpadeo{0%,43%,47%,100%{transform:scaleY(1)}45%{transform:scaleY(.08)}}
@keyframes nd-salta{0%,100%{transform:translateY(0) scale(1,1)}12%{transform:translateY(0) scale(1.06,.92)}50%{transform:translateY(-14px) scale(.97,1.05)}80%{transform:translateY(0) scale(1.03,.97)}}
@keyframes nd-meneo{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes nd-cab-idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
@keyframes nd-cab-beso{0%,100%{transform:rotate(0deg)}50%{transform:rotate(8deg)}}
@keyframes nd-cab-dormido{0%,100%{transform:rotate(9deg)}50%{transform:rotate(12deg)}}
@keyframes nd-brazo-izq{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-36deg)}}
@keyframes nd-brazo-der{0%,100%{transform:rotate(0deg)}50%{transform:rotate(36deg)}}
@keyframes nd-saluda{0%,100%{transform:rotate(-125deg)}50%{transform:rotate(-152deg)}}
@keyframes nd-brillo{0%,100%{transform:scale(.2) rotate(0deg);opacity:.4}50%{transform:scale(1) rotate(45deg);opacity:1}}
@keyframes nd-flota{0%{transform:translateY(8px) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-46px) scale(1.1);opacity:0}}
@keyframes nd-pop{0%{transform:scale(0);opacity:0}25%{transform:scale(1.2);opacity:1}60%,100%{transform:scale(1);opacity:0}}
@keyframes nd-zzz{0%{transform:translate(0,0);opacity:0}25%{opacity:1}100%{transform:translate(12px,-34px);opacity:0}}
@keyframes nd-onda{0%,100%{opacity:.15}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){.nd-svg *{animation:none!important}}
`

/** Definición de estampado (lunares, rayas, cuadros, corazones, estrellas) para prendas. */
function DefPatron({ id, tipo, base, acento }: { id: string; tipo: Patron; base: string; acento: string }) {
  const s = tipo === 'cuadros' ? 18 : tipo === 'corazones' || tipo === 'estrellas' ? 22 : tipo === 'rayas' ? 14 : 16
  let figura: ReactNode = null
  switch (tipo) {
    case 'lunares':
      figura = <circle cx={s / 2} cy={s / 2} r={2.8} fill={acento} />
      break
    case 'rayas':
      figura = <rect x={0} y={0} width={s} height={s / 2} fill={acento} />
      break
    case 'cuadros':
      figura = (
        <>
          <rect x={0} y={0} width={s / 2} height={s / 2} fill={acento} opacity={0.5} />
          <rect x={s / 2} y={s / 2} width={s / 2} height={s / 2} fill={acento} opacity={0.5} />
        </>
      )
      break
    case 'corazones':
      figura = <path d={CORAZON} transform={`translate(${s / 2} ${s / 2 + 1}) scale(.55)`} fill={acento} />
      break
    case 'estrellas':
      figura = <path d={ESTRELLA_PEQ} transform={`translate(${s / 2} ${s / 2})`} fill={acento} />
      break
  }
  return (
    <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse">
      <rect width={s} height={s} fill={base} />
      {figura}
    </pattern>
  )
}

/* ---------- Peinados ----------
 * Cada peinado tiene un "frente" (flequillo con puntas, raya, brillo y mechones junto a
 * la cara) y un "atrás" (melena, colas, rizos) que se dibuja detrás del cuerpo.
 */

/** Cabello sobre la cabeza con flequillo de 3 puntas y contorno de volumen. */
const CAPA = 'M42 88 C28 36 62 10 100 12 C142 10 176 36 158 88 Q150 66 136 68 Q130 78 118 70 Q110 62 100 66 Q90 74 82 66 Q72 60 66 70 Q58 80 42 88 Z'
const CAPA_ANCHA = 'M38 96 C24 34 62 8 100 10 C144 8 178 34 162 96 Q150 66 136 68 Q130 78 118 70 Q110 62 100 66 Q90 74 82 66 Q72 60 66 70 Q58 80 38 96 Z'
const PIXIE = 'M40 90 L44 46 L58 58 L66 30 L84 46 L100 22 L116 46 L134 30 L142 58 L156 46 L160 90 C146 74 128 66 110 70 C100 64 88 64 80 70 C64 66 52 74 40 90 Z'

/** Cortes de chico: sin mechones largos a los lados. */
const CAPA_DESPEINADO_PUNTAS = [
  'M60 34 L44 24 L52 48 Z',
  'M74 22 L62 4 L88 14 Z',
  'M100 14 L96 -4 L110 12 Z',
  'M122 16 L138 2 L136 24 Z',
  'M140 30 L158 20 L150 42 Z',
]
const CAPA_RAYA = 'M44 88 C34 40 64 12 102 12 C140 12 168 40 156 88 Q146 62 124 60 Q104 58 96 66 Q84 60 66 66 Q52 72 44 88 Z'
const RIZOS_CORTOS: [number, number, number][] = [
  [46, 62, 11], [56, 40, 15], [84, 22, 16], [116, 22, 16], [144, 40, 15], [154, 62, 11], [100, 30, 14], [70, 50, 12], [130, 50, 12],
]

/** Melenas y colas que quedan detrás del cuerpo. */
const BOB_ATRAS = 'M46 70 C28 84 26 112 28 136 Q30 150 40 146 Q48 158 58 148 Q70 160 82 150 Q92 158 100 150 Q108 158 118 150 Q130 160 142 148 Q152 158 160 146 Q170 150 172 136 C174 112 172 84 154 70 Z'
const LARGO_ATRAS = 'M46 70 C26 86 22 124 24 162 C25 186 20 200 28 212 Q38 202 46 214 Q56 202 64 216 Q74 204 84 216 L116 216 Q126 204 136 216 Q146 202 154 214 Q162 202 172 212 C180 200 175 186 176 162 C178 124 174 86 154 70 Z'
const ONDAS_ATRAS = 'M46 70 C26 86 22 124 22 160 Q14 172 22 184 Q30 176 36 188 Q46 178 54 190 Q64 180 72 192 L128 192 Q136 180 146 190 Q154 178 162 188 Q170 176 178 184 Q186 172 178 160 C178 124 174 86 154 70 Z'
const TRENZA_ATRAS = 'M46 70 C30 86 28 118 30 146 C32 164 40 174 52 176 L148 176 C160 174 168 164 170 146 C172 118 170 86 154 70 Z'
const COLA_ATRAS = 'M150 40 C190 36 200 96 186 150 C182 176 172 192 162 200 C166 174 164 142 154 114 C148 96 146 64 150 40 Z'
const RIZOS_ATRAS: [number, number, number][] = [
  [46, 44, 16], [72, 26, 18], [100, 20, 19], [128, 26, 18], [154, 44, 16],
  [30, 80, 15], [170, 80, 15], [24, 116, 14], [176, 116, 14], [34, 142, 13], [166, 142, 13],
]

/** Mechón lateral que cae junto a la cara, por delante de la oreja. */
function Mechones({ pelo }: { pelo: string }) {
  return (
    <g>
      <path d="M42 82 C34 102 34 124 44 142 Q50 148 56 142 C62 124 64 104 62 86 Z" fill={pelo} {...LINEA} strokeWidth={1.8} />
      <path d="M158 82 C166 102 166 124 156 142 Q150 148 144 142 C138 124 136 104 138 86 Z" fill={pelo} {...LINEA} strokeWidth={1.8} />
    </g>
  )
}

/** Pelo de atrás: se mueve con la cabeza, queda detrás del cuerpo. */
function PeloAtras({ estilo, pelo, lazo, pelo2 }: { estilo: EstiloPeinado; pelo: string; lazo: string; pelo2: string }) {
  switch (estilo) {
    case 'bob':
      return <path d={BOB_ATRAS} fill={pelo} {...LINEA} />
    case 'largo':
      return <path d={LARGO_ATRAS} fill={pelo} {...LINEA} />
    case 'trenza':
      return <path d={TRENZA_ATRAS} fill={pelo} {...LINEA} />
    case 'ondas':
      return (
        <g>
          <path d={ONDAS_ATRAS} fill={pelo} {...LINEA} />
          <path d="M34 128 Q40 134 34 142 M166 128 Q160 134 166 142" fill="none" stroke={pelo2} strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
        </g>
      )
    case 'cola':
      return (
        <g>
          <path d={COLA_ATRAS} fill={pelo} {...LINEA} />
          <path d="M170 110 Q176 140 168 170" fill="none" stroke={pelo2} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
          <circle cx={152} cy={46} r={7} fill={lazo} stroke={INK} strokeWidth={1.8} />
        </g>
      )
    case 'coletas':
      return (
        <g>
          <ellipse cx={24} cy={104} rx={16} ry={34} fill={pelo} {...LINEA} />
          <ellipse cx={176} cy={104} rx={16} ry={34} fill={pelo} {...LINEA} />
          <circle cx={26} cy={70} r={6.5} fill={lazo} stroke={INK} strokeWidth={1.8} />
          <circle cx={174} cy={70} r={6.5} fill={lazo} stroke={INK} strokeWidth={1.8} />
        </g>
      )
    case 'rizos':
      return (
        <g>
          {RIZOS_ATRAS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={pelo} {...LINEA} />
          ))}
        </g>
      )
    default:
      return null
  }
}

/** Trenza que cae por delante del hombro derecho. */
function Trenza({ pelo, lazo }: { pelo: string; lazo: string }) {
  const puntos: [number, number][] = [
    [150, 100], [150, 114], [147, 128], [144, 142], [142, 156], [141, 170], [140, 184], [140, 198],
  ]
  return (
    <g>
      {puntos.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={7} fill={i % 2 ? pelo : aclara(pelo, 0.12)} {...LINEA} strokeWidth={1.8} />
      ))}
      <rect x={134} y={204} width={12} height={8} rx={3} fill={lazo} stroke={INK} strokeWidth={1.8} />
    </g>
  )
}

/** Pelo de delante: cabello, flequillo, raya, brillo y mechones. */
function PeloDelante({ estilo, pelo, pelo2, sombraPelo }: { estilo: EstiloPeinado; pelo: string; pelo2: string; sombraPelo: string }) {
  const brillo = <path d="M60 56 Q74 36 106 30" fill="none" stroke={pelo2} strokeWidth={5} strokeLinecap="round" opacity={0.8} />
  const raya = <path d="M100 18 Q93 36 98 60" fill="none" stroke={sombraPelo} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
  const volumen = <path d="M126 24 Q150 36 152 66" fill="none" stroke={sombraPelo} strokeWidth={3} strokeLinecap="round" opacity={0.3} />
  switch (estilo) {
    case 'chongo':
      return (
        <g>
          <circle cx={100} cy={16} r={20} fill={pelo} {...LINEA} />
          <path d="M88 8 Q100 0 112 8" fill="none" stroke={pelo2} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
          <path d={CAPA} fill={pelo} {...LINEA} />
          {brillo}
        </g>
      )
    case 'pixie':
      return (
        <g>
          <path d={PIXIE} fill={pelo} {...LINEA} />
          {brillo}
        </g>
      )
    case 'rizos':
      return (
        <g>
          <path d={CAPA} fill={pelo} {...LINEA} />
          {[[56, 46, 14], [100, 36, 15], [144, 46, 14]].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={pelo} {...LINEA} />
          ))}
          {brillo}
          <Mechones pelo={pelo} />
        </g>
      )
    case 'corto':
      return (
        <g>
          <path d={CAPA} fill={pelo} {...LINEA} />
          <path d="M42 84 L34 98 L46 94 Z M158 84 L166 98 L154 94 Z" fill={pelo} {...LINEA} strokeWidth={1.8} />
          {raya}
          {volumen}
          {brillo}
        </g>
      )
    case 'despeinado':
      return (
        <g>
          {CAPA_DESPEINADO_PUNTAS.map((d) => (
            <path key={d} d={d} fill={pelo} {...LINEA} strokeWidth={1.8} />
          ))}
          <path d={CAPA} fill={pelo} {...LINEA} />
          {volumen}
          {brillo}
        </g>
      )
    case 'raya':
      return (
        <g>
          <path d={CAPA_RAYA} fill={pelo} {...LINEA} />
          <path d="M100 14 Q92 34 96 58" fill="none" stroke={sombraPelo} strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
          {volumen}
          {brillo}
        </g>
      )
    case 'rizado':
      return (
        <g>
          <path d={CAPA} fill={pelo} {...LINEA} />
          {RIZOS_CORTOS.map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={pelo} {...LINEA} strokeWidth={1.8} />
          ))}
          {brillo}
        </g>
      )
    case 'bob':
      return (
        <g>
          <path d={CAPA_ANCHA} fill={pelo} {...LINEA} />
          {raya}
          {volumen}
          {brillo}
          <Mechones pelo={pelo} />
        </g>
      )
    default:
      return (
        <g>
          <path d={CAPA} fill={pelo} {...LINEA} />
          {raya}
          {volumen}
          {brillo}
          <Mechones pelo={pelo} />
        </g>
      )
  }
}

/* ---------- Ojos ---------- */

function OjoLocal({ forma, color, suave }: { forma: FormaOjos; color: string; suave: boolean }) {
  switch (forma) {
    case 'almendra':
      return (
        <>
          <path d="M-14 0 Q0 -28 14 0 Q0 26 -14 0 Z" fill={color} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <circle cx={4} cy={-5} r={4} fill={BLANCO} />
          <circle cx={-4} cy={3} r={1.9} fill={BLANCO} opacity={0.9} />
          <path d="M-15 -2 Q0 -26 15 -2" fill="none" stroke={INK} strokeWidth={suave ? 1.6 : 3} strokeLinecap="round" />
        </>
      )
    case 'felinos':
      return (
        <>
          <path d="M-14 -2 Q0 -26 14 -4 Q0 22 -14 -2 Z" fill={color} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          {suave ? null : <path d="M12 -8 L24 -15 L20 2 Z" fill={INK} />}
          <circle cx={3} cy={-4} r={3.8} fill={BLANCO} />
          <circle cx={-4} cy={3} r={1.8} fill={BLANCO} opacity={0.9} />
          <path d="M-15 -3 Q0 -28 22 -16" fill="none" stroke={INK} strokeWidth={suave ? 1.6 : 3.2} strokeLinecap="round" />
        </>
      )
    case 'corazon':
      return (
        <>
          <path d={CORAZON_OJO} fill={color} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <circle cx={5} cy={-6} r={3.6} fill={BLANCO} />
          <circle cx={-5} cy={3} r={1.8} fill={BLANCO} opacity={0.9} />
          <path d="M-14 -4 Q0 -21 14 -4" fill="none" stroke={INK} strokeWidth={suave ? 1.6 : 3} strokeLinecap="round" />
        </>
      )
    case 'estrella':
      return (
        <>
          <path d={ESTRELLA_OJO} fill={color} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <circle cx={4} cy={-4} r={3.2} fill={BLANCO} />
          <path d="M-14 -5 Q0 -21 14 -5" fill="none" stroke={INK} strokeWidth={suave ? 1.6 : 3} strokeLinecap="round" />
        </>
      )
    default:
      return (
        <>
          <ellipse rx={13} ry={15} fill={color} stroke={INK} strokeWidth={2} />
          <ellipse cy={5} rx={9} ry={8} fill={oscurece(color, 0.25)} opacity={0.45} />
          <circle cx={4.5} cy={-5} r={4.6} fill={BLANCO} />
          <circle cx={-4.5} cy={6} r={2.2} fill={BLANCO} opacity={0.9} />
          <path d="M-14 -4 Q0 -21 14 -4" fill="none" stroke={INK} strokeWidth={suave ? 1.6 : 3} strokeLinecap="round" />
        </>
      )
  }
}

const OJO_IZQ_X = 74
const OJO_DER_X = 126

function Ojos({ forma, color, modo, suave }: { forma: FormaOjos; color: string; modo: 'abierto' | 'feliz' | 'dormido'; suave: boolean }) {
  if (modo === 'abierto') {
    // El izquierdo va espejado para que la pestaña felina apunte hacia afuera.
    return (
      <g>
        <g transform={`translate(${OJO_IZQ_X} ${OJO_Y}) scale(-1.05 1.05)`}>
          <OjoLocal forma={forma} color={color} suave={suave} />
        </g>
        <g transform={`translate(${OJO_DER_X} ${OJO_Y}) scale(1.05)`}>
          <OjoLocal forma={forma} color={color} suave={suave} />
        </g>
        {suave ? (
          <g fill="none" stroke={INK} strokeWidth={3.6} strokeLinecap="round">
            <path transform={`translate(${OJO_IZQ_X} ${OJO_Y - 22})`} d="M-12 1 Q0 -5 12 1" />
            <path transform={`translate(${OJO_DER_X} ${OJO_Y - 22})`} d="M-12 1 Q0 -5 12 1" />
          </g>
        ) : null}
      </g>
    )
  }
  const d = modo === 'feliz' ? 'M-13 4 Q0 -12 13 4' : 'M-12 -1 Q0 6 12 -1'
  return (
    <g fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round">
      <path transform={`translate(${OJO_IZQ_X} ${OJO_Y})`} d={d} />
      <path transform={`translate(${OJO_DER_X} ${OJO_Y})`} d={d} />
    </g>
  )
}

/* ---------- Ropa ----------
 * Cuerpo de frijolito: una gomita redonda, ancha abajo y sin cintura. La cabeza va pegada
 * arriba (sin cuello). Las prendas se dibujan sobre esa misma forma.
 */

/** Cuerpo (y playera/blusa): la gomita de arriba. */
const TORSO = 'M54 176 C54 150 66 126 100 126 C134 126 146 150 146 176 C146 190 142 200 132 204 Q100 210 68 204 C58 200 54 190 54 176 Z'
const VESTIDO = 'M54 176 C54 150 66 126 100 126 C134 126 146 150 146 176 C150 194 156 210 164 228 Q100 242 36 228 C44 210 50 194 54 176 Z'
const OVEROL = 'M54 176 C54 150 66 126 100 126 C134 126 146 150 146 176 C146 194 142 210 132 216 Q100 222 68 216 C58 210 54 194 54 176 Z'
const FALDA = 'M58 198 L142 198 Q150 212 156 226 Q100 236 44 226 Q50 212 58 198 Z'
const SHORT = 'M60 196 L140 196 Q146 206 144 216 L104 216 L100 206 L96 216 L56 216 Q54 206 60 196 Z'
const PANTALON = 'M60 196 L140 196 L142 222 L104 222 L100 208 L96 222 L58 222 Z'
const TUL_1 = 'M58 196 L142 196 Q152 212 158 228 Q100 238 42 228 Q48 212 58 196 Z'
const TUL_2 = 'M48 216 Q100 228 152 216 L154 228 Q100 240 46 228 Z'

/** Brazo: una bolita pegada al costado (como un muñeco de peluche). Manga corta: una capucha de color. */
function Brazo({ s, piel, p, rel, clase }: { s: -1 | 1; piel: string; p: Prenda; rel: string; clase?: string }) {
  const sx = 100 + s * 46
  const sy = 170
  const larga = p.manga === 'larga'
  return (
    <g className={clase} style={{ transformOrigin: `${sx}px ${sy}px`, transformBox: 'view-box' }}>
      {larga ? (
        <ellipse cx={sx + s * 4} cy={184} rx={12} ry={15} fill={rel} {...LINEA} strokeWidth={2} />
      ) : (
        <ellipse cx={100 + s * 54} cy={190} rx={10.5} ry={13} fill={piel} {...LINEA} strokeWidth={2} />
      )}
      {!larga ? <ellipse cx={sx + s * 4} cy={sy} rx={13} ry={10} fill={rel} {...LINEA} strokeWidth={1.8} /> : null}
      {larga ? <circle cx={100 + s * 50} cy={200} r={8} fill={piel} {...LINEA} strokeWidth={2} /> : null}
      <ellipse cx={100 + s * 52} cy={sy + 4} rx={2.6} ry={3} fill="#FFFFFF" opacity={0.45} />
    </g>
  )
}

function ArribaDibujo({ p, rel }: { p: Prenda; rel: string }) {
  const brillo = <path d="M80 170 Q82 184 86 192" fill="none" stroke={BLANCO} strokeWidth={4} opacity={0.25} strokeLinecap="round" />
  const cuello = <path d="M86 149 Q100 162 114 149" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
  switch (p.estilo) {
    case 'vestido':
      return (
        <g>
          <path d={VESTIDO} fill={rel} {...LINEA} />
          {cuello}
          <path d="M70 186 Q100 193 130 186" fill="none" stroke={p.acento} strokeWidth={3} strokeLinecap="round" />
          <path d="M88 198 L84 224 M100 198 L100 228 M112 198 L116 224" stroke={p.acento} strokeWidth={1.6} opacity={0.5} />
          <path d="M92 188 L100 192 L92 196 Z M108 188 L100 192 L108 196 Z" fill={p.acento} stroke={INK} strokeWidth={1.2} />
        </g>
      )
    case 'overol':
      return (
        <g>
          <path d={OVEROL} fill={rel} {...LINEA} />
          <path d="M86 150 L84 170 M114 150 L116 170" stroke={p.acento} strokeWidth={4} strokeLinecap="round" />
          <rect x={84} y={172} width={32} height={26} rx={6} fill={p.acento} stroke={INK} strokeWidth={1.8} />
          <rect x={90} y={178} width={20} height={9} rx={3} fill={p.color} stroke={INK} strokeWidth={1.2} />
          <circle cx={88} cy={196} r={1.9} fill={INK} opacity={0.6} />
          <circle cx={112} cy={196} r={1.9} fill={INK} opacity={0.6} />
          {brillo}
        </g>
      )
    case 'blusa':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          {cuello}
          <path d="M90 156 L100 163 L90 170 Z M110 156 L100 163 L110 170 Z" fill={p.acento} stroke={INK} strokeWidth={1.4} />
          <circle cx={100} cy={163} r={2.4} fill={p.acento} />
          <circle cx={100} cy={180} r={1.8} fill={p.acento} />
          <circle cx={100} cy={192} r={1.8} fill={p.acento} />
          <path d="M80 182 L80 200 M120 182 L120 200" stroke={p.acento} strokeWidth={1.4} opacity={0.5} />
          {brillo}
        </g>
      )
    case 'sudadera':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <path d="M84 146 Q100 136 116 146 Q116 154 100 156 Q84 154 84 146 Z" fill={p.acento} opacity={0.5} stroke={INK} strokeWidth={1.5} />
          <path d="M96 156 L95 170 M104 156 L105 170" stroke={p.acento} strokeWidth={2.4} strokeLinecap="round" />
          <path d="M80 180 Q100 188 120 180 L124 200 L76 200 Z" fill={p.acento} opacity={0.4} stroke={INK} strokeWidth={1.5} />
          <path d="M76 200 Q100 206 124 200" fill="none" stroke={p.acento} strokeWidth={3} opacity={0.7} />
          {brillo}
        </g>
      )
    case 'suter':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <path d="M84 146 Q100 160 116 146" fill="none" stroke={p.acento} strokeWidth={4} strokeLinecap="round" />
          <path d="M72 174 L128 174 M70 186 L130 186 M72 198 L128 198" stroke={p.acento} strokeWidth={2.2} opacity={0.6} />
          {brillo}
        </g>
      )
    case 'hoodie':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <path d="M84 146 Q100 136 116 146 Q116 156 100 158 Q84 156 84 146 Z" fill={p.acento} opacity={0.4} stroke={INK} strokeWidth={1.5} />
          <path d="M96 158 L94 172 M104 158 L106 172" stroke={p.acento} strokeWidth={2.4} strokeLinecap="round" />
          <path d="M82 182 Q100 190 118 182 L122 202 L78 202 Z" fill={p.acento} opacity={0.4} stroke={INK} strokeWidth={1.5} />
          <path d="M100 158 L100 204" stroke={p.acento} strokeWidth={1.4} strokeDasharray="3 3" opacity={0.7} />
          {brillo}
        </g>
      )
    case 'camisa':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <path d="M86 150 L98 164 L100 152 M114 150 L102 164 L100 152" fill="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M100 164 L100 204" stroke={INK} strokeWidth={1} opacity={0.5} />
          <circle cx={100} cy={174} r={1.8} fill={p.acento} />
          <circle cx={100} cy={186} r={1.8} fill={p.acento} />
          <circle cx={100} cy={198} r={1.8} fill={p.acento} />
          <rect x={80} y={166} width={12} height={10} rx={2} fill="none" stroke={INK} strokeWidth={1.2} opacity={0.6} />
          {brillo}
        </g>
      )
    default:
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          {cuello}
          <rect x={108} y={170} width={12} height={10} rx={2} fill="none" stroke={INK} strokeWidth={1.4} opacity={0.6} />
          <path d="M76 200 Q100 206 124 200" fill="none" stroke={p.acento} strokeWidth={2} opacity={0.5} />
          {brillo}
        </g>
      )
  }
}

function AbajoDibujo({ p, rel }: { p: Prenda; rel: string }) {
  switch (p.estilo) {
    case 'falda':
      return (
        <g>
          <path d={FALDA} fill={rel} {...LINEA} />
          <path d="M84 196 L80 224 M100 196 L100 228 M116 196 L120 224" stroke={p.acento} strokeWidth={1.6} opacity={0.6} />
          <path d="M70 200 Q100 206 130 200" fill="none" stroke={p.acento} strokeWidth={2} opacity={0.7} />
        </g>
      )
    case 'short':
      return (
        <g>
          <path d={SHORT} fill={rel} {...LINEA} />
          <path d="M80 200 L80 210 M120 200 L120 210" stroke={p.acento} strokeWidth={1.4} opacity={0.6} />
        </g>
      )
    case 'tul':
      return (
        <g>
          <path d={TUL_1} fill={rel} {...LINEA} />
          <path d={TUL_2} fill={p.acento} {...LINEA} />
        </g>
      )
    default:
      return (
        <g>
          <path d={PANTALON} fill={rel} {...LINEA} />
          <path d="M80 196 L80 214 M120 196 L120 214" stroke={p.acento} strokeWidth={1.4} opacity={0.5} />
        </g>
      )
  }
}

/** Zapato o botita de una pierna. `cx` es el centro de la pierna. */
function Zapato({ p, cx }: { p: Prenda; cx: number }) {
  const cy = PIE_Y
  const c = p.color
  const a = p.acento
  switch (p.estilo) {
    case 'botitas':
      return (
        <g>
          <rect x={cx - 13} y={cy - 14} width={26} height={20} rx={9} fill={c} {...LINEA} />
          <ellipse cx={cx + 1} cy={cy + 4} rx={14} ry={7} fill={c} {...LINEA} />
          <path d={`M${cx - 13} ${cy - 5} L${cx + 13} ${cy - 5}`} stroke={a} strokeWidth={2.2} />
        </g>
      )
    case 'tenis':
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={14} ry={8} fill={c} {...LINEA} />
          <ellipse cx={cx} cy={cy + 5} rx={14.5} ry={3} fill={a} stroke={INK} strokeWidth={1.4} />
          <path d={`M${cx - 5} ${cy - 3} L${cx + 3} ${cy - 3}`} stroke={a} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )
    case 'mary':
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={13.5} ry={7.5} fill={c} {...LINEA} />
          <rect x={cx - 8} y={cy - 8} width={16} height={4} rx={2} fill={a} stroke={INK} strokeWidth={1.4} />
          <circle cx={cx} cy={cy - 6} r={1.5} fill={INK} />
        </g>
      )
    case 'sandalias':
      return (
        <g>
          <ellipse cx={cx} cy={cy - 2} rx={12} ry={6.5} fill={c} {...LINEA} />
          <path d={`M${cx - 10} ${cy + 1} Q${cx} ${cy - 9} ${cx + 10} ${cy + 1}`} fill="none" stroke={a} strokeWidth={2.6} strokeLinecap="round" />
          <ellipse cx={cx} cy={cy + 5} rx={14} ry={3.5} fill={a} stroke={INK} strokeWidth={1.4} />
        </g>
      )
    case 'botas':
      return (
        <g>
          <rect x={cx - 13} y={cy - 22} width={26} height={30} rx={9} fill={c} {...LINEA} />
          <ellipse cx={cx + 1} cy={cy + 4} rx={14} ry={5} fill={a} {...LINEA} />
          <path d={`M${cx - 13} ${cy - 13} L${cx + 13} ${cy - 13}`} stroke={a} strokeWidth={2} />
        </g>
      )
    case 'pantuflas':
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={15} ry={9} fill={c} {...LINEA} />
          <circle cx={cx - 8} cy={cy - 7} r={4} fill={c} {...LINEA} />
          <circle cx={cx + 8} cy={cy - 7} r={4} fill={c} {...LINEA} />
          <ellipse cx={cx} cy={cy + 3} rx={8} ry={3.5} fill={a} opacity={0.6} />
        </g>
      )
    default:
      return <ellipse cx={cx} cy={cy} rx={14} ry={8} fill={c} {...LINEA} />
  }
}

/** Accesorios de cabeza y cuello. Coordenadas en el lienzo de 200 x 236. */
function Accesorio({ p, rel }: { p: Prenda; rel: string }) {
  const a = p.acento
  const c = p.color
  switch (p.estilo) {
    case 'moño':
      return (
        <g>
          <path d="M132 30 L148 38 L132 46 Z M168 30 L152 38 L168 46 Z" fill={c} {...LINEA} strokeWidth={1.8} />
          <circle cx={150} cy={38} r={4.6} fill={a} {...LINEA} strokeWidth={1.8} />
        </g>
      )
    case 'diadema':
      return (
        <g>
          <path d="M44 84 Q100 2 156 84" fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
          <path d="M44 84 Q100 2 156 84" fill="none" stroke={c} strokeWidth={5} strokeLinecap="round" />
          <path d={ESTRELLA_PEQ} transform="translate(100 38) scale(1.5)" fill={a} stroke={INK} strokeWidth={0.9} />
          <circle cx={68} cy={60} r={2.4} fill={a} />
          <circle cx={132} cy={60} r={2.4} fill={a} />
        </g>
      )
    case 'lentes':
      return (
        <g fill="none" stroke={c} strokeWidth={3.2}>
          <circle cx={OJO_IZQ_X} cy={OJO_Y} r={19} fill="#FFFFFF" fillOpacity={0.22} />
          <circle cx={OJO_DER_X} cy={OJO_Y} r={19} fill="#FFFFFF" fillOpacity={0.22} />
          <path d={`M93 ${OJO_Y - 2} Q100 ${OJO_Y - 6} 107 ${OJO_Y - 2} M55 ${OJO_Y - 4} L42 ${OJO_Y - 8} M145 ${OJO_Y - 4} L158 ${OJO_Y - 8}`} strokeLinecap="round" />
        </g>
      )
    case 'collar':
      return (
        <g>
          {[
            [84, 150], [92, 156], [100, 158], [108, 156], [116, 150],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={3.6} fill={c} stroke={a} strokeWidth={1.4} />
          ))}
        </g>
      )
    case 'gorro':
      return (
        <g>
          <path d="M40 84 C34 26 166 26 160 84 Q148 72 100 72 Q52 72 40 84 Z" fill={c} {...LINEA} />
          <path d="M40 76 Q100 64 160 76 L160 90 Q100 78 40 90 Z" fill={a} {...LINEA} strokeWidth={1.8} />
          <circle cx={100} cy={22} r={11} fill={a} {...LINEA} strokeWidth={1.8} />
        </g>
      )
    case 'bufanda':
      return (
        <g>
          <rect x={80} y={146} width={40} height={14} rx={7} fill={rel} {...LINEA} />
          <rect x={106} y={154} width={13} height={34} rx={5} fill={rel} {...LINEA} />
        </g>
      )
    case 'flor':
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => {
            const ang = (i * 2 * Math.PI) / 5 - Math.PI / 2
            return (
              <circle key={i} cx={58 + 7 * Math.cos(ang)} cy={62 + 7 * Math.sin(ang)} r={5.6} fill={c} {...LINEA} strokeWidth={1.6} />
            )
          })}
          <circle cx={58} cy={62} r={4} fill={a} />
        </g>
      )
    case 'audifonos':
      return (
        <g>
          <path d="M40 92 Q100 -6 160 92" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <path d="M40 92 Q100 -6 160 92" fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" />
          <ellipse cx={40} cy={100} rx={12} ry={16} fill={c} {...LINEA} />
          <ellipse cx={160} cy={100} rx={12} ry={16} fill={c} {...LINEA} />
          <ellipse cx={40} cy={100} rx={5.5} ry={8.5} fill={a} />
          <ellipse cx={160} cy={100} rx={5.5} ry={8.5} fill={a} />
        </g>
      )
    case 'orejas':
      return (
        <g>
          <path d="M46 62 L52 12 L84 40 Z" fill={c} {...LINEA} />
          <path d="M154 62 L148 12 L116 40 Z" fill={c} {...LINEA} />
          <path d="M56 52 L58 24 L76 40 Z" fill={a} />
          <path d="M144 52 L142 24 L124 40 Z" fill={a} />
        </g>
      )
    case 'corona':
      return (
        <g>
          <path d="M68 40 L68 16 L84 28 L100 8 L116 28 L132 16 L132 40 Z" fill={c} {...LINEA} />
          <circle cx={100} cy={26} r={3.6} fill={a} stroke={INK} strokeWidth={1.2} />
          <circle cx={80} cy={30} r={2.4} fill={a} />
          <circle cx={120} cy={30} r={2.4} fill={a} />
        </g>
      )
    case 'sombrero':
      return (
        <g>
          <path d="M56 60 C56 18 144 18 144 60 Z" fill={c} {...LINEA} />
          <path d="M56 50 L144 50 L144 60 L56 60 Z" fill={a} />
          <ellipse cx={100} cy={60} rx={82} ry={11} fill={c} {...LINEA} />
        </g>
      )
    default:
      return null
  }
}

/* ---------- Avatar ---------- */

export function Avatar({
  look,
  size = 160,
  anim = 'idle',
}: {
  look: Look
  size?: number
  anim?: AnimAvatar
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '') || 'nd'
  const piel = hex(look.piel, '#FFD2B3')
  const pelo = hex(look.colorPelo, '#6B4A3A')
  const colorOjos = hex(look.colorOjos, '#6B4226')
  const peinado = buscarPeinado(look.pelo)
  const ojos = buscarOjos(look.ojos)
  const pelo2 = aclara(pelo, 0.35)
  const sombraPelo = oscurece(pelo, 0.12)
  const chico = look.genero === 'chico'

  const dormido = anim === 'dormido'
  const pijama = dormido ? buscarPrenda(look.ropa.pijama) : undefined
  const arriba: Prenda = pijama
    ? { ...pijama, slot: 'arriba', estilo: 'playera', manga: 'larga', color: pijama.color, acento: pijama.acento }
    : (buscarPrenda(look.ropa.arriba) ?? PRENDAS_BASE.arriba)
  const abajo: Prenda | undefined = pijama
    ? { ...pijama, slot: 'abajo', estilo: 'pantalon', color: pijama.acento, acento: pijama.color }
    : buscarPrenda(look.ropa.abajo) ?? PRENDAS_BASE.abajo
  const zapatos = buscarPrenda(look.ropa.zapatos) ?? PRENDAS_BASE.zapatos
  const accesorio = buscarPrenda(look.ropa.accesorio)
  const cubreCuerpo = arriba.cubre === 'cuerpo'

  const relArriba = arriba.patron ? `url(#${uid}-arr)` : arriba.color
  const relAbajo = abajo?.patron ? `url(#${uid}-aba)` : abajo?.color ?? ''
  const relAcc = accesorio?.patron ? `url(#${uid}-acc)` : accesorio?.color ?? ''

  const modoOjos: 'abierto' | 'feliz' | 'dormido' =
    dormido ? 'dormido' : anim === 'feliz' || anim === 'abrazo' || anim === 'beso' || ojos.forma === 'felices' ? 'feliz' : 'abierto'
  const parpadea = modoOjos === 'abierto' && (anim === 'idle' || anim === 'saludo')
  const brillo = anim === 'feliz'
  const rubor = look.rubor

  const claseFig = anim === 'feliz' ? 'nd-salta' : anim === 'abrazo' ? 'nd-meneo' : ''
  const claseCuerpo = dormido ? 'nd-respira-lento' : 'nd-respira'
  const claseCabeza = anim === 'beso' ? 'nd-cab-beso' : dormido ? 'nd-cab-dormido' : 'nd-cab-idle'
  const origenCabeza = { transformOrigin: `${CABEZA.cx}px ${CUELLO_Y}px`, transformBox: 'view-box' as const }

  const boca = (() => {
    switch (anim) {
      case 'feliz':
        return (
          <g>
            <path d="M88 110 Q100 108 112 110 Q110 124 100 124 Q90 124 88 110 Z" fill="#C2406A" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <ellipse cx={100} cy={120} rx={5.5} ry={3} fill={ROSA} />
          </g>
        )
      case 'abrazo':
        return <path d="M89 112 Q100 122 111 112" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      case 'beso':
        return <path d={CORAZON} transform="translate(100 118) scale(1.15)" fill="#FF5C8A" stroke={INK} strokeWidth={1.6} />
      case 'dormido':
        return <ellipse cx={102} cy={116} rx={3.4} ry={3.8} fill={INK} opacity={0.8} />
      case 'saludo':
        return <path d="M90 111 Q100 121 110 111" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      default:
        return <path d="M92 112 Q100 119 108 112" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
    }
  })()

  return (
    <svg
      className="nd-svg"
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={(size * H) / W}
      role="img"
      aria-label="Personaje"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <style>{CSS}</style>
      <defs>
        <radialGradient id={`${uid}-piel-${piel.slice(1)}`} cx="42%" cy="34%" r="70%">
          <stop offset="0" stopColor={aclara(piel, 0.22)} />
          <stop offset="1" stopColor={piel} />
        </radialGradient>
        {arriba.patron ? <DefPatron id={`${uid}-arr`} tipo={arriba.patron} base={arriba.color} acento={arriba.acento} /> : null}
        {abajo?.patron ? <DefPatron id={`${uid}-aba`} tipo={abajo.patron} base={abajo.color} acento={abajo.acento} /> : null}
        {accesorio?.patron ? (
          <DefPatron id={`${uid}-acc`} tipo={accesorio.patron} base={accesorio.color} acento={accesorio.acento} />
        ) : null}
      </defs>

      <ellipse cx={100} cy={231} rx={50} ry={4} fill={INK} opacity={0.14} />

      <g className={claseFig || undefined}>
        {/* Pelo de atrás: se mueve con la cabeza, queda detrás del cuerpo */}
        <g className={claseCabeza} style={origenCabeza}>
          <PeloAtras estilo={peinado.estilo} pelo={pelo} lazo={pelo2} pelo2={pelo2} />
        </g>

        {/* Cuerpo: respira suave. El chico tiene hombros un poco más anchos. */}
        <g transform={chico ? 'translate(100 0) scale(1.07 1) translate(-100 0)' : undefined}>
        <g className={claseCuerpo}>
          {/* Cuerpo de frijolito (sin piernas largas: los zapatos son los pies) */}
          <path d={TORSO} fill={piel} {...LINEA} />

          {/* Abajo */}
          {!cubreCuerpo && abajo ? <AbajoDibujo p={abajo} rel={relAbajo} /> : null}

          {/* Zapatos */}
          <Zapato p={zapatos} cx={88} />
          <Zapato p={zapatos} cx={112} />

          {/* Ropa de arriba sobre el cuerpo */}
          <ArribaDibujo p={arriba} rel={relArriba} />

          {/* Brazos: el derecho puede saludar, ambos pueden abrazar */}
          <Brazo
            s={-1}
            piel={piel}
            p={arriba}
            rel={relArriba}
            clase={anim === 'abrazo' ? 'nd-brazo-izq' : undefined}
          />
          <Brazo
            s={1}
            piel={piel}
            p={arriba}
            rel={relArriba}
            clase={anim === 'abrazo' ? 'nd-brazo-der' : anim === 'saludo' ? 'nd-saluda' : undefined}
          />

          {/* Accesorios de cuello */}
          {accesorio && accesorio.zona === 'cuello' ? <Accesorio p={accesorio} rel={relAcc} /> : null}
        </g>
        </g>

        {/* Trenza por delante del hombro */}
        {peinado.estilo === 'trenza' ? <Trenza pelo={pelo} lazo={pelo2} /> : null}

        {/* Cabeza: orejas, cara, pelo de delante y accesorios de cabeza */}
        <g className={claseCabeza} style={origenCabeza}>
          <circle cx={42} cy={96} r={9} fill={piel} {...LINEA} />
          <circle cx={158} cy={96} r={9} fill={piel} {...LINEA} />

          <ellipse cx={CABEZA.cx} cy={CABEZA.cy} rx={CABEZA.rx} ry={CABEZA.ry} fill={`url(#${uid}-piel-${piel.slice(1)})`} {...LINEA} />

          {rubor ? (
            <g fill={ROSA} opacity={anim === 'feliz' ? 0.7 : 0.45}>
              <ellipse cx={62} cy={116} rx={chico ? 8 : anim === 'feliz' ? 13 : 11} ry={chico ? 4.5 : 6} />
              <ellipse cx={138} cy={116} rx={chico ? 8 : anim === 'feliz' ? 13 : 11} ry={chico ? 4.5 : 6} />
            </g>
          ) : null}

          <g className={parpadea ? 'nd-ojos' : undefined}>
            <Ojos forma={ojos.forma} color={colorOjos} modo={modoOjos} suave={chico} />
          </g>

          <path d="M98 106 Q100 108 102 106" fill="none" stroke={oscurece(piel, 0.35)} strokeWidth={1.6} strokeLinecap="round" />
          {boca}

          {/* Pelo de delante con volumen y brillo */}
          <PeloDelante estilo={peinado.estilo} pelo={pelo} pelo2={pelo2} sombraPelo={sombraPelo} />

          {/* Accesorios de cabeza */}
          {accesorio && accesorio.zona === 'cabeza' ? (
            <Accesorio p={accesorio} rel={relAcc} />
          ) : null}
        </g>

        {/* Brillos y partículas según el gesto */}
        {brillo ? (
          <g fill="#FFD65C" stroke={INK} strokeWidth={0.8}>
            {[[18, 46], [184, 40], [12, 150], [190, 146]].map(([x, y], i) => (
              <path
                key={`${x}-${y}`}
                className="nd-brillo"
                style={{ animationDelay: `${i * 0.3}s` }}
                d={ESTRELLA_PEQ}
                transform={`translate(${x} ${y}) scale(1.4)`}
              />
            ))}
          </g>
        ) : null}
        {anim === 'abrazo' ? (
          <g fill={ROSA} stroke={INK} strokeWidth={0.9}>
            <path className="nd-flota" style={{ animationDelay: '0s' }} d={CORAZON} transform="translate(30 60) scale(1.3)" />
            <path className="nd-flota" style={{ animationDelay: '1.2s' }} d={CORAZON} transform="translate(170 56) scale(1.1)" />
          </g>
        ) : null}
        {anim === 'beso' ? (
          <g fill={ROSA} stroke={INK} strokeWidth={0.9}>
            <path className="nd-pop" style={{ animationDelay: '0s' }} d={CORAZON} transform="translate(30 76) scale(1.4)" />
            <path className="nd-pop" style={{ animationDelay: '1.1s' }} d={CORAZON} transform="translate(172 66) scale(1.2)" />
          </g>
        ) : null}
        {dormido ? (
          <g fill="#8E6CC9" fontWeight={800} fontFamily="system-ui, sans-serif">
            <text className="nd-zzz" x={150} y={66} fontSize={14} style={{ animationDelay: '0s' }}>z</text>
            <text className="nd-zzz" x={166} y={42} fontSize={19} style={{ animationDelay: '0.9s' }}>z</text>
            <text className="nd-zzz" x={180} y={14} fontSize={24} style={{ animationDelay: '1.8s' }}>z</text>
          </g>
        ) : null}
        {anim === 'saludo' ? (
          <g fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round">
            <path className="nd-onda" d="M186 146 Q194 158 186 170" />
            <path className="nd-onda" style={{ animationDelay: '0.4s' }} d="M180 138 Q192 158 180 178" />
          </g>
        ) : null}
      </g>
    </svg>
  )
}
