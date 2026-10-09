'use client'

import { useState, type ReactNode } from 'react'
import { Apple, Hand, X } from 'lucide-react'
import type { Mascota, Partida } from './types'
import type { Actualizar } from './guardado'

const OSC = '#5b4a5e'
const MAX_MASCOTAS = 2

/** Dibujo chibi de una mascota en SVG. La cola se mueve sola (clase nidito-cola). */
export function DibujoMascota({
  tipo,
  color,
  size = 90,
  className,
}: {
  tipo: Mascota['tipo']
  color: string
  size?: number
  className?: string
}) {
  const clara = 'rgba(255,255,255,0.45)'
  const mejillas = (
    <>
      <ellipse cx="34" cy="54" rx="5" ry="3" fill="#ff8fb1" opacity="0.6" />
      <ellipse cx="66" cy="54" rx="5" ry="3" fill="#ff8fb1" opacity="0.6" />
    </>
  )
  const ojos = (
    <>
      <circle cx="41" cy="46" r="3.6" fill={OSC} />
      <circle cx="59" cy="46" r="3.6" fill={OSC} />
      <circle cx="42.3" cy="44.6" r="1.2" fill="#ffffff" />
      <circle cx="60.3" cy="44.6" r="1.2" fill="#ffffff" />
    </>
  )

  let cuerpo: ReactNode
  if (tipo === 'gato') {
    cuerpo = (
      <>
        <g className="nidito-cola" style={{ transformOrigin: '76px 82px' }}>
          <path d="M74 84 C92 86 94 64 84 58" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
        </g>
        <ellipse cx="50" cy="76" rx="26" ry="19" fill={color} />
        <ellipse cx="50" cy="80" rx="13" ry="9" fill={clara} />
        <path d="M28 34 L30 10 L46 26 Z" fill={color} />
        <path d="M72 34 L70 10 L54 26 Z" fill={color} />
        <path d="M32 28 L33 16 L41 25 Z" fill="#ffb3c9" />
        <path d="M68 28 L67 16 L59 25 Z" fill="#ffb3c9" />
        <circle cx="50" cy="44" r="25" fill={color} />
        {ojos}
        {mejillas}
        <path d="M47 53 L53 53 L50 57 Z" fill="#ff8fb1" />
        <path d="M50 57 Q47 61 44 59 M50 57 Q53 61 56 59" fill="none" stroke={OSC} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M22 52 L8 50 M22 57 L8 58 M78 52 L92 50 M78 57 L92 58" stroke={OSC} strokeWidth="1" opacity="0.5" />
      </>
    )
  } else if (tipo === 'perro') {
    cuerpo = (
      <>
        <g className="nidito-cola" style={{ transformOrigin: '80px 74px' }}>
          <path d="M80 76 C92 72 94 62 90 56" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
        </g>
        <ellipse cx="50" cy="78" rx="26" ry="18" fill={color} />
        <ellipse cx="50" cy="82" rx="13" ry="8" fill={clara} />
        <ellipse cx="26" cy="46" rx="10" ry="18" fill="#9c8073" transform="rotate(12 26 46)" />
        <ellipse cx="74" cy="46" rx="10" ry="18" fill="#9c8073" transform="rotate(-12 74 46)" />
        <circle cx="50" cy="44" r="24" fill={color} />
        <ellipse cx="50" cy="58" rx="12" ry="9" fill={clara} />
        {ojos}
        {mejillas}
        <ellipse cx="50" cy="54" rx="4.6" ry="3.4" fill={OSC} />
        <path d="M46 62 Q50 67 54 62" fill="none" stroke={OSC} strokeWidth="1.4" strokeLinecap="round" />
        <ellipse cx="50" cy="66" rx="3" ry="3.4" fill="#ff8fb1" />
      </>
    )
  } else {
    cuerpo = (
      <>
        <ellipse cx="50" cy="78" rx="24" ry="18" fill={color} />
        <ellipse cx="50" cy="82" rx="12" ry="8" fill={clara} />
        <ellipse cx="40" cy="22" rx="7" ry="20" fill={color} />
        <ellipse cx="60" cy="22" rx="7" ry="20" fill={color} />
        <ellipse cx="40" cy="22" rx="3.4" ry="14" fill="#ffb3c9" />
        <ellipse cx="60" cy="22" rx="3.4" ry="14" fill="#ffb3c9" />
        <circle cx="50" cy="52" r="23" fill={color} />
        {ojos}
        {mejillas}
        <path d="M47 56 L53 56 L50 59 Z" fill="#ff8fb1" />
        <path d="M50 59 Q47 63 44 61 M50 59 Q53 63 56 61" fill="none" stroke={OSC} strokeWidth="1.2" strokeLinecap="round" />
        <g className="nidito-cola" style={{ transformOrigin: '76px 86px' }}>
          <circle cx="78" cy="86" r="6" fill="#ffffff" />
        </g>
      </>
    )
  }

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={tipo === 'gato' ? 'Gatito' : tipo === 'perro' ? 'Perrito' : 'Conejito'}
      style={{ overflow: 'visible' }}
    >
      {cuerpo}
    </svg>
  )
}

const ESPECIES: Record<
  Mascota['tipo'],
  { nombre: string; precio: number; nombres: string[]; colores: string[] }
> = {
  gato: { nombre: 'Gatito', precio: 80, nombres: ['Mimi', 'Nube', 'Luna'], colores: ['#f7c6a3', '#c9c2d3', '#ffffff'] },
  perro: { nombre: 'Perrito', precio: 100, nombres: ['Toby', 'Canela', 'Pancho'], colores: ['#e8b98a', '#d9a77a', '#fff4e6'] },
  conejo: { nombre: 'Conejito', precio: 60, nombres: ['Lulú', 'Pompón', 'Copo'], colores: ['#ffffff', '#e4dfea', '#ffd9e6'] },
}

const NOMBRE_TIPO: Record<Mascota['tipo'], string> = { gato: 'Gatito', perro: 'Perrito', conejo: 'Conejito' }

/**
 * Panel de mascotas (hoja inferior dentro de la casa): adoptar, acariciar y alimentar.
 * `onAlimentar(i)` le pide a la casa que la mascota vaya a su plato.
 */
export function PanelMascotas({
  partida,
  actualizar,
  avisar,
  onAlimentar,
  onCerrar,
}: {
  partida: Partida
  actualizar: Actualizar
  avisar: (texto: string) => void
  onAlimentar: (indice: number) => void
  onCerrar: () => void
}) {
  const [tipo, setTipo] = useState<Mascota['tipo']>('gato')
  const [nombre, setNombre] = useState('')
  const [colorIdx, setColorIdx] = useState(0)

  const especie = ESPECIES[tipo]
  const lleno = partida.mascotas.length >= MAX_MASCOTAS

  const adoptar = () => {
    if (lleno) return avisar('Ya tienen dos mascotas')
    if (partida.monedas < especie.precio) return avisar('Te faltan monedas para adoptar')
    const nombreFinal = nombre.trim().slice(0, 12) || especie.nombres[0]
    const color = especie.colores[colorIdx] ?? especie.colores[0]
    actualizar((p) => ({
      ...p,
      monedas: p.monedas - especie.precio,
      mascotas: [...p.mascotas, { tipo, nombre: nombreFinal, color, felicidad: 70 }],
    }))
    setNombre('')
    avisar(`¡Hola, ${nombreFinal}!`)
  }

  const acariciar = (i: number) => {
    actualizar((p) => ({
      ...p,
      mascotas: p.mascotas.map((m, j) => (j === i ? { ...m, felicidad: Math.min(100, m.felicidad + 8) } : m)),
    }))
  }

  const alimentar = (i: number) => {
    if (partida.monedas < 5) return avisar('Te faltan 5 monedas para la comida')
    actualizar((p) => ({
      ...p,
      monedas: p.monedas - 5,
      mascotas: p.mascotas.map((m, j) => (j === i ? { ...m, felicidad: Math.min(100, m.felicidad + 15) } : m)),
    }))
    onAlimentar(i)
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[62%] flex-col rounded-t-[28px] bg-white/95 shadow-[0_-12px_40px_rgba(107,74,99,0.25)] backdrop-blur"
      role="dialog"
      aria-label="Mascotas"
    >
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 className="text-lg font-extrabold text-[#6b4a63]">Tus mascotas 🐾</h2>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar mascotas"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fde7ef] text-[#6b4a63] transition active:scale-90"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-6">
        {partida.mascotas.length === 0 && (
          <p className="rounded-2xl bg-[#fff4f8] p-4 text-center text-sm text-[#8a6b82]">
            Aún no tienen mascotas. ¡Adopta una para que el cuarto se llene de cariño!
          </p>
        )}

        {partida.mascotas.map((m, i) => (
          <div key={`${m.nombre}-${i}`} className="flex items-center gap-3 rounded-3xl bg-[#fff4f8] p-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white">
              <DibujoMascota tipo={m.tipo} color={m.color} size={72} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold text-[#6b4a63]">
                {m.nombre} <span className="text-xs font-semibold text-[#a68aa0]">· {NOMBRE_TIPO[m.tipo]}</span>
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-[#a68aa0]">Felicidad</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#f3e3ec]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] transition-[width] duration-500"
                    style={{ width: `${m.felicidad}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-bold text-[#6b4a63]">{m.felicidad}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => acariciar(i)}
                  className="flex h-11 items-center gap-1.5 rounded-2xl bg-white px-3 text-sm font-bold text-[#6b4a63] shadow-sm transition active:scale-95"
                >
                  <Hand className="h-4 w-4" /> Acariciar
                </button>
                <button
                  type="button"
                  onClick={() => alimentar(i)}
                  className="flex h-11 items-center gap-1.5 rounded-2xl bg-[#b5ead7] px-3 text-sm font-bold text-[#2f5c4b] shadow-sm transition active:scale-95"
                >
                  <Apple className="h-4 w-4" /> Alimentar · 5 🪙
                </button>
              </div>
            </div>
          </div>
        ))}

        {!lleno && (
          <div className="space-y-3 rounded-3xl border-2 border-dashed border-[#f3c6d8] p-3">
            <p className="text-sm font-extrabold text-[#6b4a63]">Adoptar</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ESPECIES) as Mascota['tipo'][]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTipo(t)
                    setColorIdx(0)
                  }}
                  aria-pressed={tipo === t}
                  className={`flex flex-col items-center rounded-2xl p-2 transition active:scale-95 ${
                    tipo === t ? 'bg-[#ffd9e6] ring-2 ring-[#ff8fb1]' : 'bg-white'
                  }`}
                >
                  <DibujoMascota tipo={t} color={ESPECIES[t].colores[0]} size={56} />
                  <span className="mt-1 text-xs font-bold text-[#6b4a63]">{ESPECIES[t].nombre}</span>
                  <span className="text-[11px] text-[#a68aa0]">{ESPECIES[t].precio} 🪙</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#a68aa0]">Color</span>
              {especie.colores.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorIdx(i)}
                  aria-label={`Color ${i + 1}`}
                  aria-pressed={colorIdx === i}
                  className={`h-8 w-8 rounded-full border-2 transition active:scale-90 ${
                    colorIdx === i ? 'border-[#ff8fb1]' : 'border-white'
                  }`}
                  style={{ background: c, boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={12}
                placeholder={especie.nombres[0]}
                aria-label="Nombre de la mascota"
                className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-[#f3c6d8] bg-white px-3 text-base text-[#6b4a63] outline-none focus:border-[#ff8fb1]"
              />
              <button
                type="button"
                onClick={adoptar}
                disabled={partida.monedas < especie.precio}
                className="h-12 rounded-2xl bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] px-4 text-sm font-extrabold text-white shadow-md transition active:scale-95 disabled:opacity-40"
              >
                Adoptar · {especie.precio} 🪙
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
