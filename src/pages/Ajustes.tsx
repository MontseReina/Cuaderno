import { useState } from 'react'
import { backend, isDemo, save, useRows } from '../store'
import type { Patient } from '../store/types'
import { LocalBackend } from '../store/local'
import { SupabaseBackend } from '../store/supabase'
import { Field } from '../components/ui'
import { knownUsers } from '../domain/users'
import { RetoAjustes } from '../components/RetoAjustes'

export default function Ajustes() {
  const patient = useRows('patients')[0]
  const [p, setP] = useState<Partial<Patient>>(patient ?? {})
  const users = knownUsers()
  const set = <K extends keyof Patient>(k: K, v: Patient[K]) => setP((x) => ({ ...x, [k]: v }))
  return (
    <div>
      <h1>Ajustes</h1>
      <div className="card">
        <h3>Paciente</h3>
        <Field label="Nombre"><input type="text" value={p.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="grid2">
          <Field label="Hospital"><input type="text" value={p.hospital ?? ''} onChange={(e) => set('hospital', e.target.value)} /></Field>
          <Field label="Teléfono oncología de guardia"><input type="text" value={p.phone_oncology ?? ''} onChange={(e) => set('phone_oncology', e.target.value)} /></Field>
          <Field label="Otro teléfono de urgencia"><input type="text" value={p.phone_emergency ?? ''} onChange={(e) => set('phone_emergency', e.target.value)} /></Field>
          <Field label="Día 1 del tratamiento" hint="La primera quimio: marca la semana 0 del protocolo"><input type="date" value={p.protocol_start ?? ''} onChange={(e) => set('protocol_start', e.target.value || null)} /></Field>
          <Field label="Superficie corporal (m²)"><input type="number" step="0.01" value={p.bsa_m2 ?? ''} onChange={(e) => set('bsa_m2', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Tipo de catéter"><input type="text" value={p.catheter_type ?? ''} onChange={(e) => set('catheter_type', e.target.value)} /></Field>
          <Field label="Catéter desde"><input type="date" value={p.catheter_since ?? ''} onChange={(e) => set('catheter_since', e.target.value)} /></Field>
          <Field label="Última cura del catéter"><input type="date" value={p.catheter_last_dressing ?? ''} onChange={(e) => set('catheter_last_dressing', e.target.value || null)} /></Field>
          <Field label="Cada cuántos días toca la cura" hint="La app avisa en Inicio cuando toca"><input type="number" value={p.catheter_dressing_days ?? ''} onChange={(e) => set('catheter_dressing_days', e.target.value === '' ? null : Number(e.target.value))} /></Field>
        </div>
        <Field label="Límites de carga marcados por traumatología"><textarea value={p.load_limits ?? ''} onChange={(e) => set('load_limits', e.target.value)} /></Field>
        <Field label="Notas"><textarea value={p.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        <button className="btn" onClick={() => save('patients', { ...patient, ...p } as never)}>Guardar</button>
      </div>
      <RetoAjustes />
      <div className="card">
        <h3>Usuarios</h3>
        <p className="muted small">Todos tienen los mismos permisos. Cada registro queda firmado con quién lo hizo (registro de actividad no visible en la app).</p>
        {users.map((u) => <div key={u.id} className="small">• {u.name}{u.id === backend.currentUserId() ? ' (tú)' : ''}</div>)}
        {isDemo ? (
          <p className="muted small">En modo demo cada dispositivo es un usuario. Para varios usuarios reales hace falta conectar Supabase (ver README).</p>
        ) : (
          <p className="muted small">Para invitar a alguien: Supabase → Authentication → Users → Invite user. Después añadir su correo a la tabla <code>patient_members</code>.</p>
        )}
      </div>
      <div className="card">
        <h3>Sesión</h3>
        <p className="muted small">Conectado como <strong>{backend.currentUserName()}</strong> · modo {isDemo ? 'demostración (datos solo en este dispositivo)' : 'Supabase'}</p>
        {isDemo ? (
          <div className="row">
            <button className="btn secondary" onClick={() => (backend as LocalBackend).setUser({ id: '', name: '' })}>Cambiar de usuario</button>

          </div>
        ) : (
          <button className="btn secondary" onClick={() => (backend as SupabaseBackend).signOut()}>Cerrar sesión</button>
        )}
      </div>
      <p className="muted small">Huma · Esta app registra y organiza; no da indicaciones médicas. Ante cualquier duda, el equipo tratante.</p>
    </div>
  )
}
