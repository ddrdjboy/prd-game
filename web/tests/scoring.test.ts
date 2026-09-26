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
      baseRevenue: 1.5,
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
        { id: 'r1', kind: 'network', name: 'A', score: 100, status: 'partner', locked: true, skills: ['retail', 'manage'], training: null },
        { id: 'r2', kind: 'romance', name: 'B', score: 90, status: 'married', locked: true, skills: [], training: null },
      ],
      shops: [shop],
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
