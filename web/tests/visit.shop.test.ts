import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'
import { buildShop, makeRelation } from '../src/game/shopStaff'
import {
  findShopAt,
  visitEntryFee,
  visitSlotChanceBonus,
  VISIT_MANAGER_RAPPORT,
  VISIT_STAFF_RAPPORT,
} from '../src/game/visitShop'
import { migrateState } from '../src/persist'
import type { GameState } from '../src/game/types'

function baseState(): GameState {
  const g = createGame({ seatCount: 2, seed: 7 })
  return {
    ...g,
    phase: 'playing',
    turnRolled: true,
    players: g.players.map((p, i) =>
      i === 0
        ? { ...p, cash: 5, careerId: 'dev', salary: 1, fixedExpense: 0.4 }
        : {
            ...p,
            cash: 2,
            careerId: 'sales',
            salary: 1,
            fixedExpense: 0.4,
            relations: [
              makeRelation({
                id: 'mgr1',
                kind: 'network',
                name: '阿伟',
                score: 40,
                status: 'stable',
                locked: false,
              }),
              makeRelation({
                id: 'st1',
                kind: 'network',
                name: '小美',
                score: 55,
                status: 'stable',
                locked: false,
              }),
            ],
            shops: [
              buildShop({
                id: 'lot-worker-3-99',
                name: '市区空地店',
                typeId: 'vacantLot',
                managerId: 'mgr1',
                boardTrack: 'worker',
                boardIndex: 3,
              }),
            ],
          },
    ),
  }
}

function withStaff(g: GameState): GameState {
  return {
    ...g,
    players: g.players.map((p) => {
      if (p.id !== 'p1') return p
      return {
        ...p,
        shops: p.shops.map((s) =>
          s.id === 'lot-worker-3-99' ? { ...s, staffIds: ['mgr1', 'st1'], managerId: 'mgr1' } : s,
        ),
      }
    }),
  }
}

describe('visit opponent shop', () => {
  it('records boardTrack/Index on vacant buy', () => {
    let g = createGame({ seatCount: 2, seed: 11 })
    g = {
      ...g,
      phase: 'playing',
      pendingLocation: {
        playerId: 'p0',
        spaceKind: 'vacant',
        spaceIndex: 4,
        track: 'worker',
        label: '空地',
      },
      players: g.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              cash: 5,
              careerId: 'dev',
              salary: 1,
              fixedExpense: 0.4,
              relations: [
                makeRelation({
                  id: 'r1',
                  kind: 'network',
                  name: '店长甲',
                  score: 50,
                  status: 'stable',
                  locked: false,
                }),
              ],
            }
          : p,
      ),
    }
    g = reduce(g, { type: 'LOCATION_BUY_VACANT', relationId: 'r1' })
    const shop = g.players[0].shops[0]
    expect(shop.boardTrack).toBe('worker')
    expect(shop.boardIndex).toBe(4)
    expect(findShopAt(g.players, 'worker', 4)?.ownerId).toBe('p0')
  })

  it('lands on owned vacant opens pendingVisitShop for non-owner', () => {
    let g = withStaff(baseState())
    g = {
      ...g,
      pendingDecision: { type: 'promote', playerId: 'p0' },
      deferredLocation: {
        playerId: 'p0',
        spaceKind: 'vacant',
        spaceIndex: 3,
        track: 'worker',
        label: '空地',
      },
      pendingLocation: null,
      pendingVisitShop: null,
    }
    g = reduce(g, { type: 'SKIP_PROMOTE' })
    expect(g.pendingVisitShop?.ownerId).toBe('p1')
    expect(g.pendingVisitShop?.shopId).toBe('lot-worker-3-99')
    expect(g.pendingVisitShop?.step).toBe('pay')
    expect(g.pendingLocation?.spaceKind).toBe('vacant')
  })

  it('owner landing on own shop clears without visit', () => {
    let g = withStaff(baseState())
    g = {
      ...g,
      pendingDecision: { type: 'promote', playerId: 'p1' },
      deferredLocation: {
        playerId: 'p1',
        spaceKind: 'vacant',
        spaceIndex: 3,
        track: 'worker',
        label: '空地',
      },
      pendingLocation: null,
      pendingVisitShop: null,
      turnPlayerIndex: 1,
    }
    g = reduce(g, { type: 'SKIP_PROMOTE' })
    expect(g.pendingVisitShop).toBeNull()
    expect(g.pendingLocation).toBeNull()
    expect(g.logs.some((l) => /回到自己的店/.test(l.text))).toBe(true)
  })

  it('pay transfers cash to owner; talk/staff raise rapport', () => {
    let g = withStaff(baseState())
    const fee = visitEntryFee(g.players[1].shops[0])
    g = {
      ...g,
      pendingLocation: {
        playerId: 'p0',
        spaceKind: 'vacant',
        spaceIndex: 3,
        track: 'worker',
        label: '空地',
      },
      pendingVisitShop: {
        playerId: 'p0',
        ownerId: 'p1',
        shopId: 'lot-worker-3-99',
        step: 'pay',
        entryFee: fee,
        tipFee: 0.12,
        paid: false,
        staffId: null,
        rapport: 0,
        lastReels: null,
        lastPoachOk: null,
      },
    }
    const ownerCash = g.players[1].cash
    const visitorCash = g.players[0].cash
    g = reduce(g, { type: 'VISIT_PAY' })
    expect(g.pendingVisitShop?.paid).toBe(true)
    expect(g.players[0].cash).toBeCloseTo(visitorCash - fee, 5)
    expect(g.players[1].cash).toBeCloseTo(ownerCash + fee, 5)
    expect(g.pendingVisitShop?.step).toBe('talkManager')

    g = reduce(g, { type: 'VISIT_TALK' })
    expect(g.pendingVisitShop?.rapport).toBe(VISIT_MANAGER_RAPPORT)
    expect(g.pendingVisitShop?.step).toBe('pickStaff')

    const tip = g.pendingVisitShop!.tipFee
    const beforeTipOwner = g.players[1].cash
    g = reduce(g, { type: 'VISIT_PICK_STAFF', relationId: 'st1' })
    expect(g.pendingVisitShop?.staffId).toBe('st1')
    expect(g.pendingVisitShop?.rapport).toBe(VISIT_MANAGER_RAPPORT + VISIT_STAFF_RAPPORT)
    expect(g.players[1].cash).toBeCloseTo(beforeTipOwner + tip, 5)
    expect(g.pendingVisitShop?.step).toBe('gift')
  })

  it('successful poach moves relation and clears staff from shop', () => {
    let g = withStaff(baseState())
    g = {
      ...g,
      rngState: 42,
      pendingLocation: {
        playerId: 'p0',
        spaceKind: 'vacant',
        spaceIndex: 3,
        track: 'worker',
        label: '空地',
      },
      pendingVisitShop: {
        playerId: 'p0',
        ownerId: 'p1',
        shopId: 'lot-worker-3-99',
        step: 'poach',
        entryFee: 0.1,
        tipFee: 0.12,
        paid: true,
        staffId: 'st1',
        rapport: 100,
        lastReels: null,
        lastPoachOk: null,
      },
      players: g.players.map((p) =>
        p.id === 'p0' ? { ...p, cash: 5, poachCooldown: 0 } : p,
      ),
    }
    g = reduce(g, { type: 'VISIT_POACH_SPIN' })
    expect(g.pendingVisitShop?.lastPoachOk).toBe(true)
    expect(g.players[0].relations.some((r) => r.name === '小美')).toBe(true)
    const ownerShop = g.players[1].shops.find((s) => s.id === 'lot-worker-3-99')
    expect(ownerShop?.staffIds.includes('st1')).toBe(false)
  })
  it('migrate infers board from lot- id', () => {
    const raw = {
      ...createGame({ seatCount: 2, seed: 3 }),
      players: [
        {
          ...createGame({ seatCount: 2, seed: 3 }).players[0],
          shops: [
            {
              id: 'lot-investor-8-123',
              name: '商圈空地店',
              level: 1 as const,
              baseCashflow: 0.22,
              operatorRelationId: 'r1',
            },
          ],
          relations: [
            {
              id: 'r1',
              kind: 'network' as const,
              name: '阿强',
              score: 40,
              status: 'stable' as const,
              locked: false,
            },
          ],
        },
        createGame({ seatCount: 2, seed: 3 }).players[1],
      ],
    }
    const m = migrateState(raw as unknown as GameState)
    expect(m.pendingVisitShop).toBeNull()
    expect(m.players[0].shops[0].boardTrack).toBe('investor')
    expect(m.players[0].shops[0].boardIndex).toBe(8)
  })

  it('slot bonus: 777 is large', () => {
    expect(visitSlotChanceBonus([7, 7, 7])).toBe(0.45)
    expect(visitSlotChanceBonus([1, 1, 9])).toBe(0.1)
  })
})
