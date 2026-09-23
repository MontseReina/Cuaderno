export const todayStr = () => toDateStr(new Date())
export function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
export function diffDays(a: string, b: string) {
  const da = new Date(a.slice(0, 10) + 'T12:00:00').getTime()
  const db = new Date(b.slice(0, 10) + 'T12:00:00').getTime()
  return Math.round((da - db) / 86400000)
}
export function weekStart(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const dow = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - dow)
  return toDateStr(d)
}
export function fmtDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s.length <= 10 ? s + 'T12:00:00' : s)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}
export function fmtDateTime(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
/** Horas de reloj: las que se escriben a mano en la app (perfusión, ingreso,
 *  última comida, citas…). Se guardan y se muestran tal cual, sin cambios de
 *  zona horaria: si se escribe 13:25, en todas partes pone 13:25. */
export function wallClock(s?: string | null) {
  if (!s) return ''
  return s.replace(' ', 'T').slice(0, 16)
}
function wallDate(s: string) {
  return new Date(wallClock(s) + ':00')
}
export function hoursBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null
  return Math.round(((wallDate(b).getTime() - wallDate(a).getTime()) / 3600000) * 10) / 10
}
/** Igual que fmtDateTime, pero para las horas escritas a mano (sin zona horaria). */
export function fmtWall(s?: string | null) {
  if (!s) return '—'
  const d = wallDate(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
/** Un `<input type="datetime-local">` solo admite «2026-09-23T13:25».
 *  La base de datos lo devuelve como «2026-09-23T13:25:00+00:00» y la casilla
 *  salía vacía aunque el dato estuviera guardado. Esto le quita lo que sobra. */
export function toLocalInput(v?: string | null) {
  return wallClock(v)
}

export function nowLocalInput() {
  const d = new Date()
  d.setSeconds(0, 0)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}
