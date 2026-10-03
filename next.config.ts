import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Sitio 100% estático: se publica la carpeta ./out en Cloudflare.
  output: 'export',
  images: {
    unoptimized: true,
  },
}

export default nextConfig
