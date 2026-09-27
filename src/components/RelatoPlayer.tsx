import { useEffect, useMemo, useRef, useState } from 'react'
import type { Relato } from '../domain/relato'

/** Reproductor del relato del día: SOLO AUDIO (decisión de la familia, 27/09/2026).
 *  Lee el texto con la voz del propio móvil (sin internet, sin coste), frase a frase:
 *  así se puede pausar y seguir en el iPhone, donde «pausa» no funciona bien. */

const PREFERIDAS = ['mónica', 'monica', 'marisol', 'jorge', 'google español', 'paulina', 'lucía', 'lucia']

function vozEspañola(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const voces = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('es'))
  if (!voces.length) return null
  const puntos = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase()
    let p = 0
    if (v.lang.toLowerCase() === 'es-es') p += 10
    if (/mejorad|enhanced|premium|natural/.test(n)) p += 6
    const i = PREFERIDAS.findIndex((x) => n.includes(x))
    if (i >= 0) p += 5 - i * 0.3
    return p
  }
  return [...voces].sort((a, b) => puntos(b) - puntos(a))[0]
}

const listenedKey = (date: string) => `huma_relato_${date}`

export function RelatoPlayer({ relato, date }: { relato: Relato; date: string }) {
  const frases = useMemo(() => relato.parrafos.flatMap((p, pi) =>
    (p.texto.match(/[^.!?…]+[.!?…]+\S*\s*|[^.!?…]+$/g) ?? [p.texto]).map((f) => f.trim()).filter(Boolean).map((f) => ({ f, pi }))), [relato])
  const [sonando, setSonando] = useState(false)
  const [idx, setIdx] = useState(0)
  const [lento, setLento] = useState(false)
  const lentoRef = useRef(false)
  const [escuchado, setEscuchado] = useState(() => { try { return localStorage.getItem(listenedKey(date)) === 'fin' } catch { return false } })
  const gen = useRef(0)
  const voz = useRef<SpeechSynthesisVoice | null>(null)
  const hayVoz = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    if (!hayVoz) return
    const cargar = () => { voz.current = vozEspañola() }
    cargar()
    speechSynthesis.addEventListener?.('voiceschanged', cargar)
    return () => { speechSynthesis.removeEventListener?.('voiceschanged', cargar); gen.current++; speechSynthesis.cancel() }
  }, [hayVoz])

  // Si cambia el día, se empieza de nuevo.
  useEffect(() => { gen.current++; if (hayVoz) speechSynthesis.cancel(); setSonando(false); setIdx(0) }, [date, hayVoz])

  const decir = (i: number, g: number) => {
    if (g !== gen.current) return
    if (i >= frases.length) {
      setSonando(false); setIdx(0); setEscuchado(true)
      try { localStorage.setItem(listenedKey(date), 'fin') } catch { /* sin almacenamiento */ }
      return
    }
    setIdx(i)
    const u = new SpeechSynthesisUtterance(frases[i].f)
    u.lang = 'es-ES'
    if (voz.current) u.voice = voz.current
    u.rate = lentoRef.current ? 0.78 : 0.92
    u.pitch = 1.05
    u.onend = () => setTimeout(() => decir(i + 1, g), frases[i + 1] && frases[i + 1].pi !== frases[i].pi ? 450 : 120)
    u.onerror = () => { if (g === gen.current) setSonando(false) }
    speechSynthesis.speak(u)
  }

  const play = (desde = idx) => {
    if (!hayVoz) return
    const g = ++gen.current
    speechSynthesis.cancel()
    if (!voz.current) voz.current = vozEspañola()
    setSonando(true)
    decir(desde, g)
  }
  const pausa = () => { gen.current++; speechSynthesis.cancel(); setSonando(false) }
  const atras = () => {
    const pi = frases[idx]?.pi ?? 0
    const i = Math.max(0, frases.findIndex((x) => x.pi === Math.max(0, pi - 1)))
    if (sonando) play(i); else setIdx(i)
  }

  const pct = frases.length ? Math.round((idx / frases.length) * 100) : 0

  return (
    <section className={'r2-player' + (sonando ? ' sonando' : '')} aria-label="El relato de hoy">
      <div className="r2-player-fila">
        {sonando
          ? <button type="button" className="r2-play" onClick={pausa} aria-label="Pausa">❚❚</button>
          : <button type="button" className="r2-play" onClick={() => play()} aria-label="Escuchar el relato" disabled={!hayVoz}>▶</button>}
        <div className="r2-player-txt">
          <small>📻 El relato de hoy · capítulo {relato.numero}<span className="r2-eq" aria-hidden="true"><b /><b /><b /></span></small>
          <strong>{relato.titulo}</strong>
          <em>{hayVoz ? `Unos ${relato.minutos} minutos${escuchado ? ' · ✓ escuchado' : ''}` : 'Este móvil no puede leer en voz alta'}</em>
        </div>
      </div>
      <div className="r2-player-bar" aria-hidden="true"><i style={{ width: `${sonando || idx ? pct : escuchado ? 100 : 0}%` }} /></div>
      <div className="r2-player-ctrl">
        <button type="button" onClick={atras} disabled={!hayVoz}>⏮ Atrás</button>
        <button type="button" aria-pressed={lento} onClick={() => { lentoRef.current = !lento; setLento(!lento); if (sonando) play(idx) }}>🐢 Más despacio</button>
      </div>
    </section>
  )
}
