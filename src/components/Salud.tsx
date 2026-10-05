import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { backend, currentPatientId, save, useRows } from '../store'
import { addDays, todayStr } from '../domain/dates'
import { cycleContext, dailyTraffic, symptomsForToday } from '../domain/cycle'

/** Semáforo de salud de hoy, calculado igual en toda la app (pantalla «Hoy» y banda roja). */
export function useSaludHoy() {
  const today = todayStr()
  const patient = backend.all('patients')[0]
  const cycles = useRows('cycles')
  const diagnoses = useRows('diagnoses')
  const logs = useRows('daily_logs')
  const ctx = cycleContext(cycles, today)
  const byDate = new Map(logs.map((l) => [l.date, l]))
  const prev = [1, 2, 3].map((n) => byDate.get(addDays(today, -n))).filter((l): l is NonNullable<typeof l> => !!l)
  const todayLog = byDate.get(today)
  const traffic = dailyTraffic(todayLog, prev, ctx, symptomsForToday(ctx, diagnoses))
  return { today, patient, todayLog, traffic, ctx }
}

/** Si el semáforo de salud está en rojo, crea un pendiente urgente (una vez por día).
 *  Antes vivía en Inicio; ahora se comprueba en cualquier pantalla. */
export function usePendienteRojo(level: string, reasons: string[]) {
  const today = todayStr()
  const motivo = reasons.join('; ')
  useEffect(() => {
    if (level !== 'rojo') return
    const exists = backend.all('todos').some((t) => t.origin === 'semaforo' && t.created_at.slice(0, 10) === today && t.status === 'pendiente')
    if (!exists) {
      save('todos', {
        patient_id: currentPatientId(),
        title: 'Semáforo ROJO hoy: llamar a oncología / acudir a urgencias',
        pillar: 'Registro diario', assignees: [], priority: 'urgente', origin: 'semaforo', status: 'pendiente', do_date: today,
        notes: motivo,
      })
    }
  }, [level, today, motivo])
}

/** Banda fija de salud en rojo: se ve en todas las pantallas de los cuidadores, con la llamada a un toque. */
export function BandaSalud({ reasons, phone }: { reasons: string[]; phone?: string | null }) {
  return (
    <div className="banda-salud" role="alert">
      <div className="banda-salud-txt">
        <strong>Salud en rojo</strong>
        {reasons.length > 0 && <span>{reasons.join(' · ')}</span>}
        <span className="banda-salud-nota">No dar antitérmico antes de llamar.</span>
      </div>
      {phone
        ? <a className="banda-salud-btn" href={`tel:${phone}`}>📞 Llamar a oncología</a>
        : <Link className="banda-salud-btn" to="/ajustes">Poner el teléfono</Link>}
    </div>
  )
}
