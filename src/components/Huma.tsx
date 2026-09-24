/** Las seis formas de Huma, dibujadas a partir de la estela (símbolo de la app).
 *  Son dibujos propios: nada de personajes de otros. */

const ESTELA = 'M12 20c-4.4 0-7.5-3.1-7.5-7 0-3.3 2.6-5.8 5.8-5.8 2.6 0 4.6 1.9 4.6 4.4 0 2-1.5 3.5-3.4 3.5-1.4 0-2.5-1-2.5-2.3 0-1 .7-1.7 1.6-1.7'
const PLUMA_1 = 'M13.5 4.5c2.5 1 4.5 3 5.5 5.5'
const PLUMA_2 = 'M15.5 3c3 1.2 5.2 3.6 6 6.5'
const PLUMA_3 = 'M11.5 6.8c1.8.7 3.2 2.1 3.9 3.9'
const LLAMA = 'M6.5 4.5c.4 1.1 1.4 1.5 1.4 2.7a1.4 1.4 0 0 1-2.8 0c0-1.2 1-1.6 1.4-2.7z'
const RAYOS = 'M2.5 9.5l1.6.6M2.8 16l1.6-.5M20.6 16.8l1.6.5M8.5 2.3l.6 1.5M21.2 5.5l-1.2 1.1M4.5 21l1.2-1.1M19 21l-1.1-1.2'

const PATHS: Record<string, string[]> = {
  huevo: ['M9.5 14.5c0-1.6 1.1-2.7 2.5-2.7 1 0 1.7.7 1.7 1.6'],
  cria: ['M5.8 13.5v.8a6.2 6.2 0 0 0 12.4 0v-.8', 'M5.8 13.5l2-2 2 2 2.2-2 2 2 2.2-2 2 2', 'M12 10.5c-1.6 0-2.7-1.1-2.7-2.5 0-1.2.9-2.1 2.1-2.1.9 0 1.6.7 1.6 1.5 0 .7-.5 1.2-1.2 1.2'],
  plumon: [ESTELA, PLUMA_1],
  alado: [ESTELA, PLUMA_1, PLUMA_2],
  llama: [ESTELA, PLUMA_1, PLUMA_2, PLUMA_3, LLAMA],
  fenix: [ESTELA, PLUMA_1, PLUMA_2, PLUMA_3, RAYOS],
}

export function Forma({ k, size = 32, color = 'currentColor', width = 1.8 }: { k: string; size?: number; color?: string; width?: number }) {
  const paths = PATHS[k] ?? PATHS.huevo
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {k === 'huevo' && <ellipse cx="12" cy="13" rx="6.2" ry="7.8" />}
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}
