import { makeRelation } from '../../src/game/shopStaff'
import type { Relation } from '../../src/game/types'

export function testRelation(
  over: Partial<Relation> & { id: string; name?: string },
): Relation {
  return makeRelation({
    id: over.id,
    name: over.name ?? '测试',
    affinity: over.affinity ?? 150,
    locked: over.locked ?? false,
    skills: over.skills,
    training: over.training,
  })
}
