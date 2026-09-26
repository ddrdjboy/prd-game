import { describe, it, expect } from 'vitest'
import { decayPlayerRelations, willBreakNextDecay } from '../src/game/relations'
import type { PlayerState, Relation } from '../src/game/types'

function rel(over: Partial<Relation> & Pick<Relation, 'id'>): Relation {
  return {
    kind: 'network',
    name: '测试',
    score: 50,
    status: 'stable',
    locked: false,
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
  }
}

describe('decayPlayerRelations', () => {
  it('unlocked relations lose 4 score', () => {
    const { player: p } = decayPlayerRelations(player([rel({ id: 'r1', score: 50 })]))
    expect(p.relations[0].score).toBe(46)
    expect(p.relations[0].status).toBe('stable')
  })

  it('locked relations lose only 1', () => {
    const { player: p } = decayPlayerRelations(
      player([rel({ id: 'r1', score: 80, locked: true, status: 'partner' })]),
    )
    expect(p.relations[0].score).toBe(79)
    expect(p.relations[0].locked).toBe(true)
  })

  it('breaks when score drops to 10 or below', () => {
    const { player: p, brokenNames } = decayPlayerRelations(
      player([rel({ id: 'r1', score: 12, locked: false })]),
    )
    expect(p.relations[0].score).toBe(8)
    expect(p.relations[0].status).toBe('broken')
    expect(p.relations[0].locked).toBe(false)
    expect(brokenNames).toEqual(['测试'])
  })

  it('skips already broken relations', () => {
    const { player: p, cooled } = decayPlayerRelations(
      player([rel({ id: 'r1', score: 5, status: 'broken' })]),
    )
    expect(p.relations[0].score).toBe(5)
    expect(cooled).toBe(false)
  })

  it('skips maintained relation ids', () => {
    const { player: p, cooled } = decayPlayerRelations(
      player([
        rel({ id: 'r1', score: 50 }),
        rel({ id: 'r2', name: '乙', score: 40 }),
      ]),
      ['r1'],
    )
    expect(p.relations[0].score).toBe(50)
    expect(p.relations[1].score).toBe(36)
    expect(cooled).toBe(true)
  })
})

describe('willBreakNextDecay', () => {
  it('flags unlocked relations at or below break+decay', () => {
    expect(willBreakNextDecay(rel({ id: 'r1', score: 14 }))).toBe(true)
    expect(willBreakNextDecay(rel({ id: 'r1', score: 15 }))).toBe(false)
  })

  it('ignores already broken', () => {
    expect(willBreakNextDecay(rel({ id: 'r1', score: 5, status: 'broken' }))).toBe(false)
  })
})
