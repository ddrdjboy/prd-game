import { describe, it, expect } from 'vitest'
import { applyAffinityDelta } from '../src/game/affinity'
import { decayPlayerRelations, willBreakNextDecay } from '../src/game/relations'
import type { PlayerState, Relation } from '../src/game/types'

function rel(over: Partial<Relation> & Pick<Relation, 'id'>): Relation {
  return {
    name: '测试',
    affinity: 150,
    locked: false,
    skills: [],
    training: null,
    ...over,
  }
}

function player(relations: Relation[]): PlayerState {
  return {
    id: 'p0',
    name: '你',
    isHuman: true,
    careerId: 'dev',
    salary: 1,
    fixedExpense: 0.5,
    cash: 2,
    liabilities: 0,
    track: 'worker',
    position: 0,
    relations,
    shops: [],
    investments: [],
    actionPoints: 1,
    aiStyle: null,
    trait: null,
    poachCooldown: 0,
    maintainedRelationIds: [],
    negativePaydayStreak: 0,
  }
}

describe('decayPlayerRelations', () => {
  it('unlocked relations decay via applyAffinityDelta(-4)', () => {
    const before = 150
    const expected = applyAffinityDelta(before, -4).affinity
    const { player: p } = decayPlayerRelations(player([rel({ id: 'r1', affinity: before })]))
    expect(p.relations[0].affinity).toBe(expected)
  })

  it('locked relations use smaller raw drop', () => {
    const before = 400
    const expected = applyAffinityDelta(before, -1).affinity
    const { player: p } = decayPlayerRelations(
      player([rel({ id: 'r1', affinity: before, locked: true })]),
    )
    expect(p.relations[0].affinity).toBe(expected)
    expect(p.relations[0].locked).toBe(true)
  })

  it('entering hate lists brokenNames', () => {
    const { player: p, brokenNames } = decayPlayerRelations(
      player([rel({ id: 'r1', affinity: 2, locked: false })]),
    )
    expect(p.relations[0].affinity).toBeLessThanOrEqual(0)
    expect(p.relations[0].locked).toBe(false)
    expect(brokenNames).toEqual(['测试'])
  })

  it('still decays hate (no skip)', () => {
    const before = -20
    const expected = applyAffinityDelta(before, -4).affinity
    const { player: p, cooled } = decayPlayerRelations(
      player([rel({ id: 'r1', affinity: before })]),
    )
    expect(p.relations[0].affinity).toBe(expected)
    expect(cooled).toBe(true)
  })

  it('skips maintained relation ids', () => {
    const e2 = applyAffinityDelta(200, -4).affinity
    const { player: p, cooled } = decayPlayerRelations(
      player([
        rel({ id: 'r1', affinity: 250 }),
        rel({ id: 'r2', name: '乙', affinity: 200 }),
      ]),
      ['r1'],
    )
    expect(p.relations[0].affinity).toBe(250)
    expect(p.relations[1].affinity).toBe(e2)
    expect(cooled).toBe(true)
  })
})

describe('willBreakNextDecay', () => {
  it('flags when next decay would enter hate', () => {
    expect(willBreakNextDecay(rel({ id: 'r1', affinity: 1 }))).toBe(true)
    expect(willBreakNextDecay(rel({ id: 'r1', affinity: 80 }))).toBe(false)
  })

  it('ignores already in hate', () => {
    expect(willBreakNextDecay(rel({ id: 'r1', affinity: -10 }))).toBe(false)
  })
})
