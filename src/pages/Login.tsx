import { useState } from 'react'
import { backend, isDemo } from '../store'
import { LocalBackend } from '../store/local'
import { SupabaseBackend } from '../store/supabase'
import { uid } from '../store/store'
import { Field } from '../components/ui'
import { Lockup } from '../components/Logo'

export default function Login() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')

  if (isDemo) {
    const local = backend as LocalBackend
    return (
      <div className="login card">
        <div style={{ margin: '.4rem 0 1rem' }}><Lockup size={92} /></div>
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
      <div style={{ margin: '.4rem 0 1rem' }}><Lockup size={92} /></div>
      <p className="muted">Acceso solo por invitación. Escribe tu correo y te llegará un enlace para entrar.</p>
      {sent ? (
        <>
          {email.includes('@') && <p className="small">Te hemos enviado un correo a <strong>{email}</strong>.</p>}
          <p className="small muted">Si estás en el navegador, pulsa el enlace del correo y ya está. Si has abierto <strong>Huma desde el icono del móvil</strong>, el enlace abre el navegador y no la app: mantén pulsado el enlace en el correo, elige <strong>Copiar</strong> y pégalo aquí.</p>
          <Field label="Pega aquí el enlace del correo">
            <input type="text" value={code} onChange={(e) => { setCode(e.target.value); setErr('') }} placeholder="https://…" />
          </Field>
          <button className="btn block" disabled={code.trim().length < 6} onClick={async () => {
            const v = code.trim()
            const { error } = /^\d{6}$/.test(v) ? await sb.signInWithCode(email.trim(), v) : await sb.signInWithLink(v)
            if (error) setErr(error.message)
          }}>Entrar</button>
          {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}
          <button className="btn block secondary" style={{ marginTop: '.5rem' }} onClick={() => { setSent(false); setCode(''); setErr('') }}>Volver</button>
        </>
      ) : (
        <>
          <Field label="Correo electrónico">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button
            className="btn block"
            disabled={!email.includes('@')}
            onClick={async () => {
              setErr('')
              const { error } = await sb.signInWithEmail(email.trim())
              if (!error) { setSent(true); return }
              setErr(/rate limit/i.test(error.message)
                ? 'Se han pedido demasiados correos en la última hora (como mucho 2 por hora entre todos los usuarios). Espera una hora antes de pedir otro. Si ya tienes un enlace del correo, pulsa «Ya tengo el enlace del correo».'
                : error.message)
            }}
          >
            Enviarme el enlace
          </button>
          {err && <p className="small" style={{ color: 'var(--red)' }}>{err}</p>}
          {/* 0.50.2 · Para pegar un enlace pedido antes (p. ej. desde el navegador) sin pedir otro correo. */}
          <button className="btn block secondary" style={{ marginTop: '.5rem' }} onClick={() => { setErr(''); setSent(true) }}>
            Ya tengo el enlace del correo
          </button>
        </>
      )}
    </div>
  )
}
