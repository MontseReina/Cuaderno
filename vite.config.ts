import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

/** Publica version.json con la versión de la app (APP_VERSION de exporter.ts). La app lo consulta
 *  sin caché para avisar de que hay una versión nueva cuando el móvil sigue con una antigua. */
function versionJson() {
  return {
    name: 'version-json',
    generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) {
      const src = readFileSync(fileURLToPath(new URL('./src/domain/exporter.ts', import.meta.url)), 'utf8')
      const version = /APP_VERSION = '([^']+)'/.exec(src)?.[1] ?? '0'
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) })
    },
  }
}

const demo = !!process.env.DEMO_SINGLEFILE
const base = demo ? './' : (process.env.VITE_BASE || '/')

export default defineConfig({
  plugins: demo
    ? [react(), viteSingleFile()]
    : [
        react(),
        versionJson(),
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
            globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
            maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
