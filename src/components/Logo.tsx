import type { CSSProperties } from 'react'

/** Símbolo de Huma: la espiral que se desata en tres plumas (identidad Sadhaka). */
export function Mark({ size = 28, color = 'currentColor', width = 2.6, style }: { size?: number; color?: string; width?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" style={{ flex: 'none', ...style }}>
      <g fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
        <path d="M 82.5 61.8 L 77.2 60.9 L 72.8 58.4 L 69.6 54.8 L 68.0 50.5 L 67.8 46.2 L 69.1 42.3 L 71.4 39.3 L 74.5 37.3 L 77.8 36.5 L 81.1 36.8 L 83.9 38.1 L 86.0 40.2 L 87.2 42.8 L 87.4 45.4 L 86.8 47.8 L 85.5 49.8 L 83.7 51.1 L 81.7 51.7 L 79.7 51.7 L 77.9 51.0 L 76.6 49.8 L 75.8 48.3 L 75.5 46.7 L 75.8 45.2 L 76.5 43.9 L 77.5 43.0 L 78.7 42.6 L 80.0 42.5 L 81.1 42.9 L 81.9 43.6 L 82.5 44.4 L 82.7 45.4 L 82.6 46.3 L 82.2 47.1" />
        <path d="M 66 62 C 48 74 34 86 26 98" />
        <path d="M 72 68 C 58 82 48 94 42 106" />
        <path d="M 80 72 C 72 86 66 98 64 110" />
      </g>
    </svg>
  )
}

/** Logotipo completo para portadas y pantallas de entrada. */
export function Lockup({ size = 96 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.2rem' }}>
      <Mark size={size} color="var(--ink-deep)" width={2.2} />
      <div style={{ fontFamily: 'var(--font-title)', fontSize: `${Math.round(size * 0.42)}px`, letterSpacing: '.32em', marginLeft: '.32em', color: 'var(--ink-deep)' }}>HUMA</div>
      <div style={{ fontSize: '.68rem', letterSpacing: '.26em', textTransform: 'uppercase', color: 'var(--muted)' }}>seguimiento onco diario</div>
    </div>
  )
}
