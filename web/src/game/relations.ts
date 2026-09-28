import { RELATION_DECAY_LOCKED, RELATION_DECAY_UNLOCKED } from './config'
import { applyAffinityDelta, stageFromAffinity } from './affinity'
import type { PlayerState, Relation } from './types'

export interface DecayResult {
  player: PlayerState
  cooled: boolean
  /** 本回合掉进仇恨段的名字 */
  brokenNames: string[]
}

export function decayPlayerRelations(
  player: PlayerState,
  skipRelationIds: string[] = [],
): DecayResult {
  const skip = new Set(skipRelationIds)
  const brokenNames: string[] = []
  let cooled = false

  const relations: Relation[] = player.relations.map((r) => {
    if (skip.has(r.id)) return r
    const drop = r.locked ? RELATION_DECAY_LOCKED : RELATION_DECAY_UNLOCKED
    const before = r.affinity
    const { affinity } = applyAffinityDelta(r.affinity, -drop)
    if (affinity !== before) cooled = true
    if (before > 0 && affinity <= 0) brokenNames.push(r.name)
    const locked = affinity > 0 && stageFromAffinity(affinity) !== 'hate' ? r.locked : false
    return { ...r, affinity, locked: affinity <= 0 ? false : locked }
  })

  return {
    player: { ...player, relations },
    cooled,
    brokenNames,
  }
}

/** 再衰减一次是否会跌入仇恨（≤0） */
export function willBreakNextDecay(r: Relation): boolean {
  if (r.affinity <= 0) return false
  const drop = r.locked ? RELATION_DECAY_LOCKED : RELATION_DECAY_UNLOCKED
  const { affinity } = applyAffinityDelta(r.affinity, -drop)
  return affinity <= 0
}
