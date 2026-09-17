import { useState } from 'react'
import { unlock } from '../domain/pin'

export default function PinGate({ onOk }: { onOk: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  const press = (d: string) => {
    const next = (pin + d).slice(0, 6)
    setPin(next)
    setErr(false)
    if (unlock(next)) onOk()
  }
  return (
    <div className="login card" style={{ textAlign: 'center' }}>
      <h1>Cuaderno de cuidados</h1>
      <p className="muted">Introduce el PIN</p>
      <div style={{ fontSize: '1.8rem', letterSpacing: '.4rem', minHeight: '2.4rem' }}>{'•'.repeat(pin.length)}</div>
      {err && <p className="small" style={{ color: 'var(--red)' }}>PIN incorrecto</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem', maxWidth: 260, margin: '1rem auto' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
          <button key={i} className="btn secondary" style={{ fontSize: '1.3rem', padding: '.8rem 0', visibility: k === '' ? 'hidden' : 'visible' }}
            onClick={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : press(k))}>{k}</button>
        ))}
      </div>
      <button className="btn sm ghost" onClick={() => { if (!unlock(pin)) setErr(true); else onOk() }}>Entrar</button>
    </div>
  )
}
