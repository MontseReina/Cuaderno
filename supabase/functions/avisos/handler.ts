/** Función del servidor «avisos» (Supabase Edge Function). La llama la base de datos cada 5 minutos (pg_cron) y la app
 *  para el aviso de prueba. Las reglas y los textos están en `src/domain/avisos.ts` (los mismos que ve la app).
 *
 *  Acciones (POST JSON):
 *  - `{accion:'tick'}` con la cabecera `x-cron-secret`: hace lo que toque a esa hora de Madrid (controles de 12, 16 y
 *    19 h, aviso de las 21 h, de las 21:30, de ayuno y cierre del día de ayer). Con `ahora` (fecha y hora de Madrid,
 *    «2026-10-19T12:05») simula otra hora; con `dry:true` solo devuelve lo que haría, sin guardar ni mandar nada.
 *  - `{accion:'prueba'}` con la sesión del usuario: manda un aviso de prueba a sus móviles. */
import { setDatos } from './store-stub'
import { sendPush, type VapidKeys } from './webpush'
import {
  avisoAyuno, avisoCierre, avisoDelMomento, avisoParaManana, controlesDelMomento, controlesFinales, modoDelDia,
  pendientesDelDia, tareasALaHora, TITULOS, type Aviso, type Control, type DatosDia,
} from '../../../src/domain/avisos'
import { addDays } from '../../../src/domain/dates'
import type { Cycle, DailyLog, Intake, Patient, Product, WeightEntry } from '../../../src/store/types'

export interface Env {
  url: string
  serviceKey: string
  cronSecret: string
  vapid: VapidKeys
}

interface SubRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Fecha y hora de Madrid. */
export function madrid(now: Date): { date: string; hhmm: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }
}

function db(env: Env, fetchFn: typeof fetch) {
  const headers = { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, 'Content-Type': 'application/json' }
  const get = async <T>(path: string): Promise<T[]> => {
    const r = await fetchFn(`${env.url}/rest/v1/${path}`, { headers })
    if (!r.ok) throw new Error(`GET ${path.split('?')[0]}: ${r.status} ${await r.text()}`)
    return r.json()
  }
  const insert = async <T>(table: string, rows: unknown[], ignoreDup = false): Promise<T[]> => {
    if (!rows.length) return []
    const q = ignoreDup ? '?on_conflict=patient_id,date,momento,area' : ''
    const r = await fetchFn(`${env.url}/rest/v1/${table}${q}`, {
      method: 'POST', headers: { ...headers, Prefer: `return=representation${ignoreDup ? ',resolution=ignore-duplicates' : ''}` }, body: JSON.stringify(rows),
    })
    if (!r.ok) throw new Error(`INSERT ${table}: ${r.status} ${await r.text()}`)
    return r.json()
  }
  const patch = async (table: string, filter: string, values: unknown) => {
    const r = await fetchFn(`${env.url}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(values) })
    if (!r.ok) throw new Error(`PATCH ${table}: ${r.status} ${await r.text()}`)
  }
  return { get, insert, patch }
}

async function enviar(env: Env, fetchFn: typeof fetch, subs: SubRow[], aviso: Aviso, tag: string) {
  const d = db(env, fetchFn)
  const res = await Promise.all(subs.map(async (s) => {
    try {
      const r = await sendPush(s, { title: aviso.title, body: aviso.body, tag, url: './#/' }, env.vapid, fetchFn)
      if (r.ok) await d.patch('push_subscriptions', `id=eq.${s.id}`, { last_ok_at: new Date().toISOString(), last_error: null }).catch(() => {})
      else await d.patch('push_subscriptions', `id=eq.${s.id}`, r.gone ? { deleted_at: new Date().toISOString(), last_error: `${r.status}` } : { last_error: `${r.status} ${r.text ?? ''}`.slice(0, 300) }).catch(() => {})
      return r
    } catch (e) {
      return { ok: false, status: 0, gone: false, text: String(e) }
    }
  }))
  return { enviados: res.filter((r) => r.ok).length, total: subs.length, errores: res.filter((r) => !r.ok).map((r) => `${r.status} ${r.text ?? ''}`.trim()) }
}

export async function handle(req: Request, env: Env, fetchFn: typeof fetch = fetch, now = new Date()): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST' }, 405)
  let body: { accion?: string; ahora?: string; dry?: boolean } = {}
  try { body = await req.json() } catch { /* vacío */ }

  if (body.accion === 'prueba') {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const u = await fetchFn(`${env.url}/auth/v1/user`, { headers: { apikey: env.serviceKey, Authorization: `Bearer ${token}` } })
    if (!u.ok) return json({ error: 'Sin sesión' }, 401)
    const user = await u.json() as { id: string }
    const d = db(env, fetchFn)
    const subs = await d.get<SubRow & { patient_id: string }>(`push_subscriptions?select=*&user_id=eq.${user.id}&deleted_at=is.null`)
    if (!subs.length) return json({ enviados: 0, total: 0, errores: ['Este usuario no tiene ningún móvil con los avisos activados'] })
    const r = await enviar(env, fetchFn, subs, { title: TITULOS.prueba, body: 'Si ves esto, los avisos llegan bien a este móvil 🌿' }, 'prueba')
    const { date } = madrid(now)
    await d.insert('avisos', [{ patient_id: subs[0].patient_id, date, momento: `prueba ${now.toISOString().slice(11, 19)}`, area: 'envio', titulo: TITULOS.prueba, texto: 'Aviso de prueba', enviados: r.enviados }]).catch(() => {})
    return json(r)
  }

  if (body.accion === 'tick') {
    if (!env.cronSecret || req.headers.get('x-cron-secret') !== env.cronSecret) return json({ error: 'No autorizado' }, 401)
    const t = body.ahora ? { date: body.ahora.slice(0, 10), hhmm: body.ahora.slice(11, 16) } : madrid(now)
    return json(await tick(env, fetchFn, t.date, t.hhmm, !!body.dry))
  }
  return json({ error: 'Acción desconocida' }, 400)
}

/** Lo que toca a esta hora de Madrid. Cada momento se hace una sola vez al día: la fila «envio» de la tabla `avisos`
 *  hace de candado (única por paciente, día, momento y área). */
export async function tick(env: Env, fetchFn: typeof fetch, date: string, hhmm: string, dry = false) {
  const tareas = tareasALaHora(hhmm)
  const hecho: unknown[] = []
  if (!tareas.length) return { date, hhmm, hecho }
  const d = db(env, fetchFn)
  const patient = (await d.get<Patient>('patients?select=*&deleted_at=is.null&order=created_at.asc&limit=1'))[0]
  if (!patient) return { date, hhmm, hecho: ['sin paciente'] }
  setDatos('patients', [patient])
  const pid = patient.id
  const ayer = addDays(date, -1)
  const [cycles, logs, weights, products, intakes, hechos, subs] = await Promise.all([
    d.get<Cycle>(`cycles?select=*&patient_id=eq.${pid}&deleted_at=is.null`),
    d.get<DailyLog>(`daily_logs?select=*&patient_id=eq.${pid}&deleted_at=is.null&date=gte.${addDays(date, -16)}`),
    d.get<WeightEntry>(`weights?select=*&patient_id=eq.${pid}&deleted_at=is.null&at=gte.${addDays(date, -40)}`),
    d.get<Product>(`products?select=*&patient_id=eq.${pid}&deleted_at=is.null`),
    d.get<Intake>(`intakes?select=*&patient_id=eq.${pid}&deleted_at=is.null&date=in.(${ayer},${date})`),
    d.get<{ date: string; momento: string }>(`avisos?select=date,momento&patient_id=eq.${pid}&area=eq.envio&date=in.(${ayer},${date})`),
    d.get<SubRow>(`push_subscriptions?select=*&patient_id=eq.${pid}&deleted_at=is.null`),
  ])
  const ya = new Set(hechos.map((h) => `${h.date}|${h.momento}`))
  const datos = (dia: string): DatosDia => ({
    date: dia,
    log: logs.find((l) => l.date === dia),
    ayer: logs.find((l) => l.date === addDays(dia, -1)),
    logs, weights, cycles, products,
    intakes: intakes.filter((i) => i.date === dia),
  })
  const base = (dia: string) => {
    const l = logs.find((x) => x.date === dia)
    return { patient_id: pid, date: dia, modo: modoDelDia(l, cycles, dia), lugar: l?.location ?? null }
  }
  const filasControl = (dia: string, momento: string, cs: Control[]) =>
    cs.map((c) => ({ ...base(dia), momento, area: c.area, valor: c.valor, meta: c.meta, ok: c.ok, texto: c.linea ?? null }))

  /** Toma el candado del momento; si ya lo tenía otro, no se hace nada. */
  const candado = async (dia: string, momento: string, aviso: Aviso | null, extra: Record<string, unknown> = {}) => {
    if (ya.has(`${dia}|${momento}`)) return false
    if (dry) return true
    const filas = await d.insert('avisos', [{ ...base(dia), momento, area: 'envio', titulo: aviso?.title ?? null, texto: aviso?.body ?? null, enviados: 0, ...extra }], true)
    ya.add(`${dia}|${momento}`)
    return filas.length > 0
  }
  const mandar = async (dia: string, momento: string, aviso: Aviso) => {
    if (dry || !subs.length) return { enviados: 0, total: subs.length, errores: [] as string[] }
    const r = await enviar(env, fetchFn, subs, aviso, momento)
    await d.patch('avisos', `patient_id=eq.${pid}&date=eq.${dia}&momento=eq.${momento}&area=eq.envio`, { enviados: r.enviados, errores: r.errores.length ? r.errores.join(' | ').slice(0, 500) : null })
    return r
  }

  for (const t of tareas) {
    if (t.tipo === 'momento') {
      const dd = datos(date)
      const cs = controlesDelMomento(t.momento, dd)
      const aviso = avisoDelMomento(t.momento, cs)
      if (!(await candado(date, t.momento, aviso))) continue
      if (!dry) await d.insert('avisos', filasControl(date, t.momento, cs), true)
      const r = aviso ? await mandar(date, t.momento, aviso) : null
      hecho.push({ momento: t.momento, controles: cs, aviso, envio: r })
    } else if (t.tipo === '21') {
      const aviso = avisoCierre(datos(date))
      if (!(await candado(date, '21', aviso))) continue
      hecho.push({ momento: '21', aviso, envio: await mandar(date, '21', aviso) })
    } else if (t.tipo === '2130') {
      const aviso = avisoParaManana(datos(date))
      if (!(await candado(date, '2130', aviso))) continue
      hecho.push({ momento: '2130', aviso, envio: await mandar(date, '2130', aviso) })
    } else if (t.tipo === 'ayuno') {
      const enviados = new Set([...ya].filter((k) => k.startsWith(date + '|ayuno')).map((k) => k.split('|')[1]))
      const a = avisoAyuno(datos(date), hhmm, enviados)
      if (!a) continue
      if (!(await candado(date, a.momento, a.aviso, { valor: Math.round(a.horas * 10) / 10, meta: 12 }))) continue
      hecho.push({ momento: a.momento, horas: a.horas, aviso: a.aviso, envio: await mandar(date, a.momento, a.aviso) })
    } else if (t.tipo === 'cierre') {
      // Cierre del día de AYER: cómo terminó cada apartado y qué quedó sin rellenar (cuenta como no hecho).
      const dd = datos(ayer)
      const cs = controlesFinales(dd)
      const pend = pendientesDelDia(dd)
      if (!(await candado(ayer, 'final', null, { texto: pend.length ? `Sin rellenar: ${pend.join(', ')}` : 'Todo rellenado', valor: pend.length }))) continue
      if (!dry) {
        await d.insert('avisos', [
          ...filasControl(ayer, 'final', cs),
          { ...base(ayer), momento: 'final', area: 'registro', valor: pend.length, meta: 0, ok: pend.length === 0, texto: pend.length ? pend.join(', ') : null },
        ], true)
        if (dd.log) {
          const cierre = { at: new Date().toISOString(), sin_rellenar: pend }
          await d.patch('daily_logs', `id=eq.${dd.log.id}`, { extra: { ...(dd.log.extra ?? {}), cierre } })
        }
      }
      hecho.push({ momento: 'final', dia: ayer, controles: cs, sin_rellenar: pend })
    }
  }
  return { date, hhmm, suscripciones: subs.length, hecho }
}
export { encryptPayload, vapidAuth, b64urlEncode, b64urlDecode } from './webpush'
