import type { PlayerState, Relation, RelationKind } from './types'

export const OFFICE_RECOMMEND_COST = 0.25
export const OFFICE_UP_COST = 0.15
export const OFFICE_DOWN_COST = 0.2
export const OFFICE_POACH_COST = 0.35

export function adjustableRelations(
  actorId: string,
  players: PlayerState[],
): { owner: PlayerState; rel: Relation }[] {
  const out: { owner: PlayerState; rel: Relation }[] = []
  for (const p of players) {
    for (const r of p.relations) {
      if (r.status === 'broken') continue
      if (p.id !== actorId && r.locked) continue
      out.push({ owner: p, rel: r })
    }
  }
  return out
}

export function poachableTargets(
  actorId: string,
  players: PlayerState[],
): { owner: PlayerState; rel: Relation }[] {
  const out: { owner: PlayerState; rel: Relation }[] = []
  for (const p of players) {
    if (p.id === actorId) continue
    for (const r of p.relations) {
      if (r.status === 'broken' || r.locked) continue
      out.push({ owner: p, rel: r })
    }
  }
  return out
}

export function poachSuccessChance(score: number): number {
  return score > 70 ? 0.15 : 0.35
}

export function adjustDelta(
  actorId: string,
  ownerId: string,
  direction: 'up' | 'down',
): number {
  const self = actorId === ownerId
  if (direction === 'up') return self ? 10 : 6
  return self ? -12 : -10
}

export function recommendKinds(): RelationKind[] {
  return ['network', 'romance']
}
