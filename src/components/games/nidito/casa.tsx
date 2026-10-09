'use client'

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, FlipHorizontal, Heart, Lock, Package, PawPrint, Palette } from 'lucide-react'
import { Avatar } from './avatar'
import { DibujoMascota, PanelMascotas } from './mascotas'
import { nivelDeCorazones, nuevoUid, sumarInventario, type Actualizar } from './guardado'
import { CUARTOS, buscarMueble, buscarPared, buscarPiso } from './muebles-data'
import {
  construirMundo,
  crearActor,
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
import type { CuartoId, MuebleColocado, Partida } from './types'
import { tone } from '../sfx'

export interface CasaProps {
  partida: Partida
  actualizar: Actualizar
  cuartoId: CuartoId
  onCuarto: (id: CuartoId) => void
  avisar: (texto: string) => void
}

type Reaccion = 'feliz' | 'abrazo' | 'beso'
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
const HORIZONTE = '62%'

const CSS_CASA = `
@keyframes nidito-rebota { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
@keyframes nidito-sube { 0% { opacity: 0; transform: translate(-50%, 0) scale(0.6) } 15% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -70px) scale(1.15) } }
@keyframes nidito-cola { 0%, 100% { transform: rotate(-12deg) } 50% { transform: rotate(14deg) } }
.nidito-camina { animation: nidito-rebota 0.55s ease-in-out infinite; }
.nidito-come { animation: nidito-rebota 0.3s ease-in-out infinite; }
.nidito-cola { animation: nidito-cola 1.1s ease-in-out infinite; }
.nidito-sube { animation: nidito-sube 1.3s ease-out forwards; }
@media (prefers-reduced-motion: reduce) {
  .nidito-camina, .nidito-come, .nidito-cola { animation: none; }
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
      const p1 = puntoLibre(m, Math.random)
      parejaRef.current = [crearActor(p0.x, p0.y, 0.12), crearActor(p1.x, p1.y, 0.12)]
    } else {
      for (const a of parejaRef.current) {
        const p = puntoLibre(m, Math.random)
        irA(a, m, p.x, p.y)
      }
    }
    for (const a of mascotasRef.current) {
      const p = puntoLibre(m, Math.random)
      irA(a, m, p.x, p.y)
    }
  }, [colocados, ratio])

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
            irAAbrazo(a, m, mx - 0.05, my)
            irAAbrazo(b, m, mx + 0.05, my)
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
      return { ...p, corazones: corazonesNuevos, nivelAmor: nivelDeCorazones(corazonesNuevos) }
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
    actualizar((p) => ({
      ...p,
      mascotas: p.mascotas.map((m, j) => (j === i ? { ...m, felicidad: Math.min(100, m.felicidad + 3) } : m)),
    }))
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
    const mc: MuebleColocado = { uid: nuevoUid(), id, x: 0.5, y: m.colgado ? 0.42 : 0.84, flip: false }
    actualizar((p) => ({
      ...p,
      inventario: sumarInventario(p.inventario, id, -1),
      cuartos: p.cuartos.map((c) => (c.id === cuartoId ? { ...c, muebles: [...c.muebles, mc] } : c)),
    }))
    setSeleccion(mc.uid)
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
      ? Math.min(0.6, Math.max(0.18, a.y0 + py / d.h))
      : Math.min(0.98, Math.max(0.66, a.y0 + py / d.h))
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

      <div className="flex items-center gap-2 px-3 pt-2">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                {info.nombre}
                {!desbloqueado && <Lock className="h-3.5 w-3.5 opacity-70" />}
              </button>
            )
          })}
        </div>
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
          className={`flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-extrabold shadow-sm transition active:scale-95 ${
            modo === 'decorar' ? 'bg-[#6b4a63] text-white' : 'bg-white/80 text-[#6b4a63]'
          }`}
        >
          {modo === 'vista' ? <Palette className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {modo === 'vista' ? 'Decorar' : 'Listo'}
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
        <div
          ref={roomRef}
          className="relative touch-none select-none overflow-hidden rounded-[32px] shadow-[0_18px_40px_-18px_rgba(107,74,99,0.45)] ring-4 ring-white/70"
          style={{ width: dim.w, height: dim.h }}
          onPointerDown={() => setSeleccion(null)}
          onPointerMove={onRoomPointerMove}
          onPointerUp={onRoomPointerUp}
          onPointerCancel={onRoomPointerUp}
        >
          {/* pared */}
          <div className="absolute inset-x-0 top-0" style={{ height: HORIZONTE, background: pared.fondo }} />
          {/* friso del horizonte */}
          <div
            className="absolute inset-x-0"
            style={{ top: HORIZONTE, height: 6, background: 'rgba(255,255,255,0.6)', boxShadow: '0 2px 0 rgba(107,74,99,0.08)' }}
          />
          {/* piso */}
          <div className="absolute inset-x-0 bottom-0" style={{ top: `calc(${HORIZONTE} + 6px)`, background: piso.fondo }} />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              top: `calc(${HORIZONTE} + 6px)`,
              background: 'linear-gradient(rgba(255,255,255,0.14), rgba(60,30,60,0.14))',
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
                <svg
                  viewBox="0 0 100 100"
                  className="h-full w-full overflow-visible"
                  style={{ transform: mc.flip ? 'scaleX(-1)' : undefined }}
                  dangerouslySetInnerHTML={{ __html: m.svg }}
                />
              </div>
            )
          })}

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
            const anim = reacciones[i] ?? (a.estado === 'abrazo' ? 'abrazo' : a.estado === 'sentado' ? 'feliz' : 'idle')
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
                      className={a.estado === 'camina' ? 'nidito-camina' : undefined}
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
          <div
            className="pointer-events-none absolute inset-0 rounded-[32px]"
            style={{ boxShadow: 'inset 0 0 40px rgba(107,74,99,0.12)', zIndex: 1550 }}
          />
          {luz && (
            <span
              className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/75 px-3 py-1 text-xs font-bold text-[#6b4a63] shadow-sm"
              style={{ zIndex: 1600 }}
            >
              {EMOJI_MOMENTO[luz.momento]} {saludoPara(luz.momento)}
            </span>
          )}
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
        <p className="shrink-0 px-3 pb-2 pt-1 text-center text-xs font-semibold text-[#a68aa0]">
          Toca a tu pareja para hacerles cariño 💕
        </p>
      )}
    </div>
  )
}
