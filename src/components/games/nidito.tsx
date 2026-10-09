'use client'

import { useCallback, useEffect, useState, useSyncExternalStore, type ComponentType } from 'react'
import { CalendarHeart, Coins, Gamepad2, Gift, Heart, House, Shirt, Store, Volume2, VolumeX, type LucideIcon } from 'lucide-react'
import { isMuted, loadMutePref, setMuted, sfx } from './sfx'
import { Armario } from './nidito/armario'
import { Casa } from './nidito/casa'
import { Citas } from './nidito/citas'
import { Creador } from './nidito/creador'
import { Tienda } from './nidito/tienda'
import Panqueques from './nidito/minijuegos/panqueques'
import Entregas from './nidito/minijuegos/entregas'
import { cargarPartida, guardarPartida, hoyISO, nuevaPartida } from './nidito/guardado'
import type { CuartoId, MinijuegoProps, Partida, Personaje } from './nidito/types'

type Seccion = 'casa' | 'armario' | 'tienda' | 'citas' | 'minijuegos'
type Juego = 'panqueques' | 'entregas'

const SECCIONES: Array<{ id: Seccion; nombre: string; icono: LucideIcon }> = [
  { id: 'casa', nombre: 'Casa', icono: House },
  { id: 'armario', nombre: 'Armario', icono: Shirt },
  { id: 'tienda', nombre: 'Tienda', icono: Store },
  { id: 'citas', nombre: 'Citas', icono: CalendarHeart },
  { id: 'minijuegos', nombre: 'Minijuegos', icono: Gamepad2 },
]

const JUEGOS: Array<{
  id: Juego
  nombre: string
  emoji: string
  descripcion: string
  Componente: ComponentType<MinijuegoProps>
}> = [
  {
    id: 'panqueques',
    nombre: 'Panqueques',
    emoji: '🥞',
    descripcion: 'Voltea y apila los panqueques a tiempo. Los combos dan más monedas.',
    Componente: Panqueques,
  },
  {
    id: 'entregas',
    nombre: 'Entregas',
    emoji: '📦',
    descripcion: 'Lleva la torre de cajas sin que se caiga. Inclina con el dedo.',
    Componente: Entregas,
  },
]

const BOTON_BASE =
  'flex h-16 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-3xl text-[11px] font-extrabold transition active:scale-95'

const suscribirNada = () => () => {}

/**
 * Nidito: juego de pareja, casa y vestuario. Punto de entrada. Solo se monta en el
 * navegador (el servidor muestra un cargando); así la partida se lee de localStorage
 * sin desajustes de hidratación.
 */
export default function Nidito() {
  const montado = useSyncExternalStore(
    suscribirNada,
    () => true,
    () => false,
  )
  if (!montado) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#fff7fb]">
        <span className="animate-pulse text-4xl" aria-label="Cargando">
          💕
        </span>
      </div>
    )
  }
  return <NiditoJuego />
}

function NiditoJuego() {
  // null = sin partida todavía (se muestra el creador).
  const [partida, setPartida] = useState<Partida | null>(() => cargarPartida())
  const [seccion, setSeccion] = useState<Seccion>('casa')
  const [cuartoId, setCuartoId] = useState<CuartoId>('sala')
  const [juego, setJuego] = useState<Juego | null>(null)
  const [silencio, setSilencio] = useState<boolean>(() => {
    loadMutePref()
    return isMuted()
  })
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null)

  // Guardado automático tras cada cambio.
  useEffect(() => {
    if (partida) guardarPartida(partida)
  }, [partida])

  const actualizar = useCallback((fn: (p: Partida) => Partida) => setPartida((p) => (p ? fn(p) : p)), [])

  const avisar = useCallback((texto: string) => setAviso({ id: Date.now(), texto }), [])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 2600)
    return () => window.clearTimeout(t)
  }, [aviso])

  if (partida === null) {
    return (
      <div className="h-full w-full">
        <Creador onListo={(pareja: [Personaje, Personaje]) => setPartida(nuevaPartida(pareja))} />
      </div>
    )
  }

  const regaloHecho = partida.ultimoRegalo === hoyISO()
  const [a, b] = partida.pareja

  const reclamarRegalo = () => {
    const hoy = hoyISO()
    if (partida.ultimoRegalo === hoy) return
    actualizar((p) => ({ ...p, monedas: p.monedas + 50, ultimoRegalo: hoy }))
    sfx.coin()
    avisar('¡Regalo de hoy! +50 monedas 🎁')
  }

  const alternarSonido = () => {
    const nuevo = !silencio
    setMuted(nuevo)
    setSilencio(nuevo)
  }

  const terminarJuego = (id: Juego, resultado: { monedas: number; puntos: number }) => {
    const ganadas = Math.max(0, Math.round(resultado.monedas))
    actualizar((p) => ({
      ...p,
      monedas: p.monedas + ganadas,
      mejores: { ...p.mejores, [id]: Math.max(p.mejores[id] ?? 0, resultado.puntos) },
    }))
    avisar(`+${ganadas} monedas · ${resultado.puntos} puntos`)
    setJuego(null)
  }

  const JuegoActivo = juego ? JUEGOS.find((j) => j.id === juego) : undefined

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden text-[#6b4a63]"
      style={{ background: 'linear-gradient(180deg, #fff7fb 0%, #f6efff 100%)' }}
    >
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold leading-tight">
            {a.nombre} &amp; {b.nombre}
          </p>
          <p className="text-[11px] font-semibold text-[#a68aa0]">Nidito · nivel de amor {partida.nivelAmor}</p>
        </div>
        <span className="flex h-10 items-center gap-1 rounded-2xl bg-white/85 px-2.5 text-sm font-extrabold shadow-sm" title="Monedas">
          <Coins className="h-4 w-4 text-[#d19a2a]" aria-hidden />
          {partida.monedas}
        </span>
        <span className="flex h-10 items-center gap-1 rounded-2xl bg-white/85 px-2.5 text-sm font-extrabold shadow-sm" title="Corazones">
          <Heart className="h-4 w-4 fill-[#ff8fb1] text-[#ff8fb1]" aria-hidden />
          {partida.corazones}
        </span>
        <button
          type="button"
          onClick={reclamarRegalo}
          disabled={regaloHecho}
          aria-label={regaloHecho ? 'Regalo de hoy ya reclamado' : 'Reclamar regalo diario'}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffd98a] to-[#ffb3c9] text-[#6b4a63] shadow-sm transition active:scale-90 disabled:opacity-40"
        >
          <Gift className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={alternarSonido}
          aria-label={silencio ? 'Activar sonido' : 'Silenciar'}
          aria-pressed={!silencio}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/85 text-[#6b4a63] shadow-sm transition active:scale-90"
        >
          {silencio ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        {seccion === 'casa' && (
          <Casa partida={partida} actualizar={actualizar} cuartoId={cuartoId} onCuarto={setCuartoId} avisar={avisar} />
        )}

        {seccion === 'armario' && (
          <div className="h-full w-full overflow-y-auto">
            <Armario partida={partida} onCambio={setPartida} />
          </div>
        )}

        {seccion === 'tienda' && (
          <Tienda partida={partida} actualizar={actualizar} cuartoId={cuartoId} avisar={avisar} />
        )}

        {seccion === 'citas' && <Citas partida={partida} actualizar={actualizar} avisar={avisar} />}

        {seccion === 'minijuegos' &&
          (JuegoActivo ? (
            <div className="h-full w-full">
              <JuegoActivo.Componente
                onFinish={(resultado) => terminarJuego(JuegoActivo.id, resultado)}
                onSalir={() => setJuego(null)}
              />
            </div>
          ) : (
            <div className="flex h-full w-full flex-col gap-3 overflow-y-auto px-4 pb-4 pt-2">
              <div>
                <h2 className="text-xl font-extrabold">Juegos para ganar monedas 🪙</h2>
                <p className="text-xs font-semibold text-[#a68aa0]">Juega, gana monedas y bate tu récord.</p>
              </div>
              {JUEGOS.map((j) => (
                <div key={j.id} className="flex items-center gap-3 rounded-3xl bg-white/90 p-4 shadow-sm">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#fff1f6] text-4xl" aria-hidden>
                    {j.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{j.nombre}</p>
                    <p className="text-xs text-[#a68aa0]">{j.descripcion}</p>
                    <p className="mt-1 text-xs font-bold text-[#6b4a63]">Récord: {partida.mejores[j.id] ?? 0}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setJuego(j.id)}
                    className="h-12 shrink-0 rounded-2xl bg-gradient-to-r from-[#ff8fb1] to-[#ffb3c9] px-4 text-sm font-extrabold text-white shadow-md transition active:scale-95"
                  >
                    Jugar
                  </button>
                </div>
              ))}
            </div>
          ))}

        {aviso && (
          <div role="status" className="pointer-events-none absolute inset-x-0 top-2 z-50 flex justify-center px-4">
            <span
              key={aviso.id}
              className="max-w-full truncate rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#6b4a63] shadow-lg"
            >
              {aviso.texto}
            </span>
          </div>
        )}
      </main>

      <nav className="grid shrink-0 grid-cols-5 gap-2 px-3 pb-3 pt-2" aria-label="Secciones de Nidito">
        {SECCIONES.map((s) => {
          const activo = seccion === s.id
          const Icono = s.icono
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSeccion(s.id)
                if (s.id !== 'minijuegos') setJuego(null)
              }}
              aria-current={activo ? 'page' : undefined}
              className={`${BOTON_BASE} ${
                activo
                  ? 'bg-gradient-to-br from-[#ff8fb1] to-[#c7a6ff] text-white shadow-lg'
                  : 'bg-white/85 text-[#6b4a63] shadow-sm'
              }`}
            >
              <Icono className="h-6 w-6" aria-hidden />
              {s.nombre}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
