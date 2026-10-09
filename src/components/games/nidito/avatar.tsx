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

// Lienzo: cabeza grande (chibi), cuerpo corto. Se ve bien de 48 a 320 px.
const W = 200
const H = 250
const INK = '#5B3A4B' // contorno ciruela suave, más amable que el negro
const BLANCO = '#FFFFFF'
const ROSA = '#FF7AA2'
const LINEA = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

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

/* ---------- Peinados ---------- */

const CUPULA = 'M28 118 C18 44 182 44 172 118 C164 94 146 86 128 90 Q112 100 100 92 Q88 100 72 90 C54 86 36 96 28 118 Z'
const CUPULA_ANCHA = 'M26 120 C14 42 186 42 174 120 C164 94 146 86 128 90 Q112 100 100 92 Q88 100 72 90 C54 86 36 94 26 120 Z'
const LATERAL = 'M28 118 C18 44 182 44 172 118 C150 98 122 84 100 86 C78 88 54 98 28 118 Z'
const RAYA_CENTRO = 'M26 120 C16 42 184 42 174 120 C160 92 118 94 100 70 C82 94 40 92 26 120 Z'
const MOÑO_ALTO = 'M30 116 C26 52 174 52 170 116 C150 92 124 92 100 92 C76 92 50 92 30 116 Z'
const RIZADO = 'M24 120 C4 36 196 36 176 120 C160 94 140 88 124 92 Q112 102 100 92 Q88 102 76 92 C60 88 40 94 24 120 Z'
const PIXIE = 'M30 116 L40 74 L56 84 L64 56 L84 72 L100 52 L116 72 L136 56 L144 84 L160 74 L170 116 C150 98 128 88 104 96 C90 100 70 94 56 104 C46 110 36 112 30 116 Z'

function capPeinado(estilo: EstiloPeinado): string {
  switch (estilo) {
    case 'bob':
      return CUPULA_ANCHA
    case 'largo':
    case 'trenza':
    case 'cola':
    case 'ondas':
      return LATERAL
    case 'coletas':
      return RAYA_CENTRO
    case 'chongo':
      return MOÑO_ALTO
    case 'rizos':
      return RIZADO
    case 'pixie':
      return PIXIE
    default:
      return CUPULA
  }
}

/** Pelo que queda detrás de la cabeza (y de los hombros). */
function PeloAtras({ estilo, pelo, lazo }: { estilo: EstiloPeinado; pelo: string; lazo: string }) {
  switch (estilo) {
    case 'bob':
      return (
        <path
          d="M26 96 C18 100 16 112 16 128 L16 164 Q16 180 32 180 L168 180 Q184 180 184 164 L184 128 C184 112 182 100 174 96 Z"
          fill={pelo}
          {...LINEA}
        />
      )
    case 'largo':
      return (
        <path
          d="M30 92 C16 96 12 116 12 140 L10 206 Q10 232 36 232 L164 232 Q190 232 190 206 L188 140 C188 116 184 96 170 92 Z"
          fill={pelo}
          {...LINEA}
        />
      )
    case 'coletas':
      return (
        <g>
          <ellipse cx={26} cy={130} rx={17} ry={38} fill={pelo} {...LINEA} />
          <ellipse cx={174} cy={130} rx={17} ry={38} fill={pelo} {...LINEA} />
          <circle cx={26} cy={96} r={6} fill={lazo} stroke={INK} strokeWidth={1.8} />
          <circle cx={174} cy={96} r={6} fill={lazo} stroke={INK} strokeWidth={1.8} />
        </g>
      )
    case 'rizos': {
      const rizos: [number, number][] = [
        [28, 70], [46, 42], [74, 28], [100, 24], [126, 28], [154, 42], [172, 70],
        [180, 104], [182, 142], [18, 104], [18, 142], [24, 176], [176, 176],
      ]
      return (
        <g>
          {rizos.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={18} fill={pelo} {...LINEA} />
          ))}
        </g>
      )
    }
    case 'ondas':
      return (
        <path
          d="M28 96 C20 120 20 150 22 176 Q30 186 38 176 Q46 190 56 178 Q66 192 78 180 Q90 194 100 182 Q112 194 122 180 Q134 192 144 178 Q156 190 162 176 Q170 186 178 176 C180 150 180 120 172 96 Z"
          fill={pelo}
          {...LINEA}
        />
      )
    case 'cola':
      return (
        <g>
          <path
            d="M150 72 C190 62 200 110 192 150 C188 176 178 192 166 200 C170 174 168 140 158 112 C152 96 148 84 150 72 Z"
            fill={pelo}
            {...LINEA}
          />
          <circle cx={152} cy={76} r={7} fill={lazo} stroke={INK} strokeWidth={1.8} />
        </g>
      )
    default:
      return null
  }
}

/** Trenza que cae por delante del hombro derecho. */
function Trenza({ pelo, lazo }: { pelo: string; lazo: string }) {
  const puntos: [number, number][] = [
    [146, 98], [148, 110], [146, 124], [141, 138], [136, 152], [132, 166], [129, 180], [128, 194], [128, 206],
  ]
  return (
    <g>
      {puntos.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={7.5} fill={i % 2 ? pelo : aclara(pelo, 0.12)} {...LINEA} strokeWidth={1.8} />
      ))}
      <rect x={122} y={210} width={12} height={8} rx={3} fill={lazo} stroke={INK} strokeWidth={1.8} />
    </g>
  )
}

/* ---------- Ojos ---------- */

function OjoLocal({ forma, color }: { forma: FormaOjos; color: string }) {
  switch (forma) {
    case 'almendra':
      return (
        <>
          <path d="M-14 0 Q0 -28 14 0 Q0 26 -14 0 Z" fill={color} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <circle cx={4} cy={-5} r={4} fill={BLANCO} />
          <circle cx={-4} cy={3} r={1.9} fill={BLANCO} opacity={0.9} />
          <path d="M-15 -2 Q0 -26 15 -2" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </>
      )
    case 'felinos':
      return (
        <>
          <path d="M-14 -2 Q0 -26 14 -4 Q0 22 -14 -2 Z" fill={color} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <path d="M12 -8 L24 -15 L20 2 Z" fill={INK} />
          <circle cx={3} cy={-4} r={3.8} fill={BLANCO} />
          <circle cx={-4} cy={3} r={1.8} fill={BLANCO} opacity={0.9} />
          <path d="M-15 -3 Q0 -28 22 -16" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
        </>
      )
    case 'corazon':
      return (
        <>
          <path d={CORAZON_OJO} fill={color} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <circle cx={5} cy={-6} r={3.6} fill={BLANCO} />
          <circle cx={-5} cy={3} r={1.8} fill={BLANCO} opacity={0.9} />
          <path d="M-14 -4 Q0 -21 14 -4" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </>
      )
    case 'estrella':
      return (
        <>
          <path d={ESTRELLA_OJO} fill={color} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <circle cx={4} cy={-4} r={3.2} fill={BLANCO} />
          <path d="M-14 -5 Q0 -21 14 -5" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </>
      )
    default:
      return (
        <>
          <ellipse rx={13} ry={15} fill={color} stroke={INK} strokeWidth={2} />
          <ellipse cy={5} rx={9} ry={8} fill={oscurece(color, 0.25)} opacity={0.45} />
          <circle cx={4.5} cy={-5} r={4.6} fill={BLANCO} />
          <circle cx={-4.5} cy={6} r={2.2} fill={BLANCO} opacity={0.9} />
          <path d="M-14 -4 Q0 -21 14 -4" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </>
      )
  }
}

function Ojos({ forma, color, modo }: { forma: FormaOjos; color: string; modo: 'abierto' | 'feliz' | 'dormido' }) {
  if (modo === 'abierto') {
    // El izquierdo va espejado para que la pestaña felina apunte hacia afuera.
    return (
      <g>
        <g transform="translate(74 118) scale(-1 1)">
          <OjoLocal forma={forma} color={color} />
        </g>
        <g transform="translate(126 118)">
          <OjoLocal forma={forma} color={color} />
        </g>
      </g>
    )
  }
  const d = modo === 'feliz' ? 'M-13 4 Q0 -12 13 4' : 'M-12 -1 Q0 6 12 -1'
  return (
    <g fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round">
      <path transform="translate(74 118)" d={d} />
      <path transform="translate(126 118)" d={d} />
    </g>
  )
}

/* ---------- Ropa ---------- */

const TORSO = 'M74 166 Q100 158 126 166 Q138 170 138 184 L140 206 Q140 216 130 216 L70 216 Q60 216 60 206 L62 184 Q62 170 74 166 Z'
const VESTIDO = 'M74 166 Q100 158 126 166 Q138 170 138 184 L152 236 Q100 246 48 236 L62 184 Q62 170 74 166 Z'
const OVEROL = 'M70 166 Q100 158 130 166 Q138 170 138 184 L140 232 Q140 240 132 240 L68 240 Q60 240 60 232 L62 184 Q62 170 70 166 Z'
const FALDA = 'M62 200 L138 200 Q146 214 152 232 Q100 242 48 232 Q54 214 62 200 Z'
const SHORT = 'M64 200 L136 200 Q142 212 139 226 L110 226 L100 214 L90 226 L61 226 Q58 212 64 200 Z'
const PANTALON = 'M64 200 L136 200 L138 236 Q138 240 132 240 L106 240 Q102 240 101 234 L100 218 L99 234 Q98 240 94 240 L68 240 Q62 240 62 236 Z'
const TUL_1 = 'M60 200 L140 200 Q150 220 158 238 Q100 250 42 238 Q50 220 60 200 Z'
const TUL_2 = 'M46 226 Q100 240 154 226 L158 238 Q100 252 42 238 Z'

function Brazo({
  cx,
  piel,
  p,
  rel,
  clase,
}: {
  cx: number
  piel: string
  p: Prenda
  rel: string
  clase?: string
}) {
  const larga = p.manga === 'larga'
  return (
    <g className={clase} style={{ transformOrigin: `${cx}px 180px`, transformBox: 'view-box' }}>
      <rect x={cx - 8} y={176} width={16} height={36} rx={8} fill={larga ? rel : piel} {...LINEA} />
      {!larga ? <rect x={cx - 9} y={176} width={18} height={13} rx={6.5} fill={rel} {...LINEA} /> : null}
      <circle cx={cx} cy={212} r={8.5} fill={piel} {...LINEA} />
    </g>
  )
}

function ArribaDibujo({ p, rel }: { p: Prenda; rel: string }) {
  const brillo = <path d="M80 182 Q82 196 86 204" fill="none" stroke={BLANCO} strokeWidth={4} opacity={0.25} strokeLinecap="round" />
  switch (p.estilo) {
    case 'vestido':
      return (
        <g>
          <path d={VESTIDO} fill={rel} {...LINEA} />
          <path d="M52 236 Q100 246 148 236" fill="none" stroke={p.acento} strokeWidth={3} opacity={0.7} />
        </g>
      )
    case 'overol':
      return (
        <g>
          <path d={OVEROL} fill={rel} {...LINEA} />
          <path d="M86 172 L80 164 M114 172 L120 164" stroke={p.acento} strokeWidth={4} strokeLinecap="round" />
          <rect x={84} y={176} width={32} height={22} rx={5} fill={p.acento} stroke={INK} strokeWidth={1.8} />
          <rect x={86} y={204} width={28} height={12} rx={3} fill={p.acento} opacity={0.35} />
        </g>
      )
    case 'blusa':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <path d="M84 166 Q100 178 116 166" fill="none" stroke={INK} strokeWidth={1.8} />
          <path d="M92 169 L100 176 L92 183 Z M108 169 L100 176 L108 183 Z" fill={p.acento} stroke={INK} strokeWidth={1.4} />
          <circle cx={100} cy={176} r={2.6} fill={p.acento} />
          {brillo}
        </g>
      )
    case 'sudadera':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <path d="M84 166 Q100 180 116 166" fill="none" stroke={INK} strokeWidth={1.8} />
          <path d="M96 174 L95 190 M104 174 L105 190" stroke={p.acento} strokeWidth={2.4} strokeLinecap="round" />
          <rect x={60} y={206} width={80} height={6} fill={p.acento} />
          {brillo}
        </g>
      )
    case 'suter':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <rect x={84} y={158} width={32} height={14} rx={6} fill={rel} {...LINEA} />
          <path d="M62 194 L138 194 M62 204 L138 204" stroke={p.acento} strokeWidth={2.4} opacity={0.6} />
          {brillo}
        </g>
      )
    case 'hoodie':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <path d="M84 166 Q100 176 116 166" fill="none" stroke={INK} strokeWidth={1.8} />
          <path d="M84 196 L116 196 L120 212 L80 212 Z" fill={p.acento} opacity={0.4} stroke={INK} strokeWidth={1.6} />
          <path d="M94 172 L92 190 M106 172 L108 190" stroke={p.acento} strokeWidth={2.4} strokeLinecap="round" />
          {brillo}
        </g>
      )
    case 'camisa':
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <path d="M84 166 L98 180 L100 168 M116 166 L102 180 L100 168" fill="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <circle cx={100} cy={188} r={1.8} fill={p.acento} />
          <circle cx={100} cy={200} r={1.8} fill={p.acento} />
          {brillo}
        </g>
      )
    default:
      return (
        <g>
          <path d={TORSO} fill={rel} {...LINEA} />
          <path d="M86 166 Q100 178 114 166" fill="none" stroke={INK} strokeWidth={1.8} />
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
          <path d="M80 212 L76 232 M100 212 L100 238 M120 212 L124 232" stroke={p.acento} strokeWidth={1.6} opacity={0.6} />
        </g>
      )
    case 'short':
      return <path d={SHORT} fill={rel} {...LINEA} />
    case 'tul':
      return (
        <g>
          <path d={TUL_1} fill={rel} {...LINEA} />
          <path d={TUL_2} fill={p.acento} {...LINEA} />
        </g>
      )
    default:
      return <path d={PANTALON} fill={rel} {...LINEA} />
  }
}

function Zapato({ p, cx, piel }: { p: Prenda; cx: number; piel: string }) {
  const cy = 238
  const c = p.color
  const a = p.acento
  switch (p.estilo) {
    case 'botitas':
      return (
        <g>
          <rect x={cx - 15} y={cy - 17} width={30} height={24} rx={10} fill={c} {...LINEA} />
          <ellipse cx={cx} cy={cy + 5} rx={17} ry={8} fill={c} {...LINEA} />
          <path d={`M${cx - 15} ${cy - 6} L${cx + 15} ${cy - 6}`} stroke={a} strokeWidth={2.4} />
        </g>
      )
    case 'tenis':
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={17} ry={9} fill={c} {...LINEA} />
          <ellipse cx={cx} cy={cy + 6} rx={17.5} ry={3.5} fill={a} stroke={INK} strokeWidth={1.4} />
          <path d={`M${cx - 6} ${cy - 4} L${cx + 3} ${cy - 4}`} stroke={a} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )
    case 'mary':
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={16} ry={8} fill={c} {...LINEA} />
          <rect x={cx - 9} y={cy - 9} width={18} height={4.5} rx={2} fill={a} stroke={INK} strokeWidth={1.4} />
          <circle cx={cx} cy={cy - 6.5} r={1.6} fill={INK} />
        </g>
      )
    case 'sandalias':
      return (
        <g>
          <ellipse cx={cx} cy={cy - 2} rx={14} ry={7} fill={piel} {...LINEA} />
          <path d={`M${cx - 12} ${cy + 2} Q${cx} ${cy - 10} ${cx + 12} ${cy + 2}`} fill="none" stroke={c} strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={cx} cy={cy + 6} rx={17} ry={4} fill={a} stroke={INK} strokeWidth={1.4} />
        </g>
      )
    case 'botas':
      return (
        <g>
          <rect x={cx - 15} y={cy - 26} width={30} height={36} rx={10} fill={c} {...LINEA} />
          <ellipse cx={cx} cy={cy + 6} rx={17} ry={5} fill={a} {...LINEA} />
          <path d={`M${cx - 15} ${cy - 16} L${cx + 15} ${cy - 16}`} stroke={a} strokeWidth={2} />
        </g>
      )
    case 'pantuflas':
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={18} ry={11} fill={c} {...LINEA} />
          <circle cx={cx - 10} cy={cy - 8} r={4.5} fill={c} {...LINEA} />
          <circle cx={cx + 10} cy={cy - 8} r={4.5} fill={c} {...LINEA} />
          <ellipse cx={cx} cy={cy + 3} rx={9} ry={4} fill={a} opacity={0.6} />
        </g>
      )
    default:
      return <ellipse cx={cx} cy={cy} rx={17} ry={10} fill={c} {...LINEA} />
  }
}

function Accesorio({ p, rel }: { p: Prenda; rel: string }) {
  const a = p.acento
  const c = p.color
  switch (p.estilo) {
    case 'moño':
      return (
        <g>
          <path d="M126 58 L140 66 L126 74 Z M154 58 L140 66 L154 74 Z" fill={c} {...LINEA} strokeWidth={1.8} />
          <circle cx={140} cy={66} r={4.6} fill={a} {...LINEA} strokeWidth={1.8} />
        </g>
      )
    case 'diadema':
      return (
        <g>
          <path d="M36 96 Q100 14 164 96" fill="none" stroke={INK} strokeWidth={8} strokeLinecap="round" />
          <path d="M36 96 Q100 14 164 96" fill="none" stroke={c} strokeWidth={5} strokeLinecap="round" />
          <path d={ESTRELLA_PEQ} transform="translate(100 54) scale(1.5)" fill={a} stroke={INK} strokeWidth={0.9} />
          <circle cx={62} cy={74} r={2.4} fill={a} />
          <circle cx={138} cy={74} r={2.4} fill={a} />
        </g>
      )
    case 'lentes':
      return (
        <g fill="none" stroke={c} strokeWidth={3.2}>
          <circle cx={74} cy={118} r={19} fill="#FFFFFF" fillOpacity={0.22} />
          <circle cx={126} cy={118} r={19} fill="#FFFFFF" fillOpacity={0.22} />
          <path d="M93 116 Q100 112 107 116 M55 112 L40 108 M145 112 L160 108" strokeLinecap="round" />
        </g>
      )
    case 'collar':
      return (
        <g>
          {[
            [84, 166], [92, 172], [100, 175], [108, 172], [116, 166],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={3.8} fill={c} stroke={a} strokeWidth={1.4} />
          ))}
        </g>
      )
    case 'gorro':
      return (
        <g>
          <path d="M30 110 C26 36 174 36 170 110 Q158 98 100 98 Q42 98 30 110 Z" fill={c} {...LINEA} />
          <path d="M30 104 Q100 92 170 104 L170 118 Q100 106 30 118 Z" fill={a} {...LINEA} strokeWidth={1.8} />
          <circle cx={100} cy={36} r={12} fill={a} {...LINEA} strokeWidth={1.8} />
        </g>
      )
    case 'bufanda':
      return (
        <g>
          <rect x={80} y={164} width={40} height={15} rx={7} fill={rel} {...LINEA} />
          <rect x={106} y={172} width={13} height={32} rx={5} fill={rel} {...LINEA} />
        </g>
      )
    case 'flor':
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => {
            const ang = (i * 2 * Math.PI) / 5 - Math.PI / 2
            return (
              <circle key={i} cx={56 + 7 * Math.cos(ang)} cy={78 + 7 * Math.sin(ang)} r={5.6} fill={c} {...LINEA} strokeWidth={1.6} />
            )
          })}
          <circle cx={56} cy={78} r={4} fill={a} />
        </g>
      )
    case 'audifonos':
      return (
        <g>
          <path d="M30 112 Q100 8 170 112" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <path d="M30 112 Q100 8 170 112" fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" />
          <ellipse cx={30} cy={118} rx={13} ry={17} fill={c} {...LINEA} />
          <ellipse cx={170} cy={118} rx={13} ry={17} fill={c} {...LINEA} />
          <ellipse cx={30} cy={118} rx={6} ry={9} fill={a} />
          <ellipse cx={170} cy={118} rx={6} ry={9} fill={a} />
        </g>
      )
    case 'orejas':
      return (
        <g>
          <path d="M38 84 L46 30 L84 62 Z" fill={c} {...LINEA} />
          <path d="M162 84 L154 30 L116 62 Z" fill={c} {...LINEA} />
          <path d="M46 62 L49 42 L66 56 Z" fill={a} />
          <path d="M154 62 L151 42 L134 56 Z" fill={a} />
        </g>
      )
    case 'corona':
      return (
        <g>
          <path d="M70 58 L70 36 L86 50 L100 30 L114 50 L130 36 L130 58 Z" fill={c} {...LINEA} />
          <circle cx={100} cy={46} r={3.6} fill={a} stroke={INK} strokeWidth={1.2} />
          <circle cx={80} cy={50} r={2.4} fill={a} />
          <circle cx={120} cy={50} r={2.4} fill={a} />
        </g>
      )
    case 'sombrero':
      return (
        <g>
          <path d="M58 70 C58 30 142 30 142 70 Z" fill={c} {...LINEA} />
          <path d="M58 60 L142 60 L142 70 L58 70 Z" fill={a} />
          <ellipse cx={100} cy={70} rx={82} ry={12} fill={c} {...LINEA} />
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
  const origenCabeza = { transformOrigin: '100px 176px', transformBox: 'view-box' as const }

  const boca = (() => {
    switch (anim) {
      case 'feliz':
        return (
          <g>
            <path d="M88 138 Q100 136 112 138 Q110 154 100 154 Q90 154 88 138 Z" fill="#C2406A" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
            <ellipse cx={100} cy={150} rx={5.5} ry={3} fill={ROSA} />
          </g>
        )
      case 'abrazo':
        return <path d="M89 140 Q100 151 111 140" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      case 'beso':
        return <path d={CORAZON} transform="translate(100 146) scale(1.15)" fill="#FF5C8A" stroke={INK} strokeWidth={1.6} />
      case 'dormido':
        return <ellipse cx={102} cy={144} rx={3.4} ry={3.8} fill={INK} opacity={0.8} />
      case 'saludo':
        return <path d="M90 139 Q100 150 110 139" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      default:
        return <path d="M92 140 Q100 148 108 140" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
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
        <radialGradient id={`${uid}-piel`} cx="42%" cy="34%" r="70%">
          <stop offset="0" stopColor={aclara(piel, 0.22)} />
          <stop offset="1" stopColor={piel} />
        </radialGradient>
        {arriba.patron ? <DefPatron id={`${uid}-arr`} tipo={arriba.patron} base={arriba.color} acento={arriba.acento} /> : null}
        {abajo?.patron ? <DefPatron id={`${uid}-aba`} tipo={abajo.patron} base={abajo.color} acento={abajo.acento} /> : null}
        {accesorio?.patron ? (
          <DefPatron id={`${uid}-acc`} tipo={accesorio.patron} base={accesorio.color} acento={accesorio.acento} />
        ) : null}
      </defs>

      <ellipse cx={100} cy={247} rx={54} ry={4.5} fill={INK} opacity={0.14} />

      <g className={claseFig || undefined}>
        {/* Pelo de atrás: se mueve con la cabeza, queda detrás del cuerpo */}
        <g className={claseCabeza} style={origenCabeza}>
          <PeloAtras estilo={peinado.estilo} pelo={pelo} lazo={pelo2} />
        </g>

        {/* Cuerpo: respira suave */}
        <g className={claseCuerpo}>
          {/* Piernas */}
          <rect x={79} y={204} width={16} height={34} rx={7} fill={piel} {...LINEA} />
          <rect x={105} y={204} width={16} height={34} rx={7} fill={piel} {...LINEA} />

          {/* Abajo */}
          {!cubreCuerpo && abajo ? <AbajoDibujo p={abajo} rel={relAbajo} /> : null}

          {/* Zapatos */}
          <Zapato p={zapatos} cx={87} piel={piel} />
          <Zapato p={zapatos} cx={113} piel={piel} />

          {/* Cuello y torso */}
          <rect x={88} y={148} width={24} height={26} rx={6} fill={piel} {...LINEA} />
          <ArribaDibujo p={arriba} rel={relArriba} />

          {/* Brazos: el derecho puede saludar, ambos pueden abrazar */}
          <Brazo
            cx={63}
            piel={piel}
            p={arriba}
            rel={relArriba}
            clase={anim === 'abrazo' ? 'nd-brazo-izq' : undefined}
          />
          <Brazo
            cx={137}
            piel={piel}
            p={arriba}
            rel={relArriba}
            clase={anim === 'abrazo' ? 'nd-brazo-der' : anim === 'saludo' ? 'nd-saluda' : undefined}
          />

          {/* Accesorios de cuello */}
          {accesorio && accesorio.zona === 'cuello' ? <Accesorio p={accesorio} rel={relAcc} /> : null}
        </g>

        {/* Trenza por delante del hombro */}
        {peinado.estilo === 'trenza' ? <Trenza pelo={pelo} lazo={pelo2} /> : null}

        {/* Cabeza: orejas, cara, pelo de delante y accesorios de cabeza */}
        <g className={claseCabeza} style={origenCabeza}>
          <circle cx={34} cy={118} r={10.5} fill={piel} {...LINEA} />
          <circle cx={166} cy={118} r={10.5} fill={piel} {...LINEA} />

          <ellipse cx={100} cy={110} rx={66} ry={62} fill={`url(#${uid}-piel)`} {...LINEA} />

          {rubor ? (
            <g fill={ROSA} opacity={anim === 'feliz' ? 0.7 : 0.45}>
              <ellipse cx={58} cy={137} rx={anim === 'feliz' ? 14 : 12} ry={7} />
              <ellipse cx={142} cy={137} rx={anim === 'feliz' ? 14 : 12} ry={7} />
            </g>
          ) : null}

          <g className={parpadea ? 'nd-ojos' : undefined}>
            <Ojos forma={ojos.forma} color={colorOjos} modo={modoOjos} />
          </g>

          <path d="M98 128 Q100 130 102 128" fill="none" stroke={oscurece(piel, 0.35)} strokeWidth={1.6} strokeLinecap="round" />
          {boca}

          {/* Pelo de delante con volumen y brillo */}
          {peinado.estilo === 'chongo' ? (
            <g>
              <circle cx={100} cy={40} r={22} fill={pelo} {...LINEA} />
              <path d="M88 26 Q100 22 112 26" fill="none" stroke={pelo2} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
            </g>
          ) : null}
          <path d={capPeinado(peinado.estilo)} fill={pelo} {...LINEA} />
          {peinado.estilo === 'rizos' ? (
            <g>
              {[[56, 58, 14], [100, 46, 16], [144, 58, 14]].map(([x, y, r]) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={pelo} {...LINEA} />
              ))}
            </g>
          ) : null}
          <path d="M50 76 Q68 54 102 52" fill="none" stroke={pelo2} strokeWidth={5} strokeLinecap="round" opacity={0.75} />
          <path d="M140 100 Q152 110 156 124" fill="none" stroke={sombraPelo} strokeWidth={3} strokeLinecap="round" opacity={0.5} />

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
            <text className="nd-zzz" x={148} y={70} fontSize={14} style={{ animationDelay: '0s' }}>z</text>
            <text className="nd-zzz" x={164} y={46} fontSize={19} style={{ animationDelay: '0.9s' }}>z</text>
            <text className="nd-zzz" x={178} y={18} fontSize={24} style={{ animationDelay: '1.8s' }}>z</text>
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
