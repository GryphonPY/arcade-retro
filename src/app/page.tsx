'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { GAMES } from '@/components/games/catalog'
import { sfx } from '@/components/games/sfx'
import { primeMusic, startMusic } from '@/components/games/music'
import { Hub } from '@/components/arcade/hub'
import { GameView } from '@/components/arcade/game-view'
import { markPlayed } from '@/components/arcade/store'
import { iniciarNube } from '@/components/arcade/nube'

// El juego abierto vive en el hash (#snake-neon): se puede compartir el
// enlace y el botón "atrás" del navegador/celular regresa a la sala.
function subscribeHash(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

let enteredFromHub = false

function readHash() {
  const id = decodeURIComponent(window.location.hash.slice(1))
  return GAMES.some((g) => g.id === id) ? id : null
}

export default function Home() {
  const activeId = useSyncExternalStore(subscribeHash, readHash, () => null)

  // El audio arranca con el primer gesto del usuario (política de autoplay).
  useEffect(() => {
    primeMusic()
    // Modo sin conexión e instalación como app (solo en producción).
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // Progreso en la nube: sube y baja la partida según el código de este aparato.
  useEffect(() => iniciarNube(), [])

  useEffect(() => {
    if (!activeId) enteredFromHub = false
    startMusic(activeId ?? 'hub')
  }, [activeId])

  const play = useCallback((id: string) => {
    sfx.coin()
    markPlayed(id)
    enteredFromHub = true
    window.location.hash = id
  }, [])

  const exit = useCallback(() => {
    if (enteredFromHub) {
      // Regresa en el historial para no apilar entradas al entrar y salir.
      enteredFromHub = false
      window.history.back()
    } else {
      // Se entró directo por enlace: limpia el hash sin salir del sitio.
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
  }, [])

  const activeGame = GAMES.find((g) => g.id === activeId)

  return (
    <>
      {/* La sala queda montada debajo para conservar el scroll al volver. */}
      <div aria-hidden={!!activeGame} inert={!!activeGame}>
        <Hub onPlay={play} />
      </div>
      {activeGame && <GameView game={activeGame} onExit={exit} />}
    </>
  )
}
