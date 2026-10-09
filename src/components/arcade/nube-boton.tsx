'use client'

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Cloud, RefreshCw, X } from 'lucide-react'
import { normalizarCodigo, olvidar, sincronizar, useNube, vincular, type Resultado } from './nube'
import { IconButton } from './ui'

const MENSAJES: Record<Resultado['kind'], { tono: 'ok' | 'aviso'; texto: string }> = {
  'sin-codigo': { tono: 'aviso', texto: 'Escribe un código para conectar este aparato.' },
  'codigo-invalido': { tono: 'aviso', texto: 'Usa de 4 a 32 letras, números o guiones. Por ejemplo: axel-y-ana.' },
  'sin-conexion': { tono: 'aviso', texto: 'Sin conexión por ahora. Lo intentamos solos en cuanto vuelva.' },
  bajada: { tono: 'ok', texto: 'Cargamos tu progreso guardado.' },
  subida: { tono: 'ok', texto: 'Listo, tu progreso se respalda solo.' },
  'al-dia': { tono: 'ok', texto: 'Todo está al día.' },
  error: { tono: 'aviso', texto: 'No se pudo guardar esta vez. Intenta de nuevo más tarde.' },
}

const hora = (ms: number) => new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(ms)

/**
 * Botón discreto con la nube; abre un panel para conectar el código de la partida.
 * Con `compact`, en pantallas menores a `sm` muestra solo el icono (cuadrado de 36px).
 */
export function NubeBoton({ compact = false }: { compact?: boolean }) {
  const { codigo } = useNube()
  const [abierto, setAbierto] = useState(false)
  const cerrar = useCallback(() => setAbierto(false), [])

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={codigo ? `Progreso en la nube, código ${codigo}` : 'Guardado en la nube'}
        className={`inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium text-zinc-200 transition hover:bg-white/10 active:scale-95 ${
          compact ? 'w-9 justify-center px-0 sm:w-auto sm:px-3' : 'px-3'
        }`}
      >
        <Cloud className="size-4 shrink-0" aria-hidden />
        <span className={`max-w-[10rem] truncate ${compact ? 'hidden sm:inline' : ''}`}>
          {codigo ? `Nube: ${codigo}` : 'Guardado en la nube'}
        </span>
      </button>
      {abierto && <NubeSheet onClose={cerrar} />}
    </>
  )
}

function NubeSheet({ onClose }: { onClose: () => void }) {
  const { codigo, ultimaSync, ocupado } = useNube()
  const [borrador, setBorrador] = useState(codigo ?? '')
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'aviso'; texto: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descId = useId()
  const inputId = useId()
  const hintId = useId()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const mostrar = (r: Resultado) => setAviso(MENSAJES[r.kind])

  const conectar = async (e: FormEvent) => {
    e.preventDefault()
    const normal = normalizarCodigo(borrador)
    if (!normal) return mostrar({ kind: 'codigo-invalido' })
    setBorrador(normal)
    setAviso({ tono: 'ok', texto: 'Conectando…' })
    mostrar(await vincular(normal))
  }

  const sincronizarAhora = async () => {
    setAviso({ tono: 'ok', texto: 'Sincronizando…' })
    mostrar(await sincronizar())
  }

  const desconectar = async () => {
    await olvidar()
    setBorrador('')
    setAviso({ tono: 'ok', texto: 'Este aparato ya no se sincroniza. Su progreso se queda aquí.' })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      onKeyDown={onKey}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#121219] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold">
            Progreso en la nube
          </h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <p id={descId} className="mt-3 text-sm leading-relaxed text-zinc-300">
          Usa el mismo código en todos tus aparatos y tu partida y tus récords viajan con ustedes. Sin cuentas ni
          contraseñas: el código es la llave, así que no lo compartas con cualquiera.
        </p>

        <form onSubmit={conectar} className="mt-5">
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Código
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={inputId}
              ref={inputRef}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              placeholder="axel-y-ana"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              aria-describedby={hintId}
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 text-[15px] outline-none transition focus:border-white/40"
            />
            <button
              type="submit"
              disabled={ocupado || !borrador.trim()}
              className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-40"
            >
              Conectar
            </button>
          </div>
          <p id={hintId} className="mt-2 text-xs text-zinc-500">
            De 4 a 32 letras, números o guiones.
          </p>
        </form>

        <p role="status" aria-live="polite" className={`mt-4 min-h-5 text-sm ${aviso?.tono === 'aviso' ? 'text-amber-300' : 'text-emerald-300'}`}>
          {aviso?.texto ?? ''}
        </p>

        {codigo && (
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <p className="text-zinc-400">
              Conectado con <span className="font-mono text-white">{codigo}</span>
            </p>
            <p className="mt-1 text-zinc-400">
              Última sincronización: {ultimaSync ? hora(ultimaSync) : 'todavía no'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={sincronizarAhora}
                disabled={ocupado}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw className={`size-4 ${ocupado ? 'animate-spin' : ''}`} aria-hidden />
                Sincronizar ahora
              </button>
              <button
                type="button"
                onClick={desconectar}
                className="h-10 rounded-full px-4 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
              >
                Desconectar este aparato
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
