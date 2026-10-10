'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from 'react'
import { BookHeart, CalendarHeart, Coins, Gamepad2, Gift, Heart, House, Shirt, Store, Volume2, VolumeX, type LucideIcon } from 'lucide-react'
import { isMuted, loadMutePref, setMuted, sfx, tone } from './sfx'
import { Armario } from './nidito/armario'
import { Casa } from './nidito/casa'
import { Citas } from './nidito/citas'
import { Creador } from './nidito/creador'
import { Libreta, type PestanaLibreta } from './nidito/libreta'
import { Tienda } from './nidito/tienda'
import Panqueques from './nidito/minijuegos/panqueques'
import Entregas from './nidito/minijuegos/entregas'
import { cargarPartida, guardarPartida, hoyISO, nuevaPartida } from './nidito/guardado'
import { aplicarAccion, buscarTarea } from './nidito/tareas'
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
  'flex h-16 max-h-[520px]:h-12 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-3xl text-[11px] font-extrabold transition active:scale-95'

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
  const [libreta, setLibreta] = useState<PestanaLibreta | null>(null)
  const [celebra, setCelebra] = useState(0)
  const hechasRef = useRef<string[] | null>(null)

  // Guardado automático tras cada cambio.
  useEffect(() => {
    if (partida) guardarPartida(partida)
  }, [partida])

  const actualizar = useCallback((fn: (p: Partida) => Partida) => setPartida((p) => (p ? fn(p) : p)), [])

  const avisar = useCallback((texto: string) => setAviso({ id: Date.now(), texto }), [])

  const terminarCelebracion = useCallback(() => setCelebra(0), [])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 2600)
    return () => window.clearTimeout(t)
  }, [aviso])

  // Celebración tierna cuando una tarea del día se completa (venga de donde venga).
  useEffect(() => {
    const ids = partida?.dia && partida.dia.fecha === hoyISO() ? partida.dia.hechas : []
    const previas = hechasRef.current
    hechasRef.current = ids
    if (previas === null) return
    const nueva = ids.find((id) => !previas.includes(id))
    if (!nueva) return
    setCelebra((n) => n + 1)
    tone({ freq: 659, dur: 0.14, vol: 0.05, type: 'triangle' })
    tone({ freq: 880, dur: 0.14, vol: 0.05, type: 'triangle', delay: 0.12 })
    tone({ freq: 1175, dur: 0.3, vol: 0.05, type: 'triangle', delay: 0.24 })
    const tarea = buscarTarea(nueva)
    const nombres: [string, string] = [partida?.pareja[0].nombre ?? '', partida?.pareja[1].nombre ?? '']
    avisar(`¡Tarea lista: ${tarea ? tarea.texto(nombres) : 'bien hecho'}! 💕`)
  }, [partida, avisar])

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
    actualizar((p) => {
      const cuenta = {
        ...p,
        monedas: p.monedas + ganadas,
        mejores: { ...p.mejores, [id]: Math.max(p.mejores[id] ?? 0, resultado.puntos) },
      }
      return id === 'panqueques' ? aplicarAccion(cuenta, 'panqueques', resultado.puntos, 'maximo') : cuenta
    })
    avisar(`+${ganadas} monedas · ${resultado.puntos} puntos`)
    setJuego(null)
  }

  const JuegoActivo = juego ? JUEGOS.find((j) => j.id === juego) : undefined

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden text-[#6b4a63]"
      style={{ background: 'linear-gradient(180deg, #fff7fb 0%, #f6efff 100%)' }}
    >
      {/* adornitos kawaii de fondo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden text-[#ffb3c9]/60">
        <span className="absolute left-[4%] top-[18%] text-lg">✦</span>
        <span className="absolute right-[6%] top-[30%] text-xl">♡</span>
        <span className="absolute left-[8%] bottom-[24%] text-base">♡</span>
        <span className="absolute right-[10%] bottom-[12%] text-lg">✦</span>
      </div>
      <header className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3 max-h-[520px]:pb-1 max-h-[520px]:pt-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-extrabold leading-tight">
            {a.nombre} &amp; {b.nombre}
          </p>
          <p className="text-[11px] font-semibold text-[#a68aa0] max-h-[520px]:hidden">Nidito · nivel de amor {partida.nivelAmor}</p>
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
          onClick={() => setLibreta('tareas')}
          aria-label="Abrir libreta"
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fff1f6] to-[#e4dcff] text-[#6b4a63] shadow-sm transition active:scale-90"
        >
          <BookHeart className="h-5 w-5" />
        </button>
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

      <main className="relative isolate min-h-0 flex-1 overflow-hidden">
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

        {celebra > 0 && <Confeti key={celebra} onFin={terminarCelebracion} />}

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

      {libreta && (
        <Libreta
          partida={partida}
          actualizar={actualizar}
          pestana={libreta}
          onPestana={setLibreta}
          onCerrar={() => setLibreta(null)}
          avisar={avisar}
        />
      )}
    </div>
  )
}

/** Confeti de corazones que cae sobre el juego al completar una tarea (se quita solo). */
function Confeti({ onFin }: { onFin: () => void }) {
  const [piezas] = useState(() =>
    Array.from({ length: 22 }, (_, i) => ({
      i,
      x: 4 + Math.random() * 92,
      demora: Math.random() * 0.6,
      tam: 14 + Math.random() * 14,
      emoji: ['💖', '💗', '💕', '🩷', '💘'][i % 5],
    })),
  )
  useEffect(() => {
    const t = window.setTimeout(onFin, 2600)
    return () => window.clearTimeout(t)
  }, [onFin])
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[80] overflow-hidden">
      <style>{`@keyframes nidito-confeti { 0% { transform: translateY(0) rotate(0deg); opacity: 1 } 85% { opacity: 1 } 100% { transform: translateY(120vh) rotate(180deg); opacity: 0 } } .nidito-confeti { animation: nidito-confeti 2.2s ease-in forwards; }`}</style>
      {piezas.map((p) => (
        <span
          key={p.i}
          className="nidito-confeti absolute -top-8 select-none"
          style={{ left: `${p.x}%`, fontSize: p.tam, animationDelay: `${p.demora}s` }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}
