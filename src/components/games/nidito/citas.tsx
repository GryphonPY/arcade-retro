'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Avatar } from './avatar'
import { nivelDeCorazones, type Actualizar } from './guardado'
import { aplicarAccion } from './tareas'
import type { Partida } from './types'

export interface CitasProps {
  partida: Partida
  actualizar: Actualizar
  avisar: (texto: string) => void
}

interface Lugar {
  id: string
  nombre: string
  emoji: string
  precio: number
  corazones: number
  fondo: string
  decor: string[]
  frase: string
}

const LUGARES: Lugar[] = [
  {
    id: 'parque',
    nombre: 'Parque',
    emoji: '🌳',
    precio: 20,
    corazones: 6,
    fondo: 'linear-gradient(#bfe9ff 0%, #e8fbff 44%, #bfeaa8 45%, #8fd69a 100%)',
    decor: ['🌸', '🌳', '🦋', '🌼', '☁️'],
    frase: 'Pasto suave y un día de picnic',
  },
  {
    id: 'playa',
    nombre: 'Playa',
    emoji: '🏖️',
    precio: 40,
    corazones: 9,
    fondo: 'linear-gradient(#8fd3ff 0%, #d7f4ff 40%, #7fd0f2 41%, #5fb8e6 58%, #ffe3b0 59%, #ffd69a 100%)',
    decor: ['🌊', '🐚', '☀️', '🐠', '⛱️'],
    frase: 'Olas, arena y el sol de la tarde',
  },
  {
    id: 'cine',
    nombre: 'Cine',
    emoji: '🎬',
    precio: 35,
    corazones: 8,
    fondo: 'linear-gradient(#2a2146, #4b3a7a)',
    decor: ['🍿', '⭐', '🎞️', '🌙', '✨'],
    frase: 'Palomitas compartidas en la oscuridad',
  },
  {
    id: 'cafecito',
    nombre: 'Cafecito',
    emoji: '☕',
    precio: 15,
    corazones: 5,
    fondo: 'linear-gradient(#ffe9dc, #ffd0b5)',
    decor: ['🧁', '☕', '🌷', '🍰', '💕'],
    frase: 'Charla tranquila con pastelitos',
  },
  {
    id: 'feria',
    nombre: 'Feria',
    emoji: '🎡',
    precio: 50,
    corazones: 11,
    fondo: 'linear-gradient(#ffd6f0, #c9b8ff 70%, #9d8be0)',
    decor: ['🎈', '🎠', '🍭', '⭐', '🎪'],
    frase: 'Rueda de la fortuna y algodón de azúcar',
  },
  {
    id: 'mirador',
    nombre: 'Mirador nocturno',
    emoji: '🌙',
    precio: 60,
    corazones: 13,
    fondo: 'linear-gradient(#1f1b4a, #3e3080 70%, #2b2360)',
    decor: ['🌟', '🌙', '✨', '🌠', '💫'],
    frase: 'Estrellas, ciudad de luces y mucho cariño',
  },
]

type Fase = 'llegan' | 'juntos' | 'disfrutan' | 'despedida' | 'fin'

const CSS_CITAS = `
@keyframes nidito-flota { 0%, 100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-10px) rotate(4deg) } }
@keyframes nidito-cae { 0% { opacity: 0; transform: translateY(-20px) scale(0.6) } 15% { opacity: 1 } 100% { opacity: 0; transform: translateY(260px) scale(1.1) } }
.nidito-flota { animation: nidito-flota 3.4s ease-in-out infinite; }
.nidito-cae { animation: nidito-cae 2.4s ease-in forwards; }
@media (prefers-reduced-motion: reduce) { .nidito-flota { animation: none; } }
`

/** Escena corta: la pareja llega, pasea, se despide con un abrazo y gana corazones. */
function Escena({
  lugar,
  partida,
  onVolver,
}: {
  lugar: Lugar
  partida: Partida
  onVolver: () => void
}) {
  const [fase, setFase] = useState<Fase>('llegan')
  const [ancho, setAncho] = useState(0)
  const [lluvia, setLluvia] = useState<Array<{ id: number; x: number }>>([])
  const contRef = useRef<HTMLDivElement | null>(null)
  const idRef = useRef(0)

  useLayoutEffect(() => {
    const el = contRef.current
    if (!el) return
    const medir = () => setAncho(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Las fases avanzan solas; "fin" ya no retrocede aunque se salte.
  useEffect(() => {
    const avanzar = (siguiente: Fase) => setFase((f) => (f === 'fin' ? f : siguiente))
    const ts = [
      window.setTimeout(() => avanzar('juntos'), 250),
      window.setTimeout(() => avanzar('disfrutan'), 2200),
      window.setTimeout(() => avanzar('despedida'), 5000),
      window.setTimeout(() => avanzar('fin'), 7600),
    ]
    return () => ts.forEach((t) => window.clearTimeout(t))
  }, [])

  // Corazones que caen mientras están juntos.
  useEffect(() => {
    if (fase !== 'disfrutan' && fase !== 'despedida') return
    const t = window.setInterval(() => {
      const id = ++idRef.current
      const x = 20 + Math.random() * 60
      setLluvia((l) => [...l.slice(-14), { id, x }])
      window.setTimeout(() => setLluvia((l) => l.filter((k) => k.id !== id)), 2500)
    }, 380)
    return () => window.clearInterval(t)
  }, [fase])

  const tam = Math.round(Math.min(180, Math.max(96, ancho * 0.22)))
  const juntos = fase !== 'llegan'
  const abrazan = fase === 'despedida' || fase === 'fin'
  const izq = !juntos ? -20 : abrazan ? 44 : 38
  const der = !juntos ? 120 : abrazan ? 56 : 62
  const animPareja = fase === 'llegan' ? 'idle' : fase === 'despedida' || fase === 'fin' ? 'abrazo' : 'feliz'

  return (
    <div
      ref={contRef}
      className="absolute inset-0 z-40 overflow-hidden"
      style={{ background: lugar.fondo }}
      role="dialog"
      aria-label={`Cita en ${lugar.nombre}`}
    >
      <style>{CSS_CITAS}</style>

      {lugar.decor.map((e, i) => (
        <span
          key={i}
          aria-hidden
          className="nidito-flota pointer-events-none absolute select-none text-3xl"
          style={{
            left: `${(i * 37 + 8) % 86}%`,
            top: `${(i * 23 + 6) % 44}%`,
            animationDelay: `${i * 0.4}s`,
            opacity: 0.9,
          }}
        >
          {e}
        </span>
      ))}

      {lluvia.map((c) => (
        <span
          key={c.id}
          aria-hidden
          className="nidito-cae pointer-events-none absolute top-[18%] text-2xl"
          style={{ left: `${c.x}%` }}
        >
          💕
        </span>
      ))}

      {partida.pareja.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${i === 0 ? izq : der}%`,
            top: '74%',
            transform: 'translate(-50%, -100%)',
            transition: 'left 1.8s ease-out',
          }}
        >
          <Avatar look={p.look} size={tam} anim={animPareja} />
        </div>
      ))}

      {/* suelo sombreado para dar profundidad */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%]"
        style={{ background: 'linear-gradient(rgba(255,255,255,0), rgba(60,30,60,0.12))' }}
      />

      <div className="absolute inset-x-0 top-3 flex items-start justify-between gap-2 px-3">
        <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold text-[#6b4a63] shadow-sm">
          {lugar.emoji} {lugar.nombre}
        </span>
        {fase !== 'fin' && (
          <button
            type="button"
            onClick={() => setFase('fin')}
            className="h-10 rounded-2xl bg-white/80 px-3 text-sm font-bold text-[#6b4a63] shadow-sm transition active:scale-95"
          >
            Saltar
          </button>
        )}
      </div>

      {fase === 'fin' && (
        <div className="absolute inset-x-4 bottom-6 mx-auto flex max-w-sm flex-col items-center gap-3 rounded-[28px] bg-white/95 p-5 text-center shadow-2xl">
          <p className="text-lg font-extrabold text-[#6b4a63]">¡Qué linda cita! 💕</p>
          <p className="text-sm text-[#8a6b82]">{lugar.frase}</p>
          <p className="rounded-full bg-[#ffd9e6] px-4 py-1 text-sm font-extrabold text-[#6b4a63]">
            +{lugar.corazones} corazones
          </p>
          <button
            type="button"
            onClick={onVolver}
            className="h-12 w-full rounded-2xl bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] text-base font-extrabold text-white shadow-md transition active:scale-95"
          >
            Volver a casa
          </button>
        </div>
      )}
    </div>
  )
}

export function Citas({ partida, actualizar, avisar }: CitasProps) {
  const [escena, setEscena] = useState<Lugar | null>(null)

  const empezar = (l: Lugar) => {
    if (partida.monedas < l.precio) {
      avisar('Te faltan monedas para esta cita')
      return
    }
    actualizar((p) => ({ ...p, monedas: p.monedas - l.precio }))
    setEscena(l)
  }

  const terminar = (l: Lugar) => {
    const nuevoNivel = nivelDeCorazones(partida.corazones + l.corazones)
    actualizar((p) => {
      const corazones = p.corazones + l.corazones
      return aplicarAccion(
        {
          ...p,
          corazones,
          nivelAmor: nivelDeCorazones(corazones),
          citasHechas: { ...p.citasHechas, [l.id]: (p.citasHechas[l.id] ?? 0) + 1 },
        },
        'cita',
        1,
      )
    })
    if (nuevoNivel > partida.nivelAmor) avisar(`¡Nivel de amor ${nuevoNivel}! 💕`)
    else avisar(`+${l.corazones} corazones 💕`)
    setEscena(null)
  }

  if (escena) {
    return (
      <div className="relative h-full w-full">
        <Escena key={escena.id} lugar={escena} partida={partida} onVolver={() => terminar(escena)} />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-4 pt-3">
        <h2 className="text-xl font-extrabold text-[#6b4a63]">Citas 💕</h2>
        <p className="text-xs font-semibold text-[#a68aa0]">Elige a dónde llevar a tu pareja. Cada cita da corazones.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LUGARES.map((l) => {
            const veces = partida.citasHechas[l.id] ?? 0
            const puede = partida.monedas >= l.precio
            return (
              <div key={l.id} className="flex flex-col rounded-3xl bg-white/90 p-3 shadow-sm">
                <div
                  className="flex h-24 items-center justify-center rounded-2xl text-5xl shadow-inner"
                  style={{ background: l.fondo }}
                  aria-hidden
                >
                  {l.emoji}
                </div>
                <p className="mt-2 text-sm font-extrabold text-[#6b4a63]">{l.nombre}</p>
                <p className="line-clamp-2 min-h-[2.5rem] text-xs text-[#a68aa0]">{l.frase}</p>
                <div className="mt-1 flex items-center gap-2 text-xs font-bold">
                  <span className="rounded-full bg-[#fff1c9] px-2 py-0.5 text-[#8a6b2a]">−{l.precio} 🪙</span>
                  <span className="rounded-full bg-[#ffd9e6] px-2 py-0.5 text-[#8a3b5c]">+{l.corazones} 💕</span>
                </div>
                <p className="mt-1 text-[11px] text-[#a68aa0]">{veces > 0 ? `Han ido ${veces} ${veces === 1 ? 'vez' : 'veces'}` : 'Aún no han ido'}</p>
                <button
                  type="button"
                  onClick={() => empezar(l)}
                  disabled={!puede}
                  className="mt-auto h-11 w-full rounded-2xl bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] text-sm font-extrabold text-white shadow-md transition active:scale-95 disabled:opacity-40"
                >
                  ¡Vamos!
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
