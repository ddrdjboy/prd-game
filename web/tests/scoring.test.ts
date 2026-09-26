import { describe, it, expect } from 'vitest'
import { scorePlayer } from '../src/game/scoring'
import type { PlayerState } from '../src/game/types'

describe('scoring', () => {
  it('marks free and returns grade', () => {
    const p: PlayerState = {
      id: 'p0',
      name: '你',
      isHuman: true,
      careerId: 'dev',
      salary: 1,
      fixedExpense: 0.4,
      cash: 5,
      liabilities: 0,
      track: 'investor',
      position: 0,
      relations: [
        { id: 'r1', kind: 'network', name: 'A', score: 80, status: 'partner', locked: true },
        { id: 'r2', kind: 'romance', name: 'B', score: 90, status: 'married', locked: true },
      ],
      shops: [{ id: 's1', name: '店', level: 2, baseCashflow: 0.8, operatorRelationId: 'r1' }],
      investments: [],
      actionPoints: 0,
      aiStyle: null,
      trait: null,
      poachCooldown: 0,
      maintainedRelationIds: [],
    }
    const s = scorePlayer(p)
    expect(s.free).toBe(true)
    expect(['S', 'A', 'B', 'C']).toContain(s.grade)
    expect(s.comment.length).toBeGreaterThan(0)
  })
})
