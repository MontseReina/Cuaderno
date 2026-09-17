import { useState } from 'react'
import { save } from '../store'
import { Field } from '../components/ui'
import { uid } from '../store/store'

/** Alta del paciente (una sola vez). */
export default function Setup() {
  const [name, setName] = useState('')
  const [hospital, setHospital] = useState('')
  const [phone, setPhone] = useState('')
  const [catheter, setCatheter] = useState('')
  return (
    <div className="login card">
      <h1>Datos del paciente</h1>
      <p className="muted">Solo hace falta una vez. Todo se puede cambiar después en Ajustes.</p>
      <Field label="Nombre (o iniciales)">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Hospital">
        <input type="text" value={hospital} onChange={(e) => setHospital(e.target.value)} />
      </Field>
      <Field label="Teléfono de oncología de guardia" hint="Aparecerá en pantalla cuando el semáforo esté en rojo">
        <input type="text" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Tipo de catéter">
        <input type="text" value={catheter} onChange={(e) => setCatheter(e.target.value)} placeholder="p. ej. Port-a-cath, PICC" />
      </Field>
      <button
        className="btn block"
        disabled={!name.trim()}
        onClick={() => save('patients', { id: uid(), name: name.trim(), hospital, phone_oncology: phone, catheter_type: catheter, protocol: 'ISG-GEIS-OS-2' } as never)}
      >
        Empezar
      </button>
    </div>
  )
}
