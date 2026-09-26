import { describe, it, expect } from 'vitest'
import { calcFinance, canPromote, isFinanciallyFree, shopBreakdown, shopCashflow } from '../src/game/finance'
import { applyShopUpgrade, inferShopTypeId, rollSeasonFactor, SHOP_TYPES } from '../src/game/shopCatalog'
import { buildShop } from '../src/game/shopStaff'
import type { PlayerState, Relation, Shop } from '../src/game/types'

function baseRel(over: Partial<Relation> = {}): Relation {
  return {
    id: 'r1',
    kind: 'network',
    name: '阿强',
    score: 80,
    status: 'stable',
    locked: false,
    skills: ['sales'],
    training: null,
    ...over,
  }
}

function baseShop(over: Partial<Shop> = {}): Shop {
  return buildShop({
    id: 's1',
    name: '小店',
    typeId: 'stall',
    managerId: 'r1',
    ...over,
  })
}

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

describe('shop catalog', () => {
  it('has at least 12 types', () => {
    expect(SHOP_TYPES.length).toBeGreaterThanOrEqual(12)
  })

  it('infers type from name', () => {
    expect(inferShopTypeId('角落咖啡馆')).toBe('cafe')
    expect(inferShopTypeId('旗舰便利店')).toBe('convenience')
    expect(inferShopTypeId('市区空地店')).toBe('vacantLot')
  })

  it('upgrade tree raises revenue and cost', () => {
    const s = baseShop({ level: 1 })
    const u = applyShopUpgrade(s)
    expect(u.level).toBe(2)
    expect(u.baseRevenue).toBeGreaterThan(s.baseRevenue)
    expect(u.operatingCost).toBeGreaterThan(s.operatingCost)
  })

  it('season factor stays near 1', () => {
    const f = rollSeasonFactor(0, 0.1, () => 0.5)
    expect(f).toBeGreaterThan(0.9)
    expect(f).toBeLessThan(1.2)
  })
})

describe('finance shop P&L', () => {
  it('sums passive from shops and investments', () => {
    const p = basePlayer({
      shops: [baseShop()],
      investments: [{ id: 'i1', name: '指数基金', cost: 1, cashflow: 0.1 }],
      relations: [baseRel()],
    })
    const f = calcFinance(p)
    expect(f.passiveIncome).toBeGreaterThan(0)
    expect(f.totalExpense).toBeGreaterThanOrEqual(0.8)
  })

  it('empty staff still pays operating cost (negative net)', () => {
    const s = baseShop({ staffIds: [], managerId: '' })
    const bd = shopBreakdown(s, [baseRel()])
    expect(bd.gross).toBe(0)
    expect(bd.net).toBeLessThan(0)
    expect(shopCashflow(s, [baseRel()])).toBe(bd.net)
  })

  it('canPromote when passive > expense', () => {
    const poor = basePlayer()
    const shop = buildShop({
      id: 's1',
      name: '便利店',
      typeId: 'convenience',
      managerId: 'r1',
      baseRevenue: 1.2,
    })
    const rich2 = basePlayer({
      fixedExpense: 0.2,
      shops: [shop],
      relations: [baseRel({ score: 100, status: 'partner', locked: true, skills: ['retail', 'manage'] })],
    })
    expect(canPromote(rich2)).toBe(true)
    expect(canPromote(poor)).toBe(false)
  })

  it('isFinanciallyFree same rule as promote threshold', () => {
    const shop = buildShop({
      id: 's1',
      name: '便利店',
      typeId: 'convenience',
      managerId: 'r1',
      baseRevenue: 1.2,
    })
    const rich = basePlayer({
      fixedExpense: 0.2,
      shops: [shop],
      relations: [baseRel({ name: 'X', score: 100, status: 'partner', locked: true, skills: ['retail'] })],
    })
    expect(isFinanciallyFree(rich)).toBe(true)
  })
})
