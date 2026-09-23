import { useState } from 'react'
import { backend, isDemo } from '../store'
import { LocalBackend } from '../store/local'
import { SupabaseBackend } from '../store/supabase'
import { uid } from '../store/store'
import { Field } from '../components/ui'

export default function Login() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  if (isDemo) {
    const local = backend as LocalBackend
    return (
      <div className="login card">
        <h1>Huma</h1>
        <p className="muted">Modo demostración: los datos se guardan solo en este dispositivo. Escribe tu nombre para que los registros queden firmados.</p>
        <Field label="Tu nombre">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Montse" />
        </Field>
        <button className="btn block" disabled={!name.trim()} onClick={() => local.setUser({ id: 'demo-' + uid().slice(0, 8), name: name.trim() })}>
          Entrar
        </button>
      </div>
    )
  }
  const sb = backend as SupabaseBackend
  return (
    <div className="login card">
      <h1>Huma</h1>
      <p className="muted">Acceso solo por invitación. Escribe tu correo y te llegará un enlace para entrar.</p>
      {sent ? (
        <p>Revisa tu correo y pulsa el enlace. Puedes cerrar esta pestaña.</p>
      ) : (
        <>
          <Field label="Correo electrónico">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button
            className="btn block"
            disabled={!email.includes('@')}
            onClick={async () => {
              const { error } = await sb.signInWithEmail(email.trim())
              if (error) alert(error.message)
              else setSent(true)
            }}
          >
            Enviarme el enlace
          </button>
        </>
      )}
    </div>
  )
}
