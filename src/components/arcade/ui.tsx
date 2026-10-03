'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ControlHint } from '@/components/games/catalog'

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 h-6 items-center justify-center rounded-md border border-white/15 border-b-white/25 bg-white/[0.06] px-1.5 font-mono text-[11px] font-medium text-zinc-200">
      {children}
    </kbd>
  )
}

export function ControlList({ controls, className }: { controls: ControlHint[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className ?? ''}`}>
      {controls.map((c) => (
        <li key={c.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="flex gap-1">
            {c.keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
          <span>{c.label}</span>
        </li>
      ))}
    </ul>
  )
}

export function IconButton({
  label,
  active,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex size-9 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/10 hover:text-white active:scale-95 ${
        active === false ? 'text-zinc-500' : ''
      } ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Arte del juego sobre un degradado con su color de acento. */
export function GameArt({ accent, children, className }: { accent: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, ${accent}38, transparent 65%), linear-gradient(180deg, #15151d, #0c0c12)`,
      }}
    >
      <div className="absolute inset-0 scanlines" aria-hidden />
      {children}
    </div>
  )
}
