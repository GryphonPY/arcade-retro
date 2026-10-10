'use client'

import { useMemo, useState } from 'react'
import { Check, Images, ListChecks, Sparkles, Trash2, X } from 'lucide-react'
import { asegurarDia, buscarTarea, elegirTareas } from './tareas'
import { coleccion, progreso } from './coleccion'
import { FotoCuarto } from './foto'
import { hoyISO, type Actualizar } from './guardado'
import type { Partida } from './types'

export type PestanaLibreta = 'tareas' | 'coleccion' | 'fotos'

export interface LibretaProps {
  partida: Partida
  actualizar: Actualizar
  pestana: PestanaLibreta
  onPestana: (p: PestanaLibreta) => void
  onCerrar: () => void
  avisar: (texto: string) => void
}

const PESTANAS: Array<{ id: PestanaLibreta; nombre: string; icono: typeof ListChecks }> = [
  { id: 'tareas', nombre: 'Tareas', icono: ListChecks },
  { id: 'coleccion', nombre: 'Colección', icono: Sparkles },
  { id: 'fotos', nombre: 'Fotos', icono: Images },
]

export const MAX_FOTOS = 30

/** Hoja de la libreta: tareas del día, colección y álbum de fotos. */
export function Libreta({ partida, actualizar, pestana, onPestana, onCerrar, avisar }: LibretaProps) {
  const [verFoto, setVerFoto] = useState<string | null>(null)
  return (
    <div className="absolute inset-0 z-[60] flex items-end justify-center bg-[#6b4a63]/30 p-2 sm:items-center" role="dialog" aria-label="Libreta de Nidito">
      <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-[28px] bg-[#fff7fb] shadow-2xl">
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
          <p className="min-w-0 flex-1 text-lg font-extrabold text-[#6b4a63]">📖 Libreta</p>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar libreta"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#6b4a63] shadow-sm transition active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex shrink-0 gap-2 px-4 pb-3" role="tablist">
          {PESTANAS.map((t) => {
            const Icono = t.icono
            const activa = pestana === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => onPestana(t.id)}
                className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl text-sm font-extrabold transition active:scale-95 ${
                  activa ? 'bg-gradient-to-r from-[#ff8fb1] to-[#c7a6ff] text-white shadow-md' : 'bg-white text-[#6b4a63] shadow-sm'
                }`}
              >
                <Icono className="h-4 w-4" aria-hidden />
                {t.nombre}
              </button>
            )
          })}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {pestana === 'tareas' && <PanelTareas partida={partida} />}
          {pestana === 'coleccion' && <PanelColeccion partida={partida} />}
          {pestana === 'fotos' && (
            <PanelFotos
              partida={partida}
              actualizar={actualizar}
              verFoto={verFoto}
              onVer={setVerFoto}
              avisar={avisar}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function PanelTareas({ partida }: { partida: Partida }) {
  const hoy = hoyISO()
  // Si el día aún no se abrió en la partida, se muestran las tareas que tocan hoy.
  const dia = partida.dia?.fecha === hoy ? partida.dia : asegurarDia(partida).dia
  const lista = dia?.lista ?? elegirTareas(hoy, partida.mascotas.length > 0)
  const hechas = dia?.hechas ?? []
  const cuentas = dia?.cuentas ?? {}
  const nombres: [string, string] = [partida.pareja[0].nombre, partida.pareja[1].nombre]
  const todas = lista.length > 0 && lista.every((id) => hechas.includes(id))

  return (
    <div className="space-y-3 pt-1">
      <div>
        <p className="text-sm font-extrabold text-[#6b4a63]">Tareas de hoy</p>
        <p className="text-xs font-semibold text-[#a68aa0]">
          {hechas.length} de {lista.length} listas · se renuevan cada día
        </p>
      </div>
      {todas && (
        <div className="rounded-2xl bg-gradient-to-r from-[#ffd9e6] to-[#e4dcff] p-3 text-center text-sm font-extrabold text-[#6b4a63]">
          ¡Hoy lo hicieron todo! 💕 Vuelvan mañana por más.
        </div>
      )}
      {lista.map((id) => {
        const t = buscarTarea(id)
        if (!t) return null
        const completada = hechas.includes(id)
        const actual = cuentas[t.clave] ?? 0
        const avance = Math.min(actual, t.meta)
        const pct = completada ? 100 : Math.round((avance / t.meta) * 100)
        return (
          <div key={id} className={`flex items-center gap-3 rounded-3xl p-3 shadow-sm ${completada ? 'bg-[#e8fbf1]' : 'bg-white'}`}>
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-extrabold ${
                completada ? 'bg-[#7ed9b5] text-white' : 'bg-[#fff1f6] text-[#c05c85]'
              }`}
              aria-hidden
            >
              {completada ? <Check className="h-5 w-5" /> : '♡'}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-extrabold ${completada ? 'text-[#4f8f72] line-through' : 'text-[#6b4a63]'}`}>{t.texto(nombres)}</p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f3e3ec]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-gradient-to-r from-[#ff8fb1] to-[#ffd98a] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] font-bold text-[#a68aa0]">
                {completada ? '¡Lista! ' : ''}
                {t.modo === 'maximo' ? `${actual} / ${t.meta} puntos` : `${avance} / ${t.meta}`} · +{t.monedas} 🪙 +{t.corazones} 💕
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PanelColeccion({ partida }: { partida: Partida }) {
  const categorias = useMemo(() => coleccion(partida), [partida])
  const total = categorias.reduce((n, c) => n + c.items.length, 0)
  const tengo = categorias.reduce((n, c) => n + c.items.filter((i) => i.obtenido).length, 0)
  return (
    <div className="space-y-4 pt-1">
      <div>
        <p className="text-sm font-extrabold text-[#6b4a63]">Tu colección: {Math.round((tengo / Math.max(1, total)) * 100)}%</p>
        <p className="text-xs font-semibold text-[#a68aa0]">
          {tengo} de {total} piezas. Lo que aún no tienes aparece en gris.
        </p>
      </div>
      {categorias.map((c) => {
        const pct = progreso(c)
        return (
          <section key={c.id} aria-label={c.nombre} className="rounded-3xl bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span aria-hidden className="text-lg">{c.emoji}</span>
              <p className="min-w-0 flex-1 truncate text-sm font-extrabold text-[#6b4a63]">{c.nombre}</p>
              <span className="rounded-full bg-[#ffe6ef] px-2 py-0.5 text-xs font-extrabold text-[#8a3b5c]">{pct}%</span>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#f3e3ec]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.nombre} ${pct}%`}>
              <div className="h-full rounded-full bg-gradient-to-r from-[#7ed9b5] to-[#a8e6cf] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {c.items.map((it) => (
                <li
                  key={it.id}
                  className={`flex flex-col items-center rounded-2xl bg-[#fff7fb] p-1.5 text-center ${it.obtenido ? '' : 'opacity-60 grayscale'}`}
                >
                  {it.svg ? (
                    <svg viewBox="0 0 100 100" className="h-12 w-12" aria-hidden dangerouslySetInnerHTML={{ __html: it.svg }} />
                  ) : (
                    <span
                      aria-hidden
                      className="h-10 w-10 rounded-full border-2 border-white shadow-inner"
                      style={{ background: it.color ?? '#ffd0e0' }}
                    />
                  )}
                  <span className="mt-1 w-full truncate text-[10px] font-bold text-[#6b4a63]">
                    {it.obtenido ? it.nombre : '???'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function PanelFotos({
  partida,
  actualizar,
  verFoto,
  onVer,
  avisar,
}: {
  partida: Partida
  actualizar: Actualizar
  verFoto: string | null
  onVer: (id: string | null) => void
  avisar: (texto: string) => void
}) {
  const fotos = partida.fotos ?? []
  const elegida = fotos.find((f) => f.id === verFoto) ?? null

  const borrar = (id: string) => {
    actualizar((p) => ({ ...p, fotos: (p.fotos ?? []).filter((f) => f.id !== id) }))
    onVer(null)
    avisar('Foto borrada')
  }

  return (
    <div className="space-y-3 pt-1">
      <div>
        <p className="text-sm font-extrabold text-[#6b4a63]">Álbum de fotos · {fotos.length} / {MAX_FOTOS}</p>
        <p className="text-xs font-semibold text-[#a68aa0]">Toca 📷 en la Casa para tomar una foto de su cuarto.</p>
      </div>
      {elegida && (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-white p-3 shadow-md">
          <div className="w-[78%] max-w-[360px]">
            <FotoCuarto foto={elegida} />
          </div>
          <button
            type="button"
            onClick={() => borrar(elegida.id)}
            className="flex h-10 items-center gap-1.5 rounded-2xl bg-[#fde7ef] px-4 text-sm font-bold text-[#8a3b5c] transition active:scale-95"
          >
            <Trash2 className="h-4 w-4" /> Borrar esta foto
          </button>
        </div>
      )}
      {fotos.length === 0 ? (
        <p className="rounded-3xl bg-white p-4 text-center text-sm font-semibold text-[#a68aa0] shadow-sm">
          Aún no hay fotos. ¡Tómenles una juntos!
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onVer(f.id === verFoto ? null : f.id)}
                aria-label="Ver foto"
                aria-pressed={f.id === verFoto}
                className={`block w-full transition active:scale-95 ${f.id === verFoto ? 'ring-4 ring-[#ffb3c9] rounded-[12px]' : ''}`}
              >
                <FotoCuarto foto={f} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
