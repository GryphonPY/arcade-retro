'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { sfx } from '../sfx'
import { sumarInventario, type Actualizar } from './guardado'
import { CUARTOS, MUEBLES, PAREDES, PISOS, type Mueble, type Superficie } from './muebles-data'
import type { CuartoId, Partida } from './types'

export interface TiendaProps {
  partida: Partida
  actualizar: Actualizar
  cuartoId: CuartoId
  avisar: (texto: string) => void
}

type Categoria = CuartoId | 'paredes' | 'pisos'

const CATEGORIAS = Object.keys(CUARTOS) as CuartoId[]

/** Cuántas unidades de un mueble hay colocadas en algún cuarto. */
function colocadosDe(partida: Partida, id: string): number {
  let n = 0
  for (const c of partida.cuartos) for (const m of c.muebles) if (m.id === id) n++
  return n
}

export function Tienda({ partida, actualizar, cuartoId, avisar }: TiendaProps) {
  const [categoria, setCategoria] = useState<Categoria>(cuartoId)
  const cuarto = partida.cuartos.find((c) => c.id === cuartoId) ?? partida.cuartos[0]
  const nombreCuarto = CUARTOS[cuartoId].nombre

  const comprarMueble = (m: Mueble) => {
    if (m.amor && partida.nivelAmor < m.amor) return
    if (partida.monedas < m.precio) {
      avisar('Te faltan monedas para este mueble')
      return
    }
    actualizar((p) => ({
      ...p,
      monedas: p.monedas - m.precio,
      inventario: sumarInventario(p.inventario, m.id, 1),
    }))
    sfx.coin()
    avisar(`¡Comprado! ${m.nombre} está en tu inventario (Casa → Decorar)`)
  }

  const usarSuperficie = (tipo: 'pared' | 'piso', s: Superficie) => {
    const clave = `${tipo}:${s.id}`
    const aplicar = (p: Partida): Partida => ({
      ...p,
      cuartos: p.cuartos.map((c) => {
        if (c.id !== cuartoId) return c
        return tipo === 'pared' ? { ...c, pared: s.id } : { ...c, piso: s.id }
      }),
    })
    const gratis = s.precio === 0
    const yaComprada = gratis || (partida.inventario[clave] ?? 0) > 0
    if (yaComprada) {
      actualizar(aplicar)
      sfx.coin()
      avisar(`${s.nombre} puesto en ${nombreCuarto}`)
      return
    }
    if (partida.monedas < s.precio) {
      avisar('Te faltan monedas para esta opción')
      return
    }
    actualizar((p) => aplicar({ ...p, monedas: p.monedas - s.precio, inventario: sumarInventario(p.inventario, clave, 1) }))
    sfx.coin()
    avisar(`¡Comprado! ${s.nombre} ya está en ${nombreCuarto}`)
  }

  const esCuarto = (c: Categoria): c is CuartoId => c !== 'paredes' && c !== 'pisos'
  const muebles = esCuarto(categoria) ? MUEBLES.filter((m) => m.cuarto === categoria) : []
  const superficies = categoria === 'paredes' ? PAREDES : categoria === 'pisos' ? PISOS : []
  const tipoSuperficie = categoria === 'paredes' ? 'pared' : 'piso'

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-end justify-between gap-3 px-4 pt-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#6b4a63]">Tienda 🛍️</h2>
          <p className="text-xs font-semibold text-[#a68aa0]">
            Decorando: {CUARTOS[cuartoId].emoji} {nombreCuarto}
          </p>
        </div>
        <span className="rounded-full bg-white/85 px-3 py-1.5 text-sm font-extrabold text-[#6b4a63] shadow-sm">
          {partida.monedas} 🪙
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto px-3 pb-2 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIAS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCategoria(id)}
            aria-pressed={categoria === id}
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-extrabold shadow-sm transition active:scale-95 ${
              categoria === id ? 'bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] text-white' : 'bg-white/80 text-[#6b4a63]'
            }`}
          >
            <span aria-hidden>{CUARTOS[id].emoji}</span>
            {CUARTOS[id].nombre}
          </button>
        ))}
        {(['paredes', 'pisos'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCategoria(id)}
            aria-pressed={categoria === id}
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-extrabold shadow-sm transition active:scale-95 ${
              categoria === id ? 'bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] text-white' : 'bg-white/80 text-[#6b4a63]'
            }`}
          >
            <span aria-hidden>{id === 'paredes' ? '🧱' : '🪵'}</span>
            {id === 'paredes' ? 'Paredes' : 'Pisos'}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {muebles.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {muebles.map((m) => {
              const bloqueado = Boolean(m.amor && partida.nivelAmor < m.amor)
              const tengo = (partida.inventario[m.id] ?? 0) + colocadosDe(partida, m.id)
              const puedeComprar = !bloqueado && partida.monedas >= m.precio
              return (
                <div key={m.id} className="flex flex-col items-center rounded-3xl bg-white/90 p-3 shadow-sm">
                  <div className={`flex h-24 w-full items-center justify-center rounded-2xl bg-[#fff4f8] ${bloqueado ? 'opacity-50' : ''}`}>
                    <svg viewBox="0 0 100 100" className="h-20 w-20" dangerouslySetInnerHTML={{ __html: m.svg }} />
                  </div>
                  <p className="mt-2 w-full truncate text-center text-sm font-extrabold text-[#6b4a63]">{m.nombre}</p>
                  <p className="text-xs font-semibold text-[#a68aa0]">
                    {tengo > 0 ? `Tienes ${tengo}` : 'Sin comprar'}
                  </p>
                  {bloqueado ? (
                    <p className="mt-2 flex h-11 w-full items-center justify-center gap-1 rounded-2xl bg-[#f3e9f0] text-xs font-bold text-[#8a6b82]">
                      <Lock className="h-3.5 w-3.5" /> Nivel de amor {m.amor}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => comprarMueble(m)}
                      disabled={!puedeComprar}
                      className="mt-2 h-11 w-full rounded-2xl bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] text-sm font-extrabold text-white shadow-md transition active:scale-95 disabled:opacity-40"
                    >
                      Comprar · {m.precio} 🪙
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {superficies.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {superficies.map((s) => {
              const clave = `${tipoSuperficie}:${s.id}`
              const bloqueado = Boolean(s.amor && partida.nivelAmor < s.amor)
              const comprada = s.precio === 0 || (partida.inventario[clave] ?? 0) > 0
              const actual = tipoSuperficie === 'pared' ? cuarto.pared : cuarto.piso
              const puesta = actual === s.id
              const puedeComprar = !bloqueado && partida.monedas >= s.precio
              return (
                <div key={s.id} className="flex flex-col items-center rounded-3xl bg-white/90 p-3 shadow-sm">
                  <div
                    className={`h-24 w-full rounded-2xl ring-2 ring-white ${bloqueado ? 'opacity-50' : ''}`}
                    style={{ background: s.fondo }}
                    aria-hidden
                  />
                  <p className="mt-2 w-full truncate text-center text-sm font-extrabold text-[#6b4a63]">{s.nombre}</p>
                  <p className="text-xs font-semibold text-[#a68aa0]">
                    {puesta ? 'Puesta aquí ✓' : comprada ? 'Ya es tuya' : 'Sin comprar'}
                  </p>
                  {bloqueado ? (
                    <p className="mt-2 flex h-11 w-full items-center justify-center gap-1 rounded-2xl bg-[#f3e9f0] text-xs font-bold text-[#8a6b82]">
                      <Lock className="h-3.5 w-3.5" /> Nivel de amor {s.amor}
                    </p>
                  ) : comprada ? (
                    <button
                      type="button"
                      onClick={() => usarSuperficie(tipoSuperficie, s)}
                      disabled={puesta}
                      className="mt-2 h-11 w-full rounded-2xl bg-[#b5ead7] text-sm font-extrabold text-[#2f5c4b] shadow-md transition active:scale-95 disabled:opacity-50"
                    >
                      {puesta ? 'Puesta' : 'Poner aquí'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => usarSuperficie(tipoSuperficie, s)}
                      disabled={!puedeComprar}
                      className="mt-2 h-11 w-full rounded-2xl bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] text-sm font-extrabold text-white shadow-md transition active:scale-95 disabled:opacity-40"
                    >
                      Comprar · {s.precio} 🪙
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
