import { describe, it, expect } from 'vitest'
import { calcFinance, canPromote, isFinanciallyFree } from '../src/game/finance'
import type { PlayerState } from '../src/game/types'

function basePlayer(over: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p0',
    name: '你',
    isHuman: true,
    careerId: 'dev',
    salary: 1.2,
    fixedExpense: 0.8,
    cash: 2,
    liabilities: 0,
    track: 'worker',
    position: 0,
    relations: [],
    shops: [],
    investments: [],
    actionPoints: 1,
    aiStyle: null,
    trait: null,
    poachCooldown: 0,
    maintainedRelationIds: [],
    ...over,
  }
}

describe('finance', () => {
  it('sums passive from shops and investments', () => {
    const p = basePlayer({
      shops: [{ id: 's1', name: '小店', level: 1, baseCashflow: 0.3, operatorRelationId: 'r1' }],
      investments: [{ id: 'i1', name: '指数基金', cost: 1, cashflow: 0.1 }],
      relations: [{ id: 'r1', kind: 'network', name: '阿强', score: 80, status: 'stable', locked: false }],
    })
    const f = calcFinance(p)
    expect(f.passiveIncome).toBeGreaterThan(0.3)
    expect(f.totalExpense).toBeGreaterThanOrEqual(0.8)
  })

  it('canPromote when passive > expense', () => {
    const poor = basePlayer()
    const rich = basePlayer({
      fixedExpense: 0.5,
      shops: [{ id: 's1', name: '店', level: 2, baseCashflow: 0.8, operatorRelationId: 'r1' }],
      relations: [{ id: 'r1', kind: 'network', name: 'X', score: 100, status: 'partner', locked: true }],
    })
    expect(canPromote(rich)).toBe(true)
    expect(canPromote(poor)).toBe(false)
  })

  it('isFinanciallyFree same rule as promote threshold', () => {
    const rich = basePlayer({
      fixedExpense: 0.5,
      shops: [{ id: 's1', name: '店', level: 2, baseCashflow: 0.8, operatorRelationId: 'r1' }],
      relations: [{ id: 'r1', kind: 'network', name: 'X', score: 100, status: 'partner', locked: true }],
    })
    expect(isFinanciallyFree(rich)).toBe(true)
  })
})
