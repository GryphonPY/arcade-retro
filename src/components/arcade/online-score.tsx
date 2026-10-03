'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, Pencil } from 'lucide-react'
import {
  NICK_MAX,
  fetchGameTop,
  setNickname,
  submitScore,
  tidyNickname,
  useNickname,
  type OnlineEntry,
  type SubmitResult,
} from './online'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; result: SubmitResult; top: OnlineEntry[] | null }
  | { kind: 'error'; message: string }
  | { kind: 'offline' }

const MESSAGES = {
  'apodo-invalido': 'Ese apodo no se puede usar. Prueba otro (2 a 16 caracteres).',
  'demasiados-envios': 'Muchos envíos seguidos. Espera un minuto.',
}

/**
 * Publica la puntuación en la tabla mundial. Con apodo guardado se publica
 * sola; si no, pide el apodo una vez. Si la API no existe, no se muestra.
 */
export function OnlineScore({ game, score, accent }: { game: string; score: number; accent: string }) {
  const nick = useNickname()
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const sentFor = useRef<string | null>(null)

  const send = async (name: string) => {
    setState({ kind: 'sending' })
    const res = await submitScore(game, name, score)
    if (res === 'sin-conexion') return setState({ kind: 'offline' })
    if (typeof res === 'string') {
      if (res === 'apodo-invalido') {
        setNickname('')
        setEditing(true)
      }
      return setState({ kind: 'error', message: MESSAGES[res] })
    }
    setState({ kind: 'done', result: res, top: await fetchGameTop(game, 5) })
  }

  // Publicación automática cuando ya hay apodo guardado.
  useEffect(() => {
    if (!nick || editing || score <= 0) return
    const key = `${game}:${score}:${nick}`
    if (sentFor.current === key) return
    sentFor.current = key
    void send(nick)
  }, [nick, editing, game, score])

  if (score <= 0 || state.kind === 'offline') return null

  if (!nick || editing) {
    return (
      <form
        className="flex w-full max-w-[17rem] flex-col items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const name = tidyNickname(draft).trim()
          if (name.length < 2) return
          setNickname(name)
          setEditing(false)
        }}
      >
        <label className="flex items-center gap-1.5 text-xs text-white/70" htmlFor="arcade-nick">
          <Globe className="size-3.5" /> Publica tu puntuación en la tabla mundial
        </label>
        <div className="flex w-full gap-2">
          <input
            id="arcade-nick"
            value={draft}
            onChange={(e) => setDraft(tidyNickname(e.target.value))}
            maxLength={NICK_MAX}
            placeholder="Tu apodo"
            autoComplete="nickname"
            enterKeyHint="send"
            className="h-9 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={tidyNickname(draft).trim().length < 2}
            className="h-9 shrink-0 rounded-full px-4 text-sm font-semibold text-black transition disabled:opacity-40"
            style={{ background: accent }}
          >
            Publicar
          </button>
        </div>
        {state.kind === 'error' && <p className="text-[11px] text-rose-300">{state.message}</p>}
      </form>
    )
  }

  return (
    <div className="flex w-full max-w-[17rem] flex-col items-center gap-1.5 text-xs">
      {state.kind === 'sending' && <p className="text-white/60">Publicando como {nick}…</p>}
      {state.kind === 'error' && <p className="text-rose-300">{state.message}</p>}
      {state.kind === 'done' && (
        <>
          <p className="flex items-center gap-1.5 text-white/80">
            <Globe className="size-3.5" style={{ color: accent }} />
            <span>
              Puesto <b className="text-white">#{state.result.rank}</b> en el mundo
              {!state.result.improved && <span className="text-white/50"> · tu mejor: {state.result.best.toLocaleString('es-MX')}</span>}
            </span>
          </p>
          {state.top && state.top.length > 0 && (
            <ol className="w-full space-y-0.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-[11px]">
              {state.top.map((e, i) => {
                const mine = e.name.toLowerCase() === state.result.name.toLowerCase()
                return (
                  <li key={e.name} className={`flex justify-between gap-3 ${mine ? 'font-semibold text-white' : 'text-white/65'}`}>
                    <span className="truncate">
                      {i + 1}. {e.name}
                    </span>
                    <span className="tabular-nums">{e.score.toLocaleString('es-MX')}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
      {state.kind !== 'sending' && (
        <button
          type="button"
          onClick={() => {
            setDraft(nick)
            setEditing(true)
          }}
          className="inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/80"
        >
          <Pencil className="size-3" /> Jugando como {nick}
        </button>
      )}
    </div>
  )
}
