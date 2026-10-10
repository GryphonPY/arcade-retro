'use client'

import { Coins, Shirt, X } from 'lucide-react'
import { useState } from 'react'
import type { Partida, Personaje, SlotRopa } from './types'
import { Avatar } from './avatar'
import { NOMBRE_SLOT, PRENDAS_POR_SLOT, type Prenda, type GeneroPrenda } from './wardrobe-data'
import type { Genero } from './types'
import { tone } from '../sfx'
import { aplicarAccion } from './tareas'

const SLOTS: SlotRopa[] = ['arriba', 'abajo', 'zapatos', 'accesorio', 'pijama']

function estaComprada(partida: Partida, p: Prenda): boolean {
  return p.precio === 0 || partida.ropaComprada.includes(p.id)
}

export function Armario({
  partida,
  onCambio,
}: {
  partida: Partida
  onCambio: (p: Partida) => void
}) {
  const [activa, setActiva] = useState<0 | 1>(0)
  const [slot, setSlot] = useState<SlotRopa>('arriba')
  const [aviso, setAviso] = useState<string | null>(null)

  const persona: Personaje = partida.pareja[activa]
  // Primero las del género del personaje, luego las "ambos" y al final las demás (no se prohíbe nada).
  const generoPersona: Genero = persona.look.genero ?? (activa === 0 ? 'chica' : 'chico')
  const rango = (g: GeneroPrenda | undefined) => (g === generoPersona ? 0 : (g ?? 'ambos') === 'ambos' ? 1 : 2)
  const prendas = [...PRENDAS_POR_SLOT[slot]].sort((a, b) => rango(a.genero) - rango(b.genero))

  /** Devuelve una partida nueva con la prenda puesta en el espacio actual de la persona activa. */
  function ponerEnEspacio(id: string | null, extra?: Partial<Partida>): Partida {
    const pareja = [...partida.pareja] as [Personaje, Personaje]
    const ropa = { ...pareja[activa].look.ropa }
    if (id === null) delete ropa[slot]
    else ropa[slot] = id
    pareja[activa] = { ...pareja[activa], look: { ...pareja[activa].look, ropa } }
    return { ...partida, ...extra, pareja }
  }

  function alElegir(p: Prenda) {
    const puesta = persona.look.ropa[slot] === p.id
    if (puesta) return
    if (estaComprada(partida, p)) {
      onCambio(aplicarAccion(ponerEnEspacio(p.id), `atuendo:${activa}`, 1))
      tone({ freq: 660, to: 990, dur: 0.12, type: 'triangle', vol: 0.05 })
      setAviso(null)
      return
    }
    if (partida.monedas < p.precio) {
      setAviso(`Te faltan ${p.precio - partida.monedas} monedas para ${p.nombre}.`)
      tone({ freq: 220, dur: 0.12, type: 'sine', vol: 0.04 })
      return
    }
    onCambio(
      aplicarAccion(
        ponerEnEspacio(p.id, {
          monedas: partida.monedas - p.precio,
          ropaComprada: [...partida.ropaComprada, p.id],
        }),
        `atuendo:${activa}`,
        1,
      ),
    )
    tone({ freq: 523, to: 1046, dur: 0.18, type: 'triangle', vol: 0.06 })
    setAviso(`¡Nuevo! ${p.nombre} es suyo.`)
  }

  const esPijama = slot === 'pijama'

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-violet-50 via-rose-50 to-amber-50 text-rose-900">
      <header className="flex items-center justify-between px-5 pb-1 pt-4">
        <h1 className="text-xl font-black text-rose-600">Armario</h1>
        <div
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-amber-600 shadow-sm"
          aria-label={`${partida.monedas} monedas`}
        >
          <Coins size={16} aria-hidden />
          {partida.monedas}
        </div>
      </header>

      {/* Persona a vestir */}
      <div className="flex justify-center gap-2 px-4 pb-2" role="tablist" aria-label="Persona a vestir">
        {([0, 1] as const).map((i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={activa === i}
            onClick={() => setActiva(i)}
            className={`min-h-11 flex-1 max-w-[180px] rounded-2xl px-4 text-sm font-bold transition-all ${
              activa === i ? 'bg-rose-400 text-white shadow-lg shadow-rose-200' : 'bg-white/80 text-rose-500 shadow-sm'
            }`}
          >
            {partida.pareja[i].nombre}
          </button>
        ))}
      </div>

      {/* Vista previa */}
      <div className="flex shrink-0 justify-center px-4 pb-2">
        <div className="flex h-[200px] w-full max-w-[260px] items-end justify-center rounded-[2rem] bg-white/70 shadow-inner shadow-rose-100 sm:h-[240px]">
          <Avatar look={persona.look} size={160} anim={esPijama ? 'dormido' : 'idle'} />
        </div>
      </div>

      {/* Espacios de ropa */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="Espacio de ropa">
        {SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={slot === s}
            onClick={() => {
              setSlot(s)
              setAviso(null)
            }}
            className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-bold transition-all active:scale-95 ${
              slot === s ? 'bg-violet-400 text-white shadow-md shadow-violet-200' : 'bg-white text-violet-500 shadow-sm'
            }`}
          >
            {NOMBRE_SLOT[s]}
          </button>
        ))}
      </div>

      {/* Lista de prendas (scroll interno) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => onCambio(ponerEnEspacio(null))}
            disabled={!persona.look.ropa[slot]}
            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-white p-3 text-sm font-bold text-rose-500 shadow-sm ring-1 ring-rose-100 transition-all active:scale-95 disabled:opacity-40"
          >
            <X size={16} aria-hidden />
            Quitar
          </button>
          {prendas.map((p) => {
            const puesta = persona.look.ropa[slot] === p.id
            const comprada = estaComprada(partida, p)
            const alcanza = partida.monedas >= p.precio
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => alElegir(p)}
                aria-pressed={puesta}
                aria-label={`${p.nombre}, ${comprada ? 'disponible' : `${p.precio} monedas`}`}
                className={`flex min-h-16 flex-col items-start gap-1.5 rounded-2xl p-3 text-left shadow-sm ring-1 transition-all active:scale-95 ${
                  puesta ? 'bg-white ring-2 ring-violet-400' : 'bg-white/90 ring-rose-100 hover:bg-white'
                } ${!comprada && !alcanza ? 'opacity-60' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-7 w-7 shrink-0 rounded-full border-2 border-white shadow"
                    style={{ background: `linear-gradient(135deg, ${p.color} 50%, ${p.acento} 50%)` }}
                  />
                  <span className="text-sm font-bold leading-tight text-rose-800">{p.nombre}</span>
                </span>
                <span className="text-xs font-semibold text-rose-400">
                  {puesta ? 'Puesta' : comprada ? 'Tuya' : (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Coins size={12} aria-hidden />
                      {p.precio}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        {prendas.length === 0 ? (
          <p className="flex items-center gap-2 p-4 text-sm text-rose-400">
            <Shirt size={16} aria-hidden /> Nada por aquí todavía.
          </p>
        ) : null}
      </div>

      <div className="shrink-0 px-4 pb-4 pt-1 text-center text-sm font-semibold text-rose-500" aria-live="polite">
        {aviso ?? ''}
      </div>
    </div>
  )
}
