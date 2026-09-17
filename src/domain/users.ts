import { backend } from '../store'

/** Usuarios conocidos: perfiles registrados + quien haya firmado algún registro. */
export function knownUsers(): { id: string; name: string }[] {
  const map = new Map<string, string>()
  for (const p of backend.all('profiles')) map.set(p.id, p.name)
  const me = backend.currentUserId()
  if (me && !map.has(me)) map.set(me, backend.currentUserName())
  return Array.from(map, ([id, name]) => ({ id, name }))
}
