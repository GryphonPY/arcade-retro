import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Press_Start_2P } from 'next/font/google'
import './globals.css'

const pixelFont = Press_Start_2P({
  variable: '--font-pixel',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
})

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#07070b',
}

export const metadata: Metadata = {
  title: 'Arcade Retro — 14 juegos arcade en tu navegador',
  description:
    'Catorce juegos arcade para jugar gratis en el navegador, en computadora o celular: Snake, invasores, laberinto con fantasmas, rompe ladrillos, carreras y más. Con música chiptune y controles táctiles.',
  keywords: ['arcade', 'juegos retro', 'snake', 'space invaders', 'pac-man', 'breakout', 'asteroids', 'chiptune'],
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Arcade Retro',
    statusBarStyle: 'black-translucent',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} ${pixelFont.variable}`}>{children}</body>
    </html>
  )
}
