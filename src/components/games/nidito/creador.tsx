'use client'

import { useState } from 'react'
import type { Look, Personaje } from './types'
import { Avatar } from './avatar'
import { COLORES_OJOS, COLORES_PELO, LOOK_BASE, OJOS, PEINADOS, TONOS_PIEL } from './wardrobe-data'

const NOMBRES_BASE: [string, string] = ['Ella', 'Él']

function personaBase(nombre: string): Personaje {
  return { nombre, look: { ...LOOK_BASE, ropa: { ...LOOK_BASE.ropa } } }
}

function copiaPar(inicial?: [Personaje, Personaje]): [Personaje, Personaje] {
  if (inicial) {
    return [
      { nombre: inicial[0].nombre, look: { ...inicial[0].look, ropa: { ...inicial[0].look.ropa } } },
      { nombre: inicial[1].nombre, look: { ...inicial[1].look, ropa: { ...inicial[1].look.ropa } } },
    ]
  }
  return [personaBase(NOMBRES_BASE[0]), personaBase(NOMBRES_BASE[1])]
}

function Muestra({
  hex,
  activo,
  etiqueta,
  onClick,
}: {
  hex: string
  activo: boolean
  etiqueta: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={activo}
      title={etiqueta}
      className={`h-11 w-11 shrink-0 rounded-full border-4 shadow-sm transition-transform active:scale-90 ${
        activo ? 'scale-110 border-white ring-4 ring-pink-300' : 'border-white/80'
      }`}
      style={{ backgroundColor: hex }}
    />
  )
}

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-semibold transition-all active:scale-95 ${
        activo
          ? 'bg-pink-400 text-white shadow-md shadow-pink-200'
          : 'bg-white text-rose-700 shadow-sm ring-1 ring-rose-100 hover:bg-rose-50'
      }`}
    >
      {children}
    </button>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">{titulo}</h3>
      {children}
    </section>
  )
}

export function Creador({
  inicial,
  onListo,
}: {
  inicial?: [Personaje, Personaje]
  onListo: (p: [Personaje, Personaje]) => void
}) {
  const [par, setPar] = useState<[Personaje, Personaje]>(() => copiaPar(inicial))
  const [activa, setActiva] = useState<0 | 1>(0)
  const persona = par[activa]
  const look = persona.look

  function cambiaLook(cambios: Partial<Look>) {
    setPar((prev) => {
      const copia: [Personaje, Personaje] = [prev[0], prev[1]]
      copia[activa] = { ...prev[activa], look: { ...prev[activa].look, ...cambios } }
      return copia
    })
  }

  function cambiaNombre(nombre: string) {
    setPar((prev) => {
      const copia: [Personaje, Personaje] = [prev[0], prev[1]]
      copia[activa] = { ...prev[activa], nombre }
      return copia
    })
  }

  const listo = par[0].nombre.trim().length > 0 && par[1].nombre.trim().length > 0

  return (
    <div className="flex h-full w-full flex-col bg-gradient-to-b from-rose-50 via-pink-50 to-violet-50 text-rose-900">
      <header className="px-5 pb-1 pt-5 text-center">
        <h1 className="text-2xl font-black tracking-tight text-rose-600">Crea a su pareja</h1>
        <p className="text-sm text-rose-400">Dales cara, pelo y mucho amor</p>
      </header>

      {/* Selector de personaje */}
      <div className="flex justify-center gap-2 px-4 pb-2" role="tablist" aria-label="Personaje a editar">
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
            {par[i].nombre.trim() || `Persona ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Vista previa grande */}
      <div className="flex min-h-0 shrink-0 items-center justify-center px-4 pb-2">
        <div className="relative flex h-[190px] w-full max-w-[260px] items-end justify-center rounded-[2rem] bg-white/70 shadow-inner shadow-rose-100 sm:h-[230px]">
          <Avatar look={look} size={150} anim="idle" />
        </div>
      </div>

      {/* Opciones (scroll interno) */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-4 pt-2">
        <Seccion titulo="Nombre">
          <input
            value={persona.nombre}
            onChange={(e) => cambiaNombre(e.target.value.slice(0, 14))}
            aria-label="Nombre del personaje"
            placeholder="¿Cómo se llama?"
            className="min-h-11 w-full rounded-2xl border-0 bg-white px-4 text-base font-semibold text-rose-800 shadow-sm ring-1 ring-rose-100 outline-none focus:ring-2 focus:ring-pink-300"
          />
        </Seccion>

        <Seccion titulo="Tono de piel">
          <div className="flex flex-wrap gap-2.5">
            {TONOS_PIEL.map((t) => (
              <Muestra
                key={t.id}
                hex={t.hex}
                etiqueta={`Piel ${t.nombre}`}
                activo={look.piel === t.hex}
                onClick={() => cambiaLook({ piel: t.hex })}
              />
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Peinado">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {PEINADOS.map((p) => (
              <Chip key={p.id} activo={look.pelo === p.id} onClick={() => cambiaLook({ pelo: p.id })}>
                {p.nombre}
              </Chip>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Color de pelo">
          <div className="flex flex-wrap gap-2.5">
            {COLORES_PELO.map((c) => (
              <Muestra
                key={c.id}
                hex={c.hex}
                etiqueta={`Pelo ${c.nombre}`}
                activo={look.colorPelo === c.hex}
                onClick={() => cambiaLook({ colorPelo: c.hex })}
              />
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Ojos">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {OJOS.map((o) => (
              <Chip key={o.id} activo={look.ojos === o.id} onClick={() => cambiaLook({ ojos: o.id })}>
                {o.nombre}
              </Chip>
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Color de ojos">
          <div className="flex flex-wrap gap-2.5">
            {COLORES_OJOS.map((c) => (
              <Muestra
                key={c.id}
                hex={c.hex}
                etiqueta={`Ojos ${c.nombre}`}
                activo={look.colorOjos === c.hex}
                onClick={() => cambiaLook({ colorOjos: c.hex })}
              />
            ))}
          </div>
        </Seccion>

        <Seccion titulo="Mejillas">
          <Chip activo={look.rubor} onClick={() => cambiaLook({ rubor: !look.rubor })}>
            {look.rubor ? 'Con rubor' : 'Sin rubor'}
          </Chip>
        </Seccion>
      </div>

      <div className="shrink-0 px-5 pb-6 pt-2">
        <button
          type="button"
          disabled={!listo}
          onClick={() => onListo(par)}
          className="min-h-14 w-full rounded-3xl bg-gradient-to-r from-pink-400 to-rose-400 text-lg font-black text-white shadow-lg shadow-pink-200 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          ¡Listo, a vivir juntitos!
        </button>
      </div>
    </div>
  )
}
