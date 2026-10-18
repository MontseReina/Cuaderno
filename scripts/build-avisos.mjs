// Empaqueta la función «avisos» en un solo fichero para pegarlo en Supabase → Edge Functions (editor).
// Uso: node scripts/build-avisos.mjs  →  supabase/functions/avisos/bundle/index.ts
import { build } from 'rolldown'
import { fileURLToPath } from 'node:url'
import { writeFileSync, readFileSync } from 'node:fs'

const root = fileURLToPath(new URL('..', import.meta.url))
const stub = root + 'supabase/functions/avisos/store-stub.ts'
const entry = process.argv[2] === 'node' ? 'handler.ts' : 'deno-entry.ts'
const out = root + `supabase/functions/avisos/bundle/${process.argv[2] === 'node' ? 'handler.mjs' : 'index.ts'}`

await build({
  input: root + 'supabase/functions/avisos/' + entry,
  platform: 'neutral',
  plugins: [{
    name: 'store-stub',
    resolveId(src, importer) {
      if (importer && /src[\\/]domain/.test(importer) && src === '../store') return stub
      return null
    },
  }],
  output: { file: out, format: 'esm', codeSplitting: false },
  write: true,
  logLevel: 'warn',
})
const code = readFileSync(out, 'utf8')
writeFileSync(out, `// @ts-nocheck\n// Generado con scripts/build-avisos.mjs a partir de supabase/functions/avisos (no editar a mano).\n${code}`)
console.log(out, Math.round(code.length / 1024) + ' KB')
