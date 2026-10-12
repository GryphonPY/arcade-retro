'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/** Totales por juego, como los devuelve GET /api/plays. */
interface GameStats {
  game: string
  name: string
  sessions: number
  rounds: number
  seconds: number
}

interface PlaysResponse {
  days: number
  games: GameStats[]
  daily: { day: string; sessions: number; rounds: number; seconds: number }[]
}

type Result = { ok: true; data: PlaysResponse } | { ok: false }

const RANGES = [7, 30] as const
const fmt = (n: number) => n.toLocaleString('es-MX')

export function EstadisticasView() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7)
  // Resultados por rango ya pedido: cambiar de 7 a 30 días no vuelve a consultar.
  const [results, setResults] = useState<Partial<Record<number, Result>>>({})
  const result = results[days]

  useEffect(() => {
    let alive = true
    fetch(`/api/plays?days=${days}`)
      .then((r) => (r.ok ? (r.json() as Promise<PlaysResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => alive && setResults((prev) => ({ ...prev, [days]: { ok: true, data } })))
      .catch(() => alive && setResults((prev) => ({ ...prev, [days]: { ok: false } })))
    return () => {
      alive = false
    }
  }, [days])

  const games = result?.ok ? result.data.games : []
  const sessions = games.reduce((sum, g) => sum + g.sessions, 0)
  const rounds = games.reduce((sum, g) => sum + g.rounds, 0)
  const seconds = games.reduce((sum, g) => sum + g.seconds, 0)
  const maxRounds = Math.max(1, ...games.map((g) => g.rounds))

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-line bg-ink/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-sm font-medium text-zinc-300 transition-colors hover:text-white">
            ← Sala
          </Link>
          <span className="font-retro text-[11px] text-coin">Estadísticas</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-retro text-lg leading-relaxed text-coin sm:text-xl">Estadísticas</h1>
            <p className="mt-2 text-sm text-dim">Totales anónimos de la sala, sin datos personales.</p>
          </div>
          <div role="group" aria-label="Periodo" className="inline-flex rounded-full border border-line bg-panel p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={days === r}
                onClick={() => setDays(r)}
                className={`h-8 rounded-full px-4 text-sm font-medium transition-colors ${
                  days === r ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'
                }`}
              >
                {r} días
              </button>
            ))}
          </div>
        </div>

        {!result && <p className="mt-10 text-sm text-dim">Cargando…</p>}

        {result && !result.ok && (
          <p className="mt-10 rounded-2xl border border-line bg-panel p-6 text-sm text-dim">
            Sin datos todavía (la API solo funciona en el sitio publicado).
          </p>
        )}

        {result?.ok && (
          <>
            <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Tile label="Partidas" value={fmt(rounds)} />
              <Tile label="Sesiones" value={fmt(sessions)} />
              <Tile label="Horas jugadas" value={(seconds / 3600).toFixed(1)} />
            </section>

            <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-panel">
              {games.length === 0 ? (
                <p className="p-6 text-sm text-dim">Todavía no hay partidas en este periodo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-dim">
                      <tr className="border-b border-line">
                        <th className="px-4 py-3 font-semibold">Juego</th>
                        <th className="px-4 py-3 text-right font-semibold">Partidas</th>
                        <th className="px-4 py-3 text-right font-semibold">Sesiones</th>
                        <th className="px-4 py-3 text-right font-semibold">Minutos jugados</th>
                        <th className="px-4 py-3 text-right font-semibold">Min. por sesión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {games.map((g) => (
                        <tr key={g.game} className="border-b border-line last:border-0">
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-100">{g.name}</div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                              <div
                                className="h-full rounded-full bg-coin"
                                style={{ width: `${(g.rounds / maxRounds) * 100}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmt(g.rounds)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmt(g.sessions)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmt(Math.round(g.seconds / 60))}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {g.sessions > 0 ? (g.seconds / 60 / g.sessions).toFixed(1) : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-xs uppercase tracking-wider text-dim">{label}</p>
      <p className="mt-2 font-retro text-xl leading-tight text-coin tabular-nums sm:text-2xl">{value}</p>
    </div>
  )
}
