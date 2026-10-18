/** Sustituto de `src/store` dentro de la función del servidor: las reglas de la app (cycle.ts) leen el paciente con
 *  `backend.all('patients')`; aquí devuelve lo que la función ha cargado de la base de datos. */
const datos: Record<string, unknown[]> = {}
export function setDatos(tabla: string, filas: unknown[]) { datos[tabla] = filas }
export const backend = {
  mode: 'supabase' as const,
  all: (t: string) => (datos[t] ?? []) as never[],
  currentUserId: () => '',
  currentUserName: () => 'servidor',
}
