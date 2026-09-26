import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'
import type { GameState, Relation } from '../src/game/types'

const rel: Relation = {
  id: 'r1',
  kind: 'network',
  name: '阿强',
  score: 40,
  status: 'stable',
  locked: false,
}

function at(g: GameState, spaceKind: 'park' | 'invest'): GameState {
  const id = g.players[0].id
  return {
    ...g,
    players: g.players.map((p) =>
      p.id === id ? { ...p, cash: 5, relations: [rel], investments: [] } : p,
    ),
    pendingLocation: {
      playerId: id,
      spaceKind,
      spaceIndex: 3,
      track: 'investor',
      label: spaceKind === 'park' ? '公园' : '投资所',
    },
  }
}

describe('park / invest locations', () => {
  it('park chat boosts relation', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = at(g, 'park')
    g = reduce(g, { type: 'LOCATION_PARK_CHAT', relationId: 'r1' })
    expect(g.players[0].relations[0].score).toBe(45)
    expect(g.pendingLocation).toBeNull()
  })

  it('invest buy adds investment', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = at(g, 'invest')
    const before = g.players[0].cash
    g = reduce(g, { type: 'LOCATION_BUY_INVEST', offerId: 'bond' })
    expect(g.players[0].investments.some((i) => i.name.includes('债'))).toBe(true)
    expect(g.players[0].cash).toBeLessThan(before)
    expect(g.pendingLocation).not.toBeNull()
    expect(g.pendingExchange?.screen).toBe('funds')
  })

  it('invest sell returns 90% cost', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const id = g.players[0].id
    g = {
      ...at(g, 'invest'),
      players: g.players.map((p) =>
        p.id === id
          ? {
              ...p,
              cash: 1,
              relations: [rel],
              investments: [{ id: 'inv1', name: '债基', cost: 1, cashflow: 0.06 }],
            }
          : p,
      ),
      pendingLocation: {
        playerId: id,
        spaceKind: 'invest',
        spaceIndex: 3,
        track: 'investor',
        label: '投资所',
      },
    }
    g = reduce(g, { type: 'LOCATION_SELL_INVEST', investmentId: 'inv1' })
    expect(g.players[0].investments).toHaveLength(0)
    expect(g.players[0].cash).toBeCloseTo(1.9, 5)
    expect(g.pendingLocation).not.toBeNull()
  })
})
