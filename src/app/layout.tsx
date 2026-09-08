import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const pixelFont = Press_Start_2P({
  variable: "--font-pixel",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Arcade Retro MVS — 10 juegos arcade clásicos",
  description:
    "Sala arcade retro estilo Neo-Geo MVS / Candy Cab con 10 mini-juegos clásicos de recreativa: Asteroid Drift, Cyber Dungeon, Snake Neón, Invasión Espacial, Corredor del Desierto, Laberinto Fantasma, Carrera de Tráfico, Rompe Ladrillos, Hit & Run y Gun & Run. Sintetizador WebAudio chiptune y control táctil completo.",
  keywords: ["arcade", "neo-geo", "mvs", "chiptune", "retro gaming", "pixel art", "asteroids", "dungeon", "space invaders", "pacman", "snake"],
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pixelFont.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
