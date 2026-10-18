/** Punto de entrada en Supabase (Deno). Secretos de la función: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT y
 *  CRON_SECRET. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo (la clave nunca sale de allí). */
import { handle } from './handler'

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): void }

Deno.serve((req) => handle(req, {
  url: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  cronSecret: Deno.env.get('CRON_SECRET') ?? '',
  vapid: {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    subject: Deno.env.get('VAPID_SUBJECT') ?? 'https://montsereina.github.io/Cuaderno/',
  },
}).catch((e) => new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } })))
