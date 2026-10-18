import { useEffect, useState, type ReactNode } from 'react'
import type { DailyLog } from '../store/types'
import { AYUNO_MAX_H } from '../domain/catalogs'
import { aHora, aMin, ayunoNocturno, ultimaComida } from '../domain/nutrition'

/** Reloj del ayuno (0.33.0), igual que en New Version. */
const R = 88
const LARGO = 2 * Math.PI * R
const dos = (n: number) => String(n).padStart(2, '0')

/** Un aro con el tiempo en el centro. `seg` = segundos transcurridos; sin `enMarcha` queda fijo y no enseña segundos. */
function Aro({ seg, enMarcha, vacio }: { seg: number; enMarcha: boolean; vacio?: boolean }) {
  const parte = vacio ? 0 : Math.min(1, seg / (AYUNO_MAX_H * 3600))
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle className="reloj-fondo" cx="100" cy="100" r={R} />
      <circle className="reloj-aro" cx="100" cy="100" r={R} strokeDasharray={LARGO} strokeDashoffset={LARGO * (1 - parte)} transform="rotate(-90 100 100)" />
      <text className="reloj-uni" x="100" y="60" textAnchor="middle">horas</text>
      <text className="reloj-num" x="100" y="100" textAnchor="middle">{vacio ? '–:––' : `${Math.floor(seg / 3600)}:${dos(Math.floor(seg / 60) % 60)}`}</text>
      {!vacio && <text className="reloj-seg" x="100" y="136" textAnchor="middle">{enMarcha ? `${dos(seg % 60)} s` : 'parado'}</text>}
    </svg>
  )
}
const nivel = (seg: number) => (seg > AYUNO_MAX_H * 3600 ? 'rojo' : seg >= (AYUNO_MAX_H - 1) * 3600 ? 'amarillo' : 'verde')

/** Dos relojes con la hora real. A la izquierda, el ayuno de la noche: desde la última comida de ayer hasta que se
 *  escribe la hora de la primera toma de hoy, y ahí se para. A la derecha, el tiempo desde la última comida. */
export function RelojAyuno({ ayer, hoy }: { ayer: DailyLog | undefined; hoy: DailyLog | undefined }) {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => { const t = window.setInterval(() => setAhora(new Date()), 1000); return () => window.clearInterval(t) }, [])
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes()
  const s = ahora.getSeconds()
  const noche = ayunoNocturno(ayer, hoy, ahoraMin)
  const ultima = ultimaComida(ayer, hoy, ahoraMin)

  let izq: ReactNode
  if (!noche) {
    izq = <div className="reloj-uno"><Aro seg={0} enMarcha={false} vacio /><strong>Ayuno de la noche</strong><div className="muted small">Ayer no hay ninguna comida con hora.</div></div>
  } else {
    const seg = noche.minutos * 60 + (noche.enMarcha ? s : 0)
    const lv = nivel(seg)
    const tope = aHora((aMin(noche.desdeHora) ?? 0) + AYUNO_MAX_H * 60)
    izq = (
      <div className={'reloj-uno ' + lv} role="timer" aria-label={`Ayuno de la noche: ${Math.floor(seg / 3600)} horas y ${Math.floor(seg / 60) % 60} minutos`}>
        <Aro seg={seg} enMarcha={noche.enMarcha} />
        <strong>Ayuno de la noche</strong>
        <div className="small">Desde: {noche.desdeNombre.toLowerCase()} de ayer, {noche.desdeHora}.</div>
        {noche.enMarcha
          ? (lv === 'rojo'
            ? <div className="small reloj-aviso">Has pasado de las {AYUNO_MAX_H} horas. Toca comer.</div>
            : <div className="muted small">En marcha hasta que se escriba la hora de la primera toma. Antes de las {tope}.</div>)
          : <div className={'small ' + (lv === 'rojo' ? 'reloj-aviso' : 'muted')}>Parado con: {noche.finNombre!.toLowerCase()}, {noche.finHora}.{lv === 'rojo' ? ` Más de ${AYUNO_MAX_H} horas.` : ''}</div>}
      </div>
    )
  }

  let der: ReactNode
  if (!ultima) {
    der = <div className="reloj-uno"><Aro seg={0} enMarcha={false} vacio /><strong>Desde la última comida</strong><div className="muted small">Aún no hay ninguna comida con hora.</div></div>
  } else {
    const seg = ultima.minutos * 60 + s
    der = (
      <div className={'reloj-uno ' + nivel(seg)} role="timer" aria-label={`Desde la última comida: ${Math.floor(seg / 3600)} horas y ${Math.floor(seg / 60) % 60} minutos`}>
        <Aro seg={seg} enMarcha />
        <strong>Desde la última comida</strong>
        <div className="small">{ultima.nombre}{ultima.ayer ? ' de ayer' : ''}, {ultima.hora}.</div>
        <div className="muted small">Ahora son las {dos(ahora.getHours())}:{dos(ahora.getMinutes())}.</div>
      </div>
    )
  }
  return <div className="card reloj">{izq}{der}</div>
}
