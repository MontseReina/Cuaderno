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
export function hoursBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null
  return Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 3600000) * 10) / 10
}
export function nowLocalInput() {
  const d = new Date()
  d.setSeconds(0, 0)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}
