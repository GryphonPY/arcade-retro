'use client'

import { useCallback, useEffect, useRef } from 'react'

export type LogicalKey = 'up' | 'down' | 'left' | 'right' | 'action'
export type Dir = 'up' | 'down' | 'left' | 'right'

const KEY_MAP: Record<string, LogicalKey> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'action',
  Enter: 'action',
}

/**
 * Hook de entrada unificado: flechas + WASD (+ Espacio/Enter como acción).
 * Expone un Set de teclas pulsadas (para movimiento continuo) y un Set de
 * "recién pulsadas" (para movimientos discretos por frame). También acepta
 * pulsaciones virtuales para el mando táctil en móvil.
 */
export function useKeys() {
  const pressedRef = useRef<Set<LogicalKey>>(new Set())
  const justPressedRef = useRef<Set<LogicalKey>>(new Set())

  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code]
      if (!key) return
      e.preventDefault()
      if (e.repeat) return
      if (!pressedRef.current.has(key)) justPressedRef.current.add(key)
      pressedRef.current.add(key)
    }
    const handleUp = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code]
      if (!key) return
      pressedRef.current.delete(key)
    }
    const handleBlur = () => {
      pressedRef.current.clear()
      justPressedRef.current.clear()
    }
    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleDown)
      window.removeEventListener('keyup', handleUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  const virtualPress = useCallback((key: LogicalKey) => {
    if (!pressedRef.current.has(key)) justPressedRef.current.add(key)
    pressedRef.current.add(key)
  }, [])

  const virtualRelease = useCallback((key: LogicalKey) => {
    pressedRef.current.delete(key)
  }, [])

  return { pressedRef, justPressedRef, virtualPress, virtualRelease }
}
