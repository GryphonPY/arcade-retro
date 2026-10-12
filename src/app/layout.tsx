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

const SITE_TITLE = 'Arcade Retro — 32 juegos gratis para niños y grandes'
const SITE_DESCRIPTION =
  'Juegos sencillos y divertidos para jugar gratis en el celular o la computadora, sin instalar nada: cruza el camino con el pollito, corta frutas con el dedo, golpea al topo, vuela con Flap Pixel, apila la torre y muchos más. Récords con amigos y música chiptune.'

export const metadata: Metadata = {
  metadataBase: new URL('https://arcade-retro-cool.periwinkle-cookie.workers.dev'),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    'juegos para niños',
    'juegos gratis',
    'juegos online',
    'juegos para celular',
    'cruza el camino',
    'corta frutas',
    'topo',
    'flappy',
    'arcade',
    'juegos retro',
  ],
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: '/',
    siteName: 'Arcade Retro',
    title: 'Arcade Retro — juegos gratis para jugar en el celular',
    description: 'Cruza el camino, corta frutas, golpea al topo y 29 juegos más. Gratis y sin instalar nada.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Arcade Retro: el pollito, el pájaro, la sandía, el topo y el gatito del globo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arcade Retro — juegos gratis para jugar en el celular',
    description: 'Cruza el camino, corta frutas, golpea al topo y 29 juegos más. Gratis y sin instalar nada.',
    images: ['/og.png'],
  },
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
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
