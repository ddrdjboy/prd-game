import { describe, it, expect } from 'vitest'
import { scorePlayer } from '../src/game/scoring'
import { buildShop } from '../src/game/shopStaff'
import type { PlayerState } from '../src/game/types'

describe('scoring', () => {
  it('marks free and returns grade', () => {
    const shop = buildShop({
      id: 's1',
      name: '便利店',
      typeId: 'convenience',
      managerId: 'r1',
      level: 2,
      baseRevenue: 2.5,
    })
    const p: PlayerState = {
      id: 'p0',
      name: '你',
      isHuman: true,
      careerId: 'dev',
      salary: 1,
      fixedExpense: 0.3,
      cash: 5,
      liabilities: 0,
      track: 'investor',
      position: 0,
      relations: [
        { id: 'r1', name: 'A', affinity: 500, locked: true, skills: ['retail', 'manage'], training: null },
        { id: 'r2', name: 'B', affinity: 450, locked: true, skills: [], training: null },
      ],
      shops: [shop],
      investments: [{ id: 'i1', name: '基金', cost: 2, cashflow: 0.5 }],
      actionPoints: 0,
      aiStyle: null,
      trait: null,
      poachCooldown: 0,
      maintainedRelationIds: [],
      negativePaydayStreak: 0,
    }
    const s = scorePlayer(p)
    expect(s.free).toBe(true)
    expect(['S', 'A', 'B', 'C']).toContain(s.grade)
    expect(s.comment.length).toBeGreaterThan(0)
  })
})
