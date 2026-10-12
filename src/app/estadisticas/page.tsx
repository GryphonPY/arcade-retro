import type { Metadata } from 'next'
import { EstadisticasView } from './estadisticas-view'

export const metadata: Metadata = {
  title: 'Estadísticas — Arcade Retro',
  robots: { index: false, follow: false },
}

export default function EstadisticasPage() {
  return <EstadisticasView />
}
