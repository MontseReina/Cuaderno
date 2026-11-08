import { useState } from 'react'
import { save } from '../store'
import type { Patient } from '../store/types'
import { fmtDate, todayStr } from '../domain/dates'
import { Field, Section } from './ui'
import { confirmar } from './Confirmar'

/** 0.42.2 · La ventana de cirugía solo se ve en Medicación mientras está abierta o por llegar (sin alta, o alta hoy o después). */
export function cirugiaVigente(p: Patient, hoy = todayStr()) {
  return !!p.surgery_from && (!p.surgery_to || p.surgery_to.slice(0, 10) >= hoy)
}

/** Ventana «Cirugía» del semáforo: desde qué día se para la suplementación y hasta el alta (0.35.0). */
export function SurgeryCard({ patient }: { patient: Patient }) {
  const [from, setFrom] = useState(patient.surgery_from ?? '')
  const [to, setTo] = useState(patient.surgery_to ?? '')
  const changed = from !== (patient.surgery_from ?? '') || to !== (patient.surgery_to ?? '')
  const bad = !!from && !!to && to < from
  return (
    <Section title={'🏥 Cirugía' + (patient.surgery_from ? ` · desde ${fmtDate(patient.surgery_from)}${patient.surgery_to ? ` hasta ${fmtDate(patient.surgery_to)}` : ', sin alta apuntada'}` : '')}>
      <p className="muted small">Mientras dure esta ventana, cada producto sigue su semáforo de «Cirugía»: lo que está en rojo no se da ni cuenta como pendiente. Sin fecha de alta, la ventana sigue abierta. Cuando pasa el alta, deja de verse en Medicación y queda en Ciclos.</p>
      <div className="grid2">
        <Field label="Desde (se para la suplementación)"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta el alta (incluido)"><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {bad && <p className="small" style={{ color: 'var(--red)' }}>El alta no puede ser antes del inicio.</p>}
      <div className="row" style={{ gap: '.5rem' }}>
        <button className="btn sm" disabled={!changed || bad} onClick={() => save('patients', { ...patient, surgery_from: from || null, surgery_to: from ? (to || null) : null } as never)}>Guardar</button>
        {patient.surgery_from && <button className="btn sm ghost" onClick={async () => { if (await confirmar('¿Quitar la ventana de cirugía?')) save('patients', { ...patient, surgery_from: null, surgery_to: null } as never) }}>Quitar</button>}
      </div>
    </Section>
  )
}

