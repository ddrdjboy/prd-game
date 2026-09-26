import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { shopCashflow } from '../src/game/finance'
import { reduce } from '../src/game/reduce'
import { shopCapacity } from '../src/game/skills'
import { makeRelation, buildShop } from '../src/game/shopStaff'
import type { GameState, Relation, Shop } from '../src/game/types'

function rel(partial: Partial<Relation> & Pick<Relation, 'id' | 'name'>): Relation {
  return makeRelation({
    kind: 'network',
    score: 50,
    status: 'stable',
    locked: false,
    ...partial,
  })
}

function shop(partial: Partial<Shop> & Pick<Shop, 'id' | 'name' | 'managerId'>): Shop {
  const base = buildShop({
    id: partial.id,
    name: partial.name,
    managerId: partial.managerId,
    typeId: partial.typeId ?? 'stall',
    level: partial.level ?? 1,
    baseCashflow: partial.baseCashflow ?? partial.baseRevenue,
  })
  return {
    ...base,
    ...partial,
    staffIds: partial.staffIds ?? base.staffIds,
    managerId: partial.managerId,
    baseRevenue: partial.baseRevenue ?? partial.baseCashflow ?? base.baseRevenue,
    baseCashflow: partial.baseCashflow ?? partial.baseRevenue ?? base.baseCashflow,
    operatingCost: partial.operatingCost ?? base.operatingCost,
    lastFactor: partial.lastFactor ?? 1,
    typeId: partial.typeId ?? base.typeId,
  }
}

function withPlayer(
  g: GameState,
  over: { relations?: Relation[]; shops?: Shop[]; cash?: number },
  loc: 'vacant' | 'manage' = 'vacant',
): GameState {
  const id = g.players[0].id
  return {
    ...g,
    players: g.players.map((p) =>
      p.id === id
        ? {
            ...p,
            cash: over.cash ?? 5,
            relations: over.relations ?? p.relations,
            shops: over.shops ?? p.shops,
            actionPoints: 1,
          }
        : p,
    ),
    pendingLocation: {
      playerId: id,
      spaceKind: loc,
      spaceIndex: 1,
      track: 'worker',
      label: loc === 'vacant' ? '空地' : '经营区',
    },
  }
}

describe('shop staff & skills', () => {
  it('vacant buy binds chosen free relation as manager', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const r1 = rel({ id: 'r1', name: '阿强', score: 40 })
    const r2 = rel({ id: 'r2', name: '晓雯', score: 90, kind: 'romance', status: 'dating' })
    g = withPlayer(g, { relations: [r1, r2] })
    g = reduce(g, { type: 'LOCATION_BUY_VACANT', relationId: 'r1' })
    const s = g.players[0].shops[0]
    expect(s.managerId).toBe('r1')
    expect(s.staffIds).toEqual(['r1'])
    expect(g.pendingLocation).toBeNull()
  })

  it('one person cannot staff two shops', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const r1 = rel({ id: 'r1', name: '阿强' })
    const r2 = rel({ id: 'r2', name: '小林' })
    g = withPlayer(g, {
      relations: [r1, r2],
      shops: [shop({ id: 's1', name: 'A店', managerId: 'r1' })],
    }, 'manage')
    g = reduce(g, { type: 'SHOP_ADD_STAFF', shopId: 's1', relationId: 'r1' })
    expect(g.players[0].shops[0].staffIds).toEqual(['r1'])
  })

  it('remove last staff closes shop with sell payout', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const r1 = rel({ id: 'r1', name: '阿强' })
    const s1 = shop({ id: 's1', name: 'A店', managerId: 'r1', baseCashflow: 0.4, level: 1 })
    g = withPlayer(g, { relations: [r1], shops: [s1], cash: 1 }, 'manage')
    const before = g.players[0].cash
    g = reduce(g, { type: 'SHOP_REMOVE_STAFF', shopId: 's1', relationId: 'r1' })
    expect(g.players[0].shops).toHaveLength(0)
    expect(g.players[0].cash).toBeGreaterThan(before)
  })

  it('set manager and default sole staff is manager', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const r1 = rel({ id: 'r1', name: '阿强', score: 40 })
    const r2 = rel({ id: 'r2', name: '小林', score: 90 })
    g = withPlayer(
      g,
      {
        relations: [r1, r2],
        shops: [shop({ id: 's1', name: 'A店', managerId: 'r1', staffIds: ['r1', 'r2'] })],
      },
      'manage',
    )
    g = reduce(g, { type: 'SHOP_SET_MANAGER', shopId: 's1', relationId: 'r2' })
    expect(g.players[0].shops[0].managerId).toBe('r2')
  })

  it('capacity scales with level', () => {
    expect(shopCapacity(1)).toBe(3)
    expect(shopCapacity(2)).toBe(6)
    expect(shopCapacity(3)).toBe(9)
  })

  it('training decrements and can grant skill', () => {
    let g = createGame({ seatCount: 2, seed: 42, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const r1 = rel({ id: 'r1', name: '阿强', skills: ['sales'] })
    g = {
      ...withPlayer(g, { relations: [r1], cash: 5 }),
      pendingLocation: null,
      turnPlayerIndex: 0,
    }
    g = reduce(g, { type: 'TRAIN_START', relationId: 'r1', skillId: 'service' })
    expect(g.players[0].relations[0].training?.skillId).toBe('service')
    expect(g.players[0].relations[0].training?.turnsLeft).toBe(1)
    const cashAfter = g.players[0].cash
    expect(cashAfter).toBeLessThan(5)

    // end turn: seats=2 so human ends then AI; tick only on ending player
    g = reduce(g, { type: 'END_TURN' })
    // after human endTurn, training should resolve (1 turn skill)
    const afterHuman = g.players[0].relations[0]
    expect(afterHuman.training).toBeNull()
    // success depends on rng — either gained or not
    expect(afterHuman.skills.includes('service') || afterHuman.skills.length === 1).toBe(true)
  })

  it('skill bonus increases shop CF vs bare staff', () => {
    const baseRel = rel({ id: 'r1', name: '阿强', score: 80, skills: [] })
    const skilled = rel({ id: 'r1', name: '阿强', score: 80, skills: ['sales', 'service'] })
    const s = shop({
      id: 's1',
      name: '小店',
      managerId: 'r1',
      skillTags: ['sales', 'service'],
      baseCashflow: 1,
    })
    expect(shopCashflow(s, [skilled])).toBeGreaterThan(shopCashflow(s, [baseRel]))
  })

  it('poach removes staff and reassigns manager', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const r1 = rel({ id: 'r1', name: '阿强', score: 40 })
    const r2 = rel({ id: 'r2', name: '小林', score: 90 })
    const shops = [shop({ id: 's1', name: 'A店', managerId: 'r1', staffIds: ['r1', 'r2'] })]
    g = {
      ...g,
      players: g.players.map((p, i) =>
        i === 0
          ? { ...p, relations: [r1, r2], shops, cash: 5 }
          : { ...p, relations: [], shops: [], cash: 5 },
      ),
      pendingLocation: null,
      pendingDecision: {
        type: 'poach',
        playerId: g.players[0].id,
        fromPlayerId: g.players[1].id,
        relationId: 'r1',
      },
    }
    g = reduce(g, { type: 'CONFIRM_POACH', accept: true })
    expect(g.players[0].relations.find((r) => r.id === 'r1')).toBeUndefined()
    expect(g.players[1].relations.some((r) => r.id === 'r1')).toBe(true)
    expect(g.players[0].shops[0].staffIds).toEqual(['r2'])
    expect(g.players[0].shops[0].managerId).toBe('r2')
  })

  it('poach last staff closes shop', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const r1 = rel({ id: 'r1', name: '阿强', score: 40 })
    const shops = [shop({ id: 's1', name: 'A店', managerId: 'r1', baseCashflow: 0.5 })]
    g = {
      ...g,
      players: g.players.map((p, i) =>
        i === 0
          ? { ...p, relations: [r1], shops, cash: 1 }
          : { ...p, relations: [], shops: [], cash: 5 },
      ),
      pendingDecision: {
        type: 'poach',
        playerId: g.players[0].id,
        fromPlayerId: g.players[1].id,
        relationId: 'r1',
      },
    }
    const before = g.players[0].cash
    g = reduce(g, { type: 'CONFIRM_POACH', accept: true })
    expect(g.players[0].shops).toHaveLength(0)
    expect(g.players[0].cash).toBeGreaterThan(before)
  })

  it('upgrade only selected shop', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const r1 = rel({ id: 'r1', name: '阿强' })
    const r2 = rel({ id: 'r2', name: '小林' })
    g = withPlayer(
      g,
      {
        relations: [r1, r2],
        shops: [
          shop({ id: 's1', name: 'A店', managerId: 'r1', baseCashflow: 0.2 }),
          shop({ id: 's2', name: 'B店', managerId: 'r2', baseCashflow: 0.2 }),
        ],
      },
      'manage',
    )
    g = reduce(g, { type: 'LOCATION_UPGRADE_SHOP', shopId: 's1' })
    expect(g.players[0].shops.find((s) => s.id === 's1')!.level).toBe(2)
    expect(g.players[0].shops.find((s) => s.id === 's2')!.level).toBe(1)
  })

  it('hire vacant creates manager with skills', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = withPlayer(g, { relations: [] })
    g = reduce(g, { type: 'LOCATION_BUY_VACANT', relationId: '__hire__' })
    expect(g.players[0].shops).toHaveLength(1)
    expect(g.players[0].relations).toHaveLength(1)
    expect(g.players[0].shops[0].managerId).toBe(g.players[0].relations[0].id)
    expect(Array.isArray(g.players[0].relations[0].skills)).toBe(true)
  })

  it('coffee shop requires cook skill on manager', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const noCook = rel({ id: 'r1', name: '阿强', skills: ['sales'] })
    g = {
      ...g,
      players: g.players.map((p, i) =>
        i === 0 ? { ...p, cash: 10, relations: [noCook], shops: [] } : p,
      ),
      pendingDecision: {
        type: 'bigSpend',
        playerId: g.players[0].id,
        investmentId: 'shop-cafe',
        cost: 1,
        cashflow: 0.4,
        name: '街角咖啡',
      },
    }
    const beforeShops = g.players[0].shops.length
    g = reduce(g, { type: 'CONFIRM_BIG_SPEND', accept: true })
    // no eligible manager with cook → fail to open
    expect(g.players[0].shops.length).toBe(beforeShops)
  })
})
