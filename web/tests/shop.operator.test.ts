import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'
import type { GameState, Relation, Shop } from '../src/game/types'

function withRelations(g: GameState, relations: Relation[], shops: Shop[] = []): GameState {
  const id = g.players[0].id
  return {
    ...g,
    players: g.players.map((p) =>
      p.id === id ? { ...p, cash: 5, relations, shops, actionPoints: 1 } : p,
    ),
    pendingLocation: {
      playerId: id,
      spaceKind: 'vacant',
      spaceIndex: 1,
      track: 'worker',
      label: '空地',
    },
  }
}

const r1: Relation = {
  id: 'r1',
  kind: 'network',
  name: '阿强',
  score: 40,
  status: 'stable',
  locked: false,
}
const r2: Relation = {
  id: 'r2',
  kind: 'romance',
  name: '小美',
  score: 90,
  status: 'dating',
  locked: false,
}

describe('shop operator bind', () => {
  it('vacant buy binds chosen relation not highest score', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = withRelations(g, [r1, r2])
    g = reduce(g, { type: 'LOCATION_BUY_VACANT', relationId: 'r1' })
    const shop = g.players[0].shops[0]
    expect(shop.operatorRelationId).toBe('r1')
    expect(g.pendingLocation).toBeNull()
  })

  it('upgrade shop only upgrades selected shop', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const shops: Shop[] = [
      { id: 's1', name: 'A店', level: 1, baseCashflow: 0.2, operatorRelationId: 'r1' },
      { id: 's2', name: 'B店', level: 1, baseCashflow: 0.2, operatorRelationId: 'r2' },
    ]
    g = withRelations(g, [r1, r2], shops)
    g = {
      ...g,
      pendingLocation: {
        playerId: g.players[0].id,
        spaceKind: 'manage',
        spaceIndex: 2,
        track: 'worker',
        label: '经营区',
      },
    }
    g = reduce(g, { type: 'LOCATION_UPGRADE_SHOP', shopId: 's1' })
    const p = g.players[0]
    expect(p.shops.find((s) => s.id === 's1')!.level).toBe(2)
    expect(p.shops.find((s) => s.id === 's2')!.level).toBe(1)
    expect(g.pendingLocation).toBeNull()
  })

  it('rebind operator changes operatorRelationId', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const shops: Shop[] = [
      { id: 's1', name: 'A店', level: 1, baseCashflow: 0.2, operatorRelationId: 'r1' },
    ]
    g = withRelations(g, [r1, r2], shops)
    g = {
      ...g,
      pendingLocation: {
        playerId: g.players[0].id,
        spaceKind: 'manage',
        spaceIndex: 2,
        track: 'worker',
        label: '经营区',
      },
    }
    g = reduce(g, { type: 'LOCATION_REBIND_OPERATOR', shopId: 's1', relationId: 'r2' })
    expect(g.players[0].shops[0].operatorRelationId).toBe('r2')
    expect(g.pendingLocation).toBeNull()
  })

  it('vacant can hire temporary operator without relations', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = withRelations(g, [])
    g = reduce(g, { type: 'LOCATION_BUY_VACANT', relationId: '__hire__' })
    expect(g.players[0].shops).toHaveLength(1)
    expect(g.players[0].relations).toHaveLength(1)
    expect(g.players[0].shops[0].operatorRelationId).toBe(g.players[0].relations[0].id)
    expect(g.pendingLocation).toBeNull()
  })
})
