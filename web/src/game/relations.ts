import {
  RELATION_BREAK_AT,
  RELATION_DECAY_LOCKED,
  RELATION_DECAY_UNLOCKED,
} from './config'
import type { PlayerState, Relation } from './types'

export interface DecayResult {
  player: PlayerState
  /** 是否有任何人分下降（含破裂） */
  cooled: boolean
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
    if (r.status === 'broken') return r
    if (skip.has(r.id)) return r
    const drop = r.locked ? RELATION_DECAY_LOCKED : RELATION_DECAY_UNLOCKED
    cooled = true
    const score = Math.max(0, r.score - drop)
    if (score <= RELATION_BREAK_AT) {
      brokenNames.push(r.name)
      return { ...r, score, status: 'broken' as const, locked: false }
    }
    return { ...r, score }
  })

  return {
    player: { ...player, relations },
    cooled,
    brokenNames,
  }
}

/** 再衰减一次是否会 ≤ 破裂线（未锁定用 unlocked 衰减） */
export function willBreakNextDecay(r: Relation): boolean {
  if (r.status === 'broken') return false
  const drop = r.locked ? RELATION_DECAY_LOCKED : RELATION_DECAY_UNLOCKED
  return r.score - drop <= RELATION_BREAK_AT
}
