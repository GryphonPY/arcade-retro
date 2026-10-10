'use client'

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Camera, Check, FlipHorizontal, Heart, Lock, Package, PawPrint, Palette } from 'lucide-react'
import { Avatar } from './avatar'
import { DibujoMascota, PanelMascotas } from './mascotas'
import { hoyISO, nivelDeCorazones, nuevoUid, sumarInventario, type Actualizar } from './guardado'
import { CUARTOS, MUEBLES, buscarMueble, buscarPared, buscarPiso } from './muebles-data'
import { MAX_FOTOS } from './libreta'
import { aplicarAccion } from './tareas'
import {
  construirMundo,
  crearActor,
  despertar,
  dormir,
  iniciarAbrazo,
  irA,
  irAAbrazo,
  irAComer,
  latir,
  luzPara,
  puntoLibre,
  saludoPara,
  type Actor,
  type Luz,
  type Mundo,
} from './vida'
import type { CuartoId, Foto, MuebleColocado, Partida } from './types'
import { sfx, tone } from '../sfx'

export interface CasaProps {
  partida: Partida
  actualizar: Actualizar
  cuartoId: CuartoId
  onCuarto: (id: CuartoId) => void
  avisar: (texto: string) => void
}

type Reaccion = 'feliz' | 'abrazo' | 'beso'
/** Cosas que la pareja hace sola de vez en cuando (ambiente vivo). */
type TipoOcio = 'lee' | 'estira' | 'bosteza' | 'notas' | 'riega' | 'saluda'
interface Ocio {
  id: number
  i: number // 0 o 1: quién lo hace
  tipo: TipoOcio
  x: number
  y: number
  px?: number // planta que se riega
  py?: number
}
interface Corazon {
  id: number
  x: number
  y: number
}
interface Arrastre {
  uid: string
  pid: number
  sx: number
  sy: number
  x0: number
  y0: number
  x: number
  y: number
  colgado: boolean
  movido: boolean
}

const ORDEN_CUARTOS = Object.keys(CUARTOS) as CuartoId[]
const EMOJI_MOMENTO: Record<Luz['momento'], string> = {
  amanecer: '🌅',
  dia: '☀️',
  atardecer: '🌇',
  noche: '🌙',
}
/** Horizonte: la pared ocupa la parte de arriba; el piso, la de abajo. */
const HORIZONTE = '46%'

const CSS_CASA = `
@keyframes nidito-rebota { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
@keyframes nidito-sube { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.6) } 15% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -70px) scale(1.15) } }
@keyframes nidito-cola { 0%, 100% { transform: rotate(-12deg) } 50% { transform: rotate(14deg) } }
@keyframes nidito-destello { 0% { opacity: 0.95 } 100% { opacity: 0 } }
@keyframes nidito-burbuja { 0% { opacity: 0; transform: translate(-50%, 6px) scale(0.5) } 14% { opacity: 1; transform: translate(-50%, 0) scale(1.12) } 22% { transform: translate(-50%, 0) scale(1) } 82% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -10px) scale(0.95) } }
@keyframes nidito-estira { 0%, 100% { transform: scale(1, 1) } 45% { transform: scale(0.97, 1.08) } 70% { transform: scale(1.02, 0.98) } }
@keyframes nidito-zzz { 0% { opacity: 0; transform: translate(0, 0) scale(0.6) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(14px, -46px) scale(1.15) } }
@keyframes nidito-gato { 0% { transform: translateY(70%) } 45% { transform: translateY(-7%) } 65% { transform: translateY(0) } 80% { transform: translateY(-2%) } 100% { transform: translateY(0) } }
@keyframes nidito-gato-vivo { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3%) } }
@keyframes nidito-aplasta { 0% { transform: scale(1, 1) } 30% { transform: scale(1.08, 0.86) } 60% { transform: scale(0.97, 1.05) } 100% { transform: scale(1, 1) } }
@keyframes nidito-mano { 0%, 100% { transform: rotate(-14deg) } 50% { transform: rotate(16deg) } }
@keyframes nidito-cae { 0% { opacity: 0; transform: translate(-50%, -26px) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, 8px) } }
.nidito-camina { animation: nidito-rebota 0.55s ease-in-out infinite; }
.nidito-come { animation: nidito-rebota 0.3s ease-in-out infinite; }
.nidito-cola { animation: nidito-cola 1.1s ease-in-out infinite; }
.nidito-sube { animation: nidito-sube 1.3s ease-out forwards; }
.nidito-destello { animation: nidito-destello 0.5s ease-out forwards; }
.nidito-burbuja { animation: nidito-burbuja 2.4s ease-out forwards; }
.nidito-estira { animation: nidito-estira 1.6s ease-in-out; transform-origin: 50% 100%; }
.nidito-zzz { animation: nidito-zzz 2.8s ease-in infinite; }
.nidito-gato { animation: nidito-gato 0.9s cubic-bezier(0.3, 0.7, 0.4, 1) forwards; }
.nidito-gato-vivo { animation: nidito-gato-vivo 2.4s ease-in-out infinite; }
.nidito-aplasta { animation: nidito-aplasta 0.5s ease-out; transform-origin: 50% 100%; }
.nidito-mano { animation: nidito-mano 0.5s ease-in-out infinite; display: inline-block; transform-origin: 70% 90%; }
.nidito-cae { animation: nidito-cae 1.1s ease-in 2; }
@media (prefers-reduced-motion: reduce) {
  .nidito-camina, .nidito-come, .nidito-cola, .nidito-zzz, .nidito-gato-vivo, .nidito-mano, .nidito-cae { animation: none; }
  .nidito-estira, .nidito-aplasta { animation: none; }
}
`

/** Solo caminan a abrazarse quienes no van a un asiento ni al plato. */
function puedeAbrazar(p: Actor): boolean {
  return (p.estado === 'quieta' || p.estado === 'camina') && p.meta !== 'asiento' && p.meta !== 'comida'
}

/** Capa de dibujo: quien está sentado se dibuja sobre el mueble. */
function capaDe(p: Actor, m: Mundo): number {
  if (p.estado === 'sentado' && p.silla >= 0 && m.asientos[p.silla]) return m.asientos[p.silla].z
  return Math.round(p.y * 1000)
}

/** Gatito de la ventana: cabeza redonda, orejas, ojos brillantes y patitas en el alféizar. */
function GatitoSvg() {
  const linea = { stroke: '#6b4a63', strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <svg viewBox="0 0 100 100" className="block h-auto w-full overflow-visible" aria-hidden>
      <path d="M24 50 L27 16 L46 34 Z" fill="#f7c48f" {...linea} />
      <path d="M76 50 L73 16 L54 34 Z" fill="#f7c48f" {...linea} />
      <path d="M30 40 L31 26 L40 34 Z" fill="#ffb3c9" stroke="none" />
      <path d="M70 40 L69 26 L60 34 Z" fill="#ffb3c9" stroke="none" />
      <ellipse cx={50} cy={60} rx={34} ry={30} fill="#f7c48f" {...linea} />
      <ellipse cx={38} cy={58} rx={4.6} ry={5.6} fill="#6b4a63" stroke="none" />
      <ellipse cx={62} cy={58} rx={4.6} ry={5.6} fill="#6b4a63" stroke="none" />
      <circle cx={39.5} cy={56} r={1.6} fill="#ffffff" stroke="none" />
      <circle cx={63.5} cy={56} r={1.6} fill="#ffffff" stroke="none" />
      <ellipse cx={30} cy={68} rx={5} ry={3.4} fill="#ff8fb1" opacity={0.7} stroke="none" />
      <ellipse cx={70} cy={68} rx={5} ry={3.4} fill="#ff8fb1" opacity={0.7} stroke="none" />
      <path d="M46 67 L54 67 L50 71 Z" fill="#ff6f9c" {...linea} strokeWidth={2} />
      <path d="M50 71 Q46 77 41 74 M50 71 Q54 77 59 74" fill="none" {...linea} strokeWidth={2.2} />
      <path d="M22 64 L8 61 M22 70 L8 72 M78 64 L92 61 M78 70 L92 72" fill="none" {...linea} strokeWidth={1.8} />
      <ellipse cx={36} cy={92} rx={9} ry={6} fill="#f7c48f" {...linea} />
      <ellipse cx={64} cy={92} rx={9} ry={6} fill="#f7c48f" {...linea} />
    </svg>
  )
}

export function Casa({ partida, actualizar, cuartoId, onCuarto, avisar }: CasaProps) {
  const cuarto = partida.cuartos.find((c) => c.id === cuartoId) ?? partida.cuartos[0]
  const [modo, setModo] = useState<'vista' | 'decorar'>('vista')
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [verMascotas, setVerMascotas] = useState(false)
  const [desbloqueo, setDesbloqueo] = useState<CuartoId | null>(null)
  const [dim, setDim] = useState({ w: 0, h: 0, ratio: 4 / 3 })
  const [luz, setLuz] = useState<Luz | null>(null)
  const [reacciones, setReacciones] = useState<Partial<Record<number, Reaccion>>>({})
  const [corazones, setCorazones] = useState<Corazon[]>([])
  const [, setVersionVista] = useState(0)
  const [ocio, setOcio] = useState<Ocio[]>([])
  const [durmiendo, setDurmiendo] = useState(false)
  const [gato, setGato] = useState<{ id: number } | null>(null)
  const [flash, setFlash] = useState(0)
  const [rebote, setRebote] = useState<{ uid: string; n: number } | null>(null)

  const contRef = useRef<HTMLDivElement | null>(null)
  const roomRef = useRef<HTMLDivElement | null>(null)
  const dimRef = useRef(dim)
  const mundoRef = useRef<Mundo | null>(null)
  const parejaRef = useRef<Actor[]>([])
  const mascotasRef = useRef<Actor[]>([])
  const elParejaRef = useRef<Array<HTMLDivElement | null>>([])
  const elMascotaRef = useRef<Array<HTMLDivElement | null>>([])
  const muebleElRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const abrazoEnRef = useRef(20)
  const ultimoToqueRef = useRef(0)
  const arrastreRef = useRef<Arrastre | null>(null)
  const idCorazonRef = useRef(0)
  const idOcioRef = useRef(0)
  const cuartoRef = useRef(cuarto)

  const ratio = dim.ratio
  const colocados = cuarto.muebles
  const cantMascotas = partida.mascotas.length
  const tam = Math.round(Math.min(200, Math.max(92, dim.w * 0.2)))
  const tamMascota = Math.round(tam * 0.62)

  // Medida del cuarto: ocupa el espacio disponible con proporción fija.
  useLayoutEffect(() => {
    const el = contRef.current
    if (!el) return
    const medir = () => {
      const cw = el.clientWidth
      const ch = el.clientHeight
      if (cw <= 0 || ch <= 0) return
      const proporcion = ch > cw * 1.05 ? 1 : 4 / 3
      const w = Math.floor(Math.max(0, Math.min(cw - 16, (ch - 8) * proporcion)))
      setDim({ w, h: Math.floor(w / proporcion), ratio: proporcion })
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    dimRef.current = dim
  }, [dim])

  // Luz según la hora: se revisa cada minuto.
  useEffect(() => {
    const poner = () => setLuz(luzPara(new Date()))
    poner()
    const t = window.setInterval(poner, 60_000)
    return () => window.clearInterval(t)
  }, [])

  // Al cambiar los muebles (o la proporción) se reconstruye el mundo y la pareja busca nuevo lugar.
  useEffect(() => {
    const m = construirMundo(colocados, ratio)
    mundoRef.current = m
    if (parejaRef.current.length === 0) {
      const p0 = puntoLibre(m, Math.random)
      const a = crearActor(p0.x, p0.y, 0.12)
      const p1 = puntoLibre(m, Math.random, a)
      const b = crearActor(p1.x, p1.y, 0.12)
      a.amigo = b
      b.amigo = a
      parejaRef.current = [a, b]
    } else {
      for (const a of parejaRef.current) {
        if (a.estado === 'duerme') continue // quien duerme se queda en la cama (ver efecto de la noche)
        const p = puntoLibre(m, Math.random)
        irA(a, m, p.x, p.y)
      }
    }
    for (const a of mascotasRef.current) {
      const p = puntoLibre(m, Math.random)
      irA(a, m, p.x, p.y)
    }
  }, [colocados, ratio])

  useEffect(() => {
    cuartoRef.current = cuarto
  }, [cuarto])

  // De noche, en la recámara, la pareja se acuesta en la cama; al amanecer se levanta.
  useEffect(() => {
    const m = mundoRef.current
    const pareja = parejaRef.current
    if (!m || pareja.length !== 2) return
    const cama = colocados.find((c) => c.id === 'cama-doble')
    const duermen = Boolean(cama && cuartoId === 'recamara' && luz?.momento === 'noche')
    if (cama && duermen) {
      dormir(pareja[0], m, cama.x - 0.1, cama.y - 0.07)
      dormir(pareja[1], m, cama.x + 0.1, cama.y - 0.07)
    } else {
      for (const a of pareja) if (a.estado === 'duerme') despertar(a, m)
    }
    setDurmiendo(duermen)
  }, [cuartoId, luz?.momento, colocados, ratio])

  // Ambiente vivo: de vez en cuando la pareja lee, riega, se estira, bosteza, canta o saluda.
  useEffect(() => {
    let vivo = true
    let t = 0
    const tick = () => {
      if (!vivo) return
      const pareja = parejaRef.current
      if (pareja.length === 2 && Math.random() < 0.45) {
        const i = Math.random() < 0.5 ? 0 : 1
        const actor = pareja[i]
        const otro = pareja[1 - i]
        const libre = (x: Actor) => x.estado === 'quieta' || x.estado === 'sentado'
        if (libre(actor)) {
          const planta = cuartoRef.current.muebles.find((c) => c.id.includes('planta'))
          const tipos: TipoOcio[] = ['lee', 'estira', 'bosteza', 'notas']
          if (planta) tipos.push('riega')
          if (libre(otro)) tipos.push('saluda')
          const tipo = tipos[Math.floor(Math.random() * tipos.length)]
          if (tipo === 'saluda') actor.dir = otro.x >= actor.x ? 1 : -1
          const id = ++idOcioRef.current
          const dur = tipo === 'riega' ? 3200 : tipo === 'estira' ? 1700 : tipo === 'notas' ? 2600 : 2400
          setOcio((o) => [...o.slice(-4), { id, i, tipo, x: actor.x, y: actor.y, px: planta?.x, py: planta?.y }])
          window.setTimeout(() => setOcio((o) => o.filter((k) => k.id !== id)), dur)
          if (tipo === 'notas') {
            tone({ freq: 659, dur: 0.2, vol: 0.016, type: 'sine' })
            tone({ freq: 784, dur: 0.2, vol: 0.016, type: 'sine', delay: 0.22 })
            tone({ freq: 988, dur: 0.3, vol: 0.016, type: 'sine', delay: 0.44 })
          } else if (tipo === 'riega') {
            tone({ freq: 1500, to: 700, dur: 0.18, vol: 0.012, type: 'sine' })
          } else if (tipo === 'saluda') {
            tone({ freq: 880, to: 1175, dur: 0.12, vol: 0.018, type: 'triangle' })
          }
        }
      }
      t = window.setTimeout(tick, 5500 + Math.random() * 5000)
    }
    t = window.setTimeout(tick, 4000)
    return () => {
      vivo = false
      window.clearTimeout(t)
    }
  }, [])

  // Visita sorpresa: de vez en cuando aparece un gatito en la ventana un rato.
  useEffect(() => {
    let vivo = true
    let espera = 0
    let quita = 0
    const ciclo = () => {
      espera = window.setTimeout(() => {
        if (!vivo) return
        if (Math.random() < 0.35) {
          const id = Date.now()
          setGato({ id })
          quita = window.setTimeout(() => {
            if (vivo) setGato((g) => (g && g.id === id ? null : g))
          }, 14000)
        }
        ciclo()
      }, 45000 + Math.random() * 45000)
    }
    ciclo()
    return () => {
      vivo = false
      window.clearTimeout(espera)
      window.clearTimeout(quita)
    }
  }, [])

  // Mascotas nuevas: aparecen en un lugar libre del piso.
  useEffect(() => {
    const m = mundoRef.current
    const lista = mascotasRef.current
    while (lista.length < cantMascotas) {
      const p = m ? puntoLibre(m, Math.random) : { x: 0.8, y: 0.86 }
      lista.push(crearActor(p.x, p.y, 0.07))
    }
    lista.length = cantMascotas
  }, [cantMascotas])

  // Las mascotas pierden un poquito de felicidad con el tiempo.
  const hayMascotas = cantMascotas > 0
  useEffect(() => {
    if (!hayMascotas) return
    const t = window.setInterval(() => {
      actualizar((p) => ({
        ...p,
        mascotas: p.mascotas.map((m) => ({ ...m, felicidad: Math.max(0, m.felicidad - 1) })),
      }))
    }, 60_000)
    return () => window.clearInterval(t)
  }, [hayMascotas, actualizar])

  // Bucle de vida: camina, se sienta, se abraza y mueve a las mascotas.
  // Escribe posiciones directo en el DOM; solo re-renderiza cuando cambia una pose.
  useEffect(() => {
    let raf = 0
    let previo = performance.now()
    let firmaPrevia = ''
    const cuadro = (ahora: number) => {
      const dt = Math.min(0.05, Math.max(0, (ahora - previo) / 1000))
      previo = ahora
      const m = mundoRef.current
      const pareja = parejaRef.current
      const mascotas = mascotasRef.current
      const d = dimRef.current
      if (m && d.w > 0) {
        // Separación mínima: casi el ancho de un personaje en pantalla (sin encimarse).
        const tamPx = Math.min(200, Math.max(92, d.w * 0.2))
        m.sep = Math.min(0.3, Math.max(0.08, (0.72 * tamPx) / d.w))
      }
      if (m && pareja.length === 2) {
        for (const a of pareja) latir(a, dt, m)
        for (const a of mascotas) latir(a, dt, m)

        const [a, b] = pareja
        abrazoEnRef.current -= dt
        if (abrazoEnRef.current <= 0) {
          abrazoEnRef.current = 25 + Math.random() * 20
          if (puedeAbrazar(a) && puedeAbrazar(b)) {
            const mx = (a.x + b.x) / 2
            const my = Math.max(a.y, b.y)
            irAAbrazo(a, m, mx - m.sep / 2, my)
            irAAbrazo(b, m, mx + m.sep / 2, my)
          }
        }
        if (a.estado === 'espera' && b.estado === 'espera') {
          iniciarAbrazo(a, m)
          iniciarAbrazo(b, m)
        }

        pareja.forEach((p, i) => {
          const el = elParejaRef.current[i]
          if (!el) return
          el.style.transform = `translate3d(${p.x * d.w}px, ${p.y * d.h}px, 0)`
          el.style.zIndex = String(capaDe(p, m))
        })
        mascotas.forEach((p, i) => {
          const el = elMascotaRef.current[i]
          if (!el) return
          el.style.transform = `translate3d(${p.x * d.w}px, ${p.y * d.h}px, 0)`
          el.style.zIndex = String(capaDe(p, m))
        })
      }
      const firma = `${[...pareja, ...mascotas].map((p) => `${p.estado}${p.dir}`).join(',')}#${mascotas.length}`
      if (firma !== firmaPrevia) {
        firmaPrevia = firma
        setVersionVista((v) => v + 1)
      }
      raf = requestAnimationFrame(cuadro)
    }
    raf = requestAnimationFrame(cuadro)
    return () => cancelAnimationFrame(raf)
  }, [])

  const lanzarCorazones = (x: number, y: number) => {
    const id = ++idCorazonRef.current
    setCorazones((c) => [...c.slice(-10), { id, x, y }])
    window.setTimeout(() => setCorazones((c) => c.filter((k) => k.id !== id)), 1300)
  }

  const sumarCorazones = (n: number, x: number, y: number) => {
    const nivelNuevo = nivelDeCorazones(partida.corazones + n)
    actualizar((p) => {
      const corazonesNuevos = p.corazones + n
      return aplicarAccion({ ...p, corazones: corazonesNuevos, nivelAmor: nivelDeCorazones(corazonesNuevos) }, 'tocar', 1)
    })
    if (nivelNuevo > partida.nivelAmor) avisar(`¡Nivel de amor ${nivelNuevo}! Hay artículos nuevos en la tienda 💕`)
    lanzarCorazones(x, y)
  }

  const tocarPareja = (i: number) => {
    const ahora = Date.now()
    if (ahora - ultimoToqueRef.current < 450) return
    ultimoToqueRef.current = ahora
    const a = parejaRef.current[i]
    const reaccion: Reaccion = Math.random() < 0.5 ? 'abrazo' : 'beso'
    setReacciones((r) => ({ ...r, [i]: reaccion }))
    window.setTimeout(() => {
      setReacciones((r) => {
        const { [i]: _quitar, ...resto } = r
        return resto
      })
    }, 1700)
    tone({ freq: 784, to: 1046, dur: 0.14, vol: 0.03, type: 'triangle' })
    if (a) {
      const d = dimRef.current
      sumarCorazones(reaccion === 'beso' ? 2 : 1, a.x * d.w, a.y * d.h - tam * 0.9)
    }
  }

  const acariciarMascota = (i: number) => {
    const a = mascotasRef.current[i]
    const d = dimRef.current
    actualizar((p) =>
      aplicarAccion(
        {
          ...p,
          mascotas: p.mascotas.map((m, j) => (j === i ? { ...m, felicidad: Math.min(100, m.felicidad + 3) } : m)),
        },
        'mascota',
        1,
      ),
    )
    if (a) lanzarCorazones(a.x * d.w, a.y * d.h - tamMascota * 0.8)
  }

  const alimentarMascota = (i: number) => {
    const a = mascotasRef.current[i]
    const m = mundoRef.current
    if (a && m) irAComer(a, m)
  }

  const cambiarMuebles = (fn: (ms: MuebleColocado[]) => MuebleColocado[]) =>
    actualizar((p) => ({
      ...p,
      cuartos: p.cuartos.map((c) => (c.id === cuartoId ? { ...c, muebles: fn(c.muebles) } : c)),
    }))

  const colocar = (id: string) => {
    const m = buscarMueble(id)
    if (!m || (partida.inventario[id] ?? 0) <= 0) return
    const mc: MuebleColocado = { uid: nuevoUid(), id, x: 0.5, y: m.colgado ? 0.3 : 0.84, flip: false }
    actualizar((p) =>
      aplicarAccion(
        {
          ...p,
          inventario: sumarInventario(p.inventario, id, -1),
          cuartos: p.cuartos.map((c) => (c.id === cuartoId ? { ...c, muebles: [...c.muebles, mc] } : c)),
        },
        'colocar',
        1,
      ),
    )
    setSeleccion(mc.uid)
    setRebote({ uid: mc.uid, n: Date.now() })
    tone({ freq: 620, to: 980, dur: 0.09, type: 'sine', vol: 0.035 })
  }

  /** Foto del cuarto: guarda cómo se ve ahora (muebles, paredes y la pareja). */
  const tomarFoto = () => {
    const pareja = partida.pareja.map((per, i) => {
      const a = parejaRef.current[i]
      return { nombre: per.nombre, look: per.look, x: a?.x ?? 0.5, y: a?.y ?? 0.9, dir: a?.dir ?? 1 }
    })
    const foto: Foto = {
      id: nuevoUid(),
      dia: hoyISO(),
      t: Date.now(),
      cuarto: cuarto.id,
      pared: cuarto.pared,
      piso: cuarto.piso,
      muebles: cuarto.muebles.map((mc) => ({ ...mc })),
      pareja,
    }
    actualizar((p) => aplicarAccion({ ...p, fotos: [foto, ...(p.fotos ?? [])].slice(0, MAX_FOTOS) }, 'foto', 1))
    setFlash((n) => n + 1)
    tone({ freq: 2200, to: 1100, dur: 0.06, type: 'square', vol: 0.025 })
    tone({ freq: 1400, dur: 0.05, vol: 0.02, delay: 0.09 })
    avisar('¡Foto guardada! 📷 Mírala en la Libreta')
  }

  /** Tocar al gatito de la ventana: deja monedas o un mueble, y se va. */
  const tocarGato = () => {
    if (!gato) return
    setGato(null)
    if (Math.random() < 0.5) {
      const n = 20 + Math.floor(Math.random() * 3) * 10
      actualizar((p) => ({ ...p, monedas: p.monedas + n }))
      avisar(`El gatito te dejó ${n} monedas 🪙`)
    } else {
      const opciones = MUEBLES.filter((m) => m.precio <= 160 && !m.amor)
      const regalo = opciones[Math.floor(Math.random() * opciones.length)]
      actualizar((p) => ({ ...p, inventario: sumarInventario(p.inventario, regalo.id, 1) }))
      avisar(`¡El gatito te dejó ${regalo.nombre}! Está en tu inventario (Casa → Decorar)`)
    }
    sfx.coin()
    tone({ freq: 900, to: 1400, dur: 0.18, type: 'triangle', vol: 0.03 })
    const d = dimRef.current
    lanzarCorazones(d.w * 0.2, d.h * 0.3)
  }

  const guardarMueble = (uid: string) => {
    const mc = cuarto.muebles.find((x) => x.uid === uid)
    if (!mc) return
    actualizar((p) => ({
      ...p,
      inventario: sumarInventario(p.inventario, mc.id, 1),
      cuartos: p.cuartos.map((c) =>
        c.id === cuartoId ? { ...c, muebles: c.muebles.filter((x) => x.uid !== uid) } : c,
      ),
    }))
    setSeleccion(null)
  }

  const girar = (uid: string) =>
    cambiarMuebles((ms) => ms.map((x) => (x.uid === uid ? { ...x, flip: !x.flip } : x)))

  // Arrastrar muebles con el dedo (pointer events). Mientras se arrastra se mueve el
  // elemento directo en el DOM; al soltar se guarda la posición.
  const onMueblePointerDown = (e: ReactPointerEvent<HTMLDivElement>, mc: MuebleColocado) => {
    if (modo !== 'decorar') return
    e.stopPropagation()
    const m = buscarMueble(mc.id)
    arrastreRef.current = {
      uid: mc.uid,
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      x0: mc.x,
      y0: mc.y,
      x: mc.x,
      y: mc.y,
      colgado: Boolean(m?.colgado),
      movido: false,
    }
    setSeleccion(mc.uid)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // algunos navegadores no permiten capturar el puntero
    }
  }

  const onRoomPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const a = arrastreRef.current
    const d = dimRef.current
    if (!a || a.pid !== e.pointerId || d.w <= 0) return
    const px = e.clientX - a.sx
    const py = e.clientY - a.sy
    if (!a.movido && Math.hypot(px, py) < 6) return
    a.movido = true
    const x = Math.min(0.97, Math.max(0.03, a.x0 + px / d.w))
    const y = a.colgado
      ? Math.min(0.42, Math.max(0.1, a.y0 + py / d.h))
      : Math.min(0.98, Math.max(0.64, a.y0 + py / d.h))
    a.x = x
    a.y = y
    const el = muebleElRef.current.get(a.uid)
    if (el) {
      el.style.left = `${x * 100}%`
      el.style.top = `${y * 100}%`
      el.style.zIndex = String(Math.round(y * 1000) + 500)
    }
  }

  const onRoomPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const a = arrastreRef.current
    if (!a || a.pid !== e.pointerId) return
    arrastreRef.current = null
    if (!a.movido) return
    cambiarMuebles((ms) => ms.map((x) => (x.uid === a.uid ? { ...x, x: a.x, y: a.y } : x)))
    setRebote({ uid: a.uid, n: Date.now() })
    tone({ freq: 620, to: 980, dur: 0.09, type: 'sine', vol: 0.035 })
  }

  const desbloquear = (id: CuartoId) => {
    const info = CUARTOS[id]
    if (partida.monedas < info.precio) {
      avisar('Te faltan monedas para este cuarto')
      return
    }
    actualizar((p) =>
      p.cuartos.some((c) => c.id === id)
        ? p
        : {
            ...p,
            monedas: p.monedas - info.precio,
            cuartos: [...p.cuartos, { id, pared: info.paredInicial, piso: info.pisoInicial, muebles: [] }],
          },
    )
    onCuarto(id)
    setDesbloqueo(null)
    setSeleccion(null)
    avisar(`¡Nuevo cuarto: ${info.nombre}! ${info.emoji}`)
  }

  const pared = buscarPared(cuarto.pared)
  const piso = buscarPiso(cuarto.piso)
  const visibles = [...cuarto.muebles].sort((a, b) => a.y - b.y)
  const selMc = seleccion ? cuarto.muebles.find((x) => x.uid === seleccion) : undefined
  const selM = selMc ? buscarMueble(selMc.id) : undefined
  // Las claves con ":" son paredes y pisos comprados, no muebles.
  const inventario = Object.entries(partida.inventario).filter(([id, n]) => n > 0 && !id.includes(':'))
  const infoDesbloqueo = desbloqueo ? CUARTOS[desbloqueo] : null
  const fuerzaLuz = luz?.fuerzaLamparas ?? 0

  return (
    <div className="relative flex h-full w-full flex-col">
      <style>{CSS_CASA}</style>

      <div className="flex items-center gap-1.5 px-3 pt-2 sm:gap-2">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto sm:gap-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ORDEN_CUARTOS.map((id) => {
            const info = CUARTOS[id]
            const desbloqueado = partida.cuartos.some((c) => c.id === id)
            const activo = id === cuarto.id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (desbloqueado) {
                    onCuarto(id)
                    setSeleccion(null)
                    setDesbloqueo(null)
                  } else {
                    setDesbloqueo(id)
                  }
                }}
                aria-label={desbloqueado ? `Ir a ${info.nombre}` : `${info.nombre}, bloqueado`}
                aria-pressed={activo}
                className={`flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-extrabold shadow-sm transition active:scale-95 ${
                  activo
                    ? 'bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] text-white'
                    : 'bg-white/80 text-[#6b4a63]'
                }`}
              >
                <span aria-hidden>{info.emoji}</span>
                <span className={activo ? '' : 'hidden sm:inline'}>{info.nombre}</span>
                {!desbloqueado && <Lock className="h-3.5 w-3.5 opacity-70" />}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={tomarFoto}
          aria-label="Tomar foto del cuarto"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-[#6b4a63] shadow-sm transition active:scale-90"
        >
          <Camera className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setVerMascotas((v) => !v)}
          aria-label="Mascotas"
          aria-pressed={verMascotas}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-[#6b4a63] shadow-sm transition active:scale-90"
        >
          <PawPrint className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setModo((m) => (m === 'vista' ? 'decorar' : 'vista'))
            setSeleccion(null)
          }}
          aria-pressed={modo === 'decorar'}
          aria-label={modo === 'vista' ? 'Decorar' : 'Listo'}
          className={`flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-extrabold shadow-sm transition active:scale-95 ${
            modo === 'decorar' ? 'bg-[#6b4a63] text-white' : 'bg-white/80 text-[#6b4a63]'
          }`}
        >
          {modo === 'vista' ? <Palette className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          <span className="hidden sm:inline">{modo === 'vista' ? 'Decorar' : 'Listo'}</span>
        </button>
      </div>

      {infoDesbloqueo && desbloqueo && (
        <div className="mx-3 mt-2 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-md">
          <span className="text-2xl" aria-hidden>
            {infoDesbloqueo.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-[#6b4a63]">Cuarto {infoDesbloqueo.nombre}</p>
            <p className="text-xs text-[#a68aa0]">Cuesta {infoDesbloqueo.precio} 🪙 · Tienes {partida.monedas} 🪙</p>
          </div>
          <button
            type="button"
            onClick={() => desbloquear(desbloqueo)}
            disabled={partida.monedas < infoDesbloqueo.precio}
            className="h-11 rounded-2xl bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] px-4 text-sm font-extrabold text-white shadow-md transition active:scale-95 disabled:opacity-40"
          >
            Desbloquear
          </button>
          <button
            type="button"
            onClick={() => setDesbloqueo(null)}
            aria-label="Cancelar"
            className="h-11 w-11 rounded-2xl bg-[#fde7ef] text-[#6b4a63]"
          >
            ✕
          </button>
        </div>
      )}

      <div ref={contRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        {luz && (
          <span
            className="pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#6b4a63] shadow-sm max-h-[520px]:scale-90"
          >
            {EMOJI_MOMENTO[luz.momento]} {saludoPara(luz.momento)}
          </span>
        )}
        <div
          ref={roomRef}
          className="relative touch-none select-none overflow-hidden rounded-[32px] shadow-[0_18px_40px_-18px_rgba(107,74,99,0.45)] ring-4 ring-white/70"
          style={{ width: dim.w, height: dim.h }}
          onPointerDown={() => setSeleccion(null)}
          onPointerMove={onRoomPointerMove}
          onPointerUp={onRoomPointerUp}
          onPointerCancel={onRoomPointerUp}
        >
          {/* pared: textura suave, sombra en los bordes y en la parte de abajo */}
          <div className="absolute inset-x-0 top-0" style={{ height: HORIZONTE, background: pared.fondo }} />
          <div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{
              height: HORIZONTE,
              background:
                'radial-gradient(90% 80% at 50% 0%, rgba(255,255,255,0.32), rgba(255,255,255,0) 70%), linear-gradient(90deg, rgba(60,30,60,0.05), rgba(60,30,60,0) 12%, rgba(60,30,60,0) 88%, rgba(60,30,60,0.05))',
            }}
          />
          {/* ventana con luz de día y cortinas */}
          <div
            className="pointer-events-none absolute"
            style={{ left: '8%', top: '9%', width: '25%', height: '24%', zIndex: 2 }}
          >
            <div
              className="absolute inset-0 rounded-[18px] border-[6px] border-white shadow-[0_6px_16px_rgba(107,74,99,0.22)]"
              style={{
                background:
                  'linear-gradient(180deg, #cfeeff 0%, #e9f8ff 55%, #fff4d6 100%)',
                boxShadow: '0 0 34px rgba(255,246,214,0.85), inset 0 0 18px rgba(107,74,99,0.12)',
              }}
            />
            <div className="absolute left-1/2 top-[6%] bottom-[6%] w-[5px] -translate-x-1/2 rounded-full bg-white/90" />
            <div className="absolute inset-x-[6%] top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-white/90" />
            {/* nube suave */}
            <div className="absolute left-[14%] top-[18%] h-[14%] w-[30%] rounded-full bg-white/80" />
            <div className="absolute left-[24%] top-[12%] h-[12%] w-[18%] rounded-full bg-white/80" />
            {/* cortinas */}
            <div
              className="absolute -top-[10%] left-[-14%] h-[118%] w-[22%] rounded-b-[26px] rounded-t-md"
              style={{ background: 'linear-gradient(90deg, #ffb3c9, #ff8fb1 60%, #ffc2d6)', boxShadow: 'inset -6px 0 10px rgba(107,74,99,0.15)' }}
            />
            <div
              className="absolute -top-[10%] right-[-14%] h-[118%] w-[22%] rounded-b-[26px] rounded-t-md"
              style={{ background: 'linear-gradient(270deg, #ffb3c9, #ff8fb1 60%, #ffc2d6)', boxShadow: 'inset 6px 0 10px rgba(107,74,99,0.15)' }}
            />
            <div className="absolute -top-[13%] left-[-16%] right-[-16%] h-[4%] rounded-full bg-[#d9a77a]" />
          </div>
          {/* zócalo y moldura entre pared y piso */}
          <div
            className="absolute inset-x-0"
            style={{
              top: HORIZONTE,
              height: '4%',
              background: 'linear-gradient(180deg, #fffaf7 0%, #f7e6ee 60%, #efd2de 100%)',
              boxShadow: '0 2px 0 rgba(107,74,99,0.10)',
            }}
          />
          {/* piso con perspectiva: más claro al fondo, sombra en las esquinas */}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ top: `calc(${HORIZONTE} + 4%)`, background: piso.fondo }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              top: `calc(${HORIZONTE} + 4%)`,
              background:
                'radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.22), rgba(255,255,255,0) 60%), radial-gradient(70% 60% at 0% 100%, rgba(60,30,60,0.07), rgba(60,30,60,0) 70%), radial-gradient(70% 60% at 100% 100%, rgba(60,30,60,0.07), rgba(60,30,60,0) 70%)',
            }}
          />
          {/* textura sutil de tablones o de tejido */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 opacity-70"
            style={{
              top: `calc(${HORIZONTE} + 4%)`,
              background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 2px, rgba(255,255,255,0) 2px 9px)',
            }}
          />

          {/* muebles, ordenados por profundidad */}
          {visibles.map((mc) => {
            const m = buscarMueble(mc.id)
            if (!m) return null
            const sel = seleccion === mc.uid && modo === 'decorar'
            return (
              <div
                key={mc.uid}
                ref={(el) => {
                  if (el) muebleElRef.current.set(mc.uid, el)
                  else muebleElRef.current.delete(mc.uid)
                }}
                onPointerDown={(e) => onMueblePointerDown(e, mc)}
                role={modo === 'decorar' ? 'button' : undefined}
                aria-label={modo === 'decorar' ? `Mover ${m.nombre}` : undefined}
                className={`absolute ${modo === 'decorar' ? 'cursor-grab touch-none' : 'pointer-events-none'}`}
                style={{
                  left: `${mc.x * 100}%`,
                  top: `${mc.y * 100}%`,
                  width: `${m.ancho * 100}%`,
                  aspectRatio: `${m.ancho} / ${m.alto}`,
                  transform: 'translate(-50%, -100%)',
                  zIndex: Math.round(mc.y * 1000),
                  outline: sel ? '3px dashed #ff8fb1' : undefined,
                  outlineOffset: 4,
                  borderRadius: 14,
                }}
              >
                <div
                  key={rebote?.uid === mc.uid ? `r${rebote.n}` : 'quieto'}
                  className={`h-full w-full ${rebote?.uid === mc.uid ? 'nidito-aplasta' : ''}`}
                >
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="h-full w-full overflow-visible"
                    style={{ transform: mc.flip ? 'scaleX(-1)' : undefined }}
                    dangerouslySetInnerHTML={{ __html: m.svg }}
                  />
                </div>
              </div>
            )
          })}

          {/* ambiente vivo: lo que la pareja hace sola */}
          {ocio.map((o) => {
            const cab = `calc(${o.y * 100}% - ${Math.round(tam * 1.08)}px)`
            if (o.tipo === 'lee')
              return (
                <span key={o.id} className="nidito-burbuja pointer-events-none absolute text-2xl" style={{ left: `${o.x * 100}%`, top: cab, zIndex: 1650 }} aria-hidden>
                  📖
                </span>
              )
            if (o.tipo === 'bosteza')
              return (
                <span key={o.id} className="nidito-burbuja pointer-events-none absolute text-2xl" style={{ left: `${o.x * 100}%`, top: cab, zIndex: 1650 }} aria-hidden>
                  🥱
                </span>
              )
            if (o.tipo === 'estira')
              return (
                <span key={o.id} className="nidito-burbuja pointer-events-none absolute text-xl" style={{ left: `${o.x * 100}%`, top: cab, zIndex: 1650 }} aria-hidden>
                  ✨
                </span>
              )
            if (o.tipo === 'saluda')
              return (
                <span key={o.id} className="nidito-burbuja pointer-events-none absolute text-2xl" style={{ left: `${o.x * 100}%`, top: cab, zIndex: 1650 }} aria-hidden>
                  <span className="nidito-mano">👋</span>
                </span>
              )
            if (o.tipo === 'notas')
              return (
                <span key={o.id} aria-hidden>
                  <span className="nidito-sube pointer-events-none absolute text-xl" style={{ left: `calc(${o.x * 100}% + ${Math.round(tam * 0.3)}px)`, top: cab, zIndex: 1650 }}>
                    🎵
                  </span>
                  <span className="nidito-sube pointer-events-none absolute text-lg" style={{ left: `calc(${o.x * 100}% - ${Math.round(tam * 0.25)}px)`, top: `calc(${o.y * 100}% - ${Math.round(tam * 0.9)}px)`, zIndex: 1650, animationDelay: '0.5s' }}>
                    🎶
                  </span>
                </span>
              )
            // riega: la regadera junto a la pareja y gotas sobre la planta
            const { px, py } = o
            return (
              <span key={o.id} aria-hidden>
                <span className="nidito-burbuja pointer-events-none absolute text-2xl" style={{ left: `calc(${o.x * 100}% + ${Math.round(tam * 0.32)}px)`, top: cab, zIndex: 1650 }}>
                  🚿
                </span>
                {px !== undefined &&
                  py !== undefined &&
                  [0, 0.35, 0.7].map((d) => (
                    <span
                      key={`${o.id}-${d}`}
                      className="nidito-cae pointer-events-none absolute text-base"
                      style={{ left: `${px * 100}%`, top: `${(py - 0.12) * 100}%`, zIndex: 1650, animationDelay: `${d}s` }}
                    >
                      💧
                    </span>
                  ))}
              </span>
            )
          })}

          {/* Zzz sobre la cama cuando duermen */}
          {durmiendo &&
            cuarto.muebles
              .filter((c) => c.id === 'cama-doble')
              .map((c) => (
                <span key={`zzz-${c.uid}`} aria-hidden className="pointer-events-none absolute" style={{ left: `${c.x * 100}%`, top: `${(c.y - 0.22) * 100}%`, zIndex: 1650 }}>
                  <span className="nidito-zzz absolute text-lg font-extrabold text-[#6b4a63]" style={{ left: 0, top: 0 }}>Z</span>
                  <span className="nidito-zzz absolute text-base font-extrabold text-[#6b4a63]" style={{ left: 22, top: -12, animationDelay: '1.1s' }}>z</span>
                </span>
              ))}

          {/* gatito visitante en la ventana: tócalo para una sorpresa */}
          {gato && (
            <div className="absolute left-[12%] top-0 flex h-[33%] w-[17%] items-end" style={{ zIndex: 1450 }}>
              <button
                type="button"
                onClick={tocarGato}
                aria-label="Gatito visitante: tócalo"
                className="nidito-gato block w-full cursor-pointer border-0 bg-transparent p-0"
                key={gato.id}
              >
                <span className="nidito-gato-vivo block">
                  <GatitoSvg />
                </span>
              </button>
            </div>
          )}

          {/* lámparas encendidas al caer la tarde */}
          {fuerzaLuz > 0.05 &&
            cuarto.muebles.map((mc) => {
              const m = buscarMueble(mc.id)
              if (!m?.luz) return null
              return (
                <div
                  key={`luz-${mc.uid}`}
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    left: `${mc.x * 100}%`,
                    top: `${(mc.y - m.alto * ratio * 0.75) * 100}%`,
                    width: '34%',
                    aspectRatio: '1',
                    transform: 'translate(-50%, -50%)',
                    background:
                      'radial-gradient(circle, rgba(255,226,150,0.8) 0%, rgba(255,226,150,0.25) 45%, rgba(255,226,150,0) 70%)',
                    opacity: fuerzaLuz,
                    mixBlendMode: 'screen',
                    zIndex: 1200,
                  }}
                />
              )
            })}

          {/* pareja */}
          {partida.pareja.map((p, i) => {
            const a = parejaRef.current[i]
            if (!a) return null
            const anim =
              reacciones[i] ??
              (a.estado === 'duerme' ? 'dormido' : a.estado === 'abrazo' ? 'abrazo' : a.estado === 'sentado' ? 'feliz' : 'idle')
            const estirando = ocio.some((o) => o.i === i && o.tipo === 'estira')
            return (
              <div
                key={`pareja-${i}`}
                ref={(el) => {
                  elParejaRef.current[i] = el
                }}
                className="absolute left-0 top-0"
                style={{ pointerEvents: modo === 'vista' ? 'auto' : 'none' }}
              >
                <button
                  type="button"
                  onClick={() => tocarPareja(i)}
                  aria-label={`Tocar a ${p.nombre}`}
                  className="block cursor-pointer border-0 bg-transparent p-0"
                  style={{ transform: `translate(-50%, -100%) scaleX(${a.dir})` }}
                >
                  <div className="relative">
                    <span
                      className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/85 px-2 py-0.5 text-xs font-bold text-[#6b4a63] shadow-sm"
                      style={{ transform: `scaleX(${a.dir})` }}
                    >
                      {p.nombre}
                    </span>
                    <div
                      className={estirando ? 'nidito-estira' : a.estado === 'camina' ? 'nidito-camina' : undefined}
                      style={{
                        transform: a.estado === 'sentado' ? 'scaleY(0.94)' : undefined,
                        transformOrigin: '50% 100%',
                      }}
                    >
                      <Avatar look={p.look} size={tam} anim={anim} />
                    </div>
                  </div>
                </button>
              </div>
            )
          })}

          {/* mascotas */}
          {partida.mascotas.map((mp, i) => {
            const a = mascotasRef.current[i]
            if (!a) return null
            const clase = a.estado === 'comiendo' ? 'nidito-come' : a.estado === 'camina' ? 'nidito-camina' : undefined
            return (
              <div
                key={`mascota-${i}`}
                ref={(el) => {
                  elMascotaRef.current[i] = el
                }}
                className="absolute left-0 top-0"
                style={{ pointerEvents: modo === 'vista' ? 'auto' : 'none' }}
              >
                <button
                  type="button"
                  onClick={() => acariciarMascota(i)}
                  aria-label={`Acariciar a ${mp.nombre}`}
                  className="block cursor-pointer border-0 bg-transparent p-0"
                  style={{ transform: `translate(-50%, -100%) scaleX(${a.dir})` }}
                >
                  <div className="relative">
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/80 px-1.5 text-[11px] font-bold text-[#6b4a63]"
                      style={{ transform: `scaleX(${a.dir})` }}
                    >
                      {mp.nombre}
                    </span>
                    <div
                      className={clase}
                      style={{ transform: a.estado === 'sentado' ? 'scaleY(0.9)' : undefined, transformOrigin: '50% 100%' }}
                    >
                      <DibujoMascota tipo={mp.tipo} color={mp.color} size={tamMascota} />
                    </div>
                  </div>
                </button>
              </div>
            )
          })}

          {/* corazones que suben */}
          {corazones.map((c) => (
            <Heart
              key={c.id}
              aria-hidden
              className="nidito-sube pointer-events-none absolute h-7 w-7"
              style={{ left: c.x, top: c.y, color: '#ff8fb1', fill: '#ff8fb1', zIndex: 1700 }}
            />
          ))}

          {/* luz ambiental según la hora */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: luz?.color ?? 'transparent', transition: 'background 2s ease', zIndex: 1500 }}
          />
          {/* destello de la cámara */}
          {flash > 0 && (
            <div
              key={flash}
              aria-hidden
              className="nidito-destello pointer-events-none absolute inset-0 rounded-[32px] bg-white"
              style={{ zIndex: 1900 }}
            />
          )}
          <div
            className="pointer-events-none absolute inset-0 rounded-[32px]"
            style={{ boxShadow: 'inset 0 0 40px rgba(107,74,99,0.12)', zIndex: 1550 }}
          />
        </div>

        {verMascotas && (
          <PanelMascotas
            partida={partida}
            actualizar={actualizar}
            avisar={avisar}
            onAlimentar={alimentarMascota}
            onCerrar={() => setVerMascotas(false)}
          />
        )}
      </div>

      {modo === 'decorar' ? (
        <div className="shrink-0 space-y-2 px-3 pb-3 pt-2">
          {selMc && selM ? (
            <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-md">
              <span className="min-w-0 flex-1 truncate px-1 text-sm font-extrabold text-[#6b4a63]">{selM.nombre}</span>
              <button
                type="button"
                onClick={() => girar(selMc.uid)}
                aria-label="Girar mueble"
                className="flex h-11 items-center gap-1.5 rounded-xl bg-[#ffe6ef] px-3 text-sm font-bold text-[#6b4a63] transition active:scale-95"
              >
                <FlipHorizontal className="h-4 w-4" /> Girar
              </button>
              <button
                type="button"
                onClick={() => guardarMueble(selMc.uid)}
                aria-label="Guardar en el inventario"
                className="flex h-11 items-center gap-1.5 rounded-xl bg-[#e4dcff] px-3 text-sm font-bold text-[#4b3a7a] transition active:scale-95"
              >
                <Package className="h-4 w-4" /> Guardar
              </button>
            </div>
          ) : (
            <p className="px-1 text-xs font-semibold text-[#a68aa0]">
              Arrastra un mueble para moverlo. Toca uno para girarlo o guardarlo.
            </p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {inventario.length === 0 && (
              <p className="px-1 text-xs text-[#a68aa0]">Tu inventario está vacío. Compra muebles en la Tienda.</p>
            )}
            {inventario.map(([id, n]) => {
              const m = buscarMueble(id)
              if (!m) return null
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => colocar(id)}
                  aria-label={`Poner ${m.nombre} en el cuarto`}
                  className="flex w-24 shrink-0 flex-col items-center rounded-2xl bg-white p-1.5 shadow-sm transition active:scale-95"
                >
                  <svg viewBox="0 0 100 100" className="h-14 w-14" dangerouslySetInnerHTML={{ __html: m.svg }} />
                  <span className="w-full truncate text-center text-[11px] font-bold text-[#6b4a63]">{m.nombre}</span>
                  <span className="rounded-full bg-[#ffd9e6] px-1.5 text-[10px] font-extrabold text-[#6b4a63]">×{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="shrink-0 px-3 pb-2 pt-1 text-center text-xs font-semibold text-[#a68aa0] max-h-[520px]:hidden">
          Toca a tu pareja para hacerles cariño 💕
        </p>
      )}
    </div>
  )
}
