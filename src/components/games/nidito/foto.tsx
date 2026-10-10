'use client'

import { Avatar } from './avatar'
import { buscarMueble, buscarPared, buscarPiso } from './muebles-data'
import type { Foto } from './types'

const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Foto en miniatura: vuelve a dibujar el cuarto y a la pareja con el estado guardado.
 * Todo va en porcentajes, así que la foto se ve igual a cualquier tamaño.
 */
export function FotoCuarto({ foto, className = '' }: { foto: Foto; className?: string }) {
  const pared = buscarPared(foto.pared)
  const piso = buscarPiso(foto.piso)
  const visibles = [...foto.muebles].sort((a, b) => a.y - b.y)
  const giro = foto.id.charCodeAt(foto.id.length - 1) % 2 === 0 ? -1.2 : 1.2
  return (
    <figure
      className={`nd-foto m-0 rounded-[10px] bg-white p-[7%] pb-[20%] shadow-[0_8px_18px_-10px_rgba(107,74,99,0.55)] ${className}`}
      style={{ transform: `rotate(${giro}deg)` }}
    >
      <style>{`.nd-foto svg.nd-svg{width:100%!important;height:auto!important}`}</style>
      <div className="relative w-full overflow-hidden rounded-[4px]" style={{ aspectRatio: '4 / 3' }}>
        <div className="absolute inset-x-0 top-0" style={{ height: '46%', background: pared.fondo }} />
        <div className="absolute inset-x-0" style={{ top: '46%', height: '4%', background: '#f7e6ee' }} />
        <div className="absolute inset-x-0 bottom-0" style={{ top: 'calc(46% + 4%)', background: piso.fondo }} />
        {visibles.map((mc) => {
          const m = buscarMueble(mc.id)
          if (!m) return null
          return (
            <div
              key={mc.uid}
              className="absolute"
              style={{
                left: `${mc.x * 100}%`,
                top: `${mc.y * 100}%`,
                width: `${m.ancho * 100}%`,
                aspectRatio: `${m.ancho} / ${m.alto}`,
                transform: 'translate(-50%, -100%)',
                zIndex: Math.round(mc.y * 1000),
              }}
            >
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="h-full w-full overflow-visible"
                style={{ transform: mc.flip ? 'scaleX(-1)' : undefined }}
                dangerouslySetInnerHTML={{ __html: m.svg }}
              />
            </div>
          )
        })}
        {foto.pareja.map((per, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${per.x * 100}%`,
              top: `${per.y * 100}%`,
              width: '17%',
              transform: `translate(-50%, -100%) scaleX(${per.dir})`,
              zIndex: Math.round(per.y * 1000) + 600,
            }}
          >
            <Avatar look={per.look} size={100} />
          </div>
        ))}
      </div>
      <figcaption className="mt-[4%] text-center text-[clamp(10px,2.4vw,13px)] font-extrabold text-[#a0607f]">
        {FECHA.format(new Date(foto.t))}
      </figcaption>
    </figure>
  )
}
