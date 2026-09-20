import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

const demo = !!process.env.DEMO_SINGLEFILE
const base = demo ? './' : (process.env.VITE_BASE || '/')

export default defineConfig({
  plugins: demo
    ? [react(), viteSingleFile()]
    : [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg'],
          manifest: {
            name: 'Cuaderno de cuidados',
            short_name: 'Cuaderno',
            description: 'Seguimiento diario del paciente para sus cuidadores',
            lang: 'es',
            start_url: base,
            display: 'standalone',
            background_color: '#f6f7f9',
            theme_color: '#1f5f8b',
            icons: [
              { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
            navigateFallback: base + 'index.html',
          },
        }),
      ],
  define: {
    'import.meta.env.VITE_SINGLEFILE': JSON.stringify(demo ? '1' : ''),
    // La demo de un solo fichero siempre funciona en local (sin Supabase), aunque exista .env.production
    ...(demo ? { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""' } : {}),
  },
  base,
  publicDir: demo ? 'public-demo' : 'public',
  build: { target: 'es2020' },
})
