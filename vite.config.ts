import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

const demo = !!process.env.DEMO_SINGLEFILE
const base = demo ? './' : (process.env.VITE_BASE || '/')

export default defineConfig({
  plugins: demo
    ? [react(), viteSingleFile()]
    : [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: false, // el registro lo hace src/main.tsx (con recarga automática al actualizar)
          includeAssets: ['icon.svg'],
          manifest: {
            name: 'Huma - Onco Diario',
            short_name: 'Huma',
            description: 'Seguimiento diario del paciente para sus cuidadores',
            lang: 'es',
            start_url: base,
            display: 'standalone',
            background_color: '#FFFAF2',
            theme_color: '#CCDEDF',
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
  // En la demo de un solo fichero no hay plugin PWA: el registro es un sustituto vacío.
  resolve: demo ? { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/pwa/register-stub.ts', import.meta.url)) } } : undefined,
  publicDir: demo ? 'public-demo' : 'public',
  build: { target: 'es2020' },
})
