import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'
import type { GameState } from '../src/game/types'

function atInvest(cash = 5): GameState {
  let g = createGame({ seatCount: 2, seed: 9 })
  g = {
    ...g,
    phase: 'playing',
    turnRolled: true,
    players: g.players.map((p, i) =>
      i === 0
        ? { ...p, cash, careerId: 'dev', salary: 1, fixedExpense: 0.4, track: 'investor' }
        : p,
    ),
    pendingLocation: {
      playerId: 'p0',
      spaceKind: 'invest',
      spaceIndex: 3,
      track: 'investor',
      label: '投资所',
    },
  }
  return reduce(g, { type: 'EXCHANGE_ENTER' })
}

describe('exchange session', () => {
  it('enter opens lobby', () => {
    const g = atInvest()
    expect(g.pendingExchange?.screen).toBe('lobby')
  })

  it('trade open deducts stake and close returns cash', () => {
    let g = atInvest(5)
    const before = g.players[0].cash
    g = reduce(g, { type: 'EXCHANGE_OPEN_TRADE', stake: 1 })
    expect(g.pendingExchange?.screen).toBe('trade')
    expect(g.players[0].cash).toBeCloseTo(before - 1, 5)
    expect(g.pendingExchange?.trade?.cash).toBe(1)

    g = reduce(g, { type: 'EXCHANGE_BUY', symbolId: 'bluechip', amount: 0.3 })
    expect(g.pendingExchange?.trade?.positions.length).toBe(1)

    g = reduce(g, { type: 'EXCHANGE_TICK' })
    g = reduce(g, { type: 'EXCHANGE_CLOSE' })
    expect(g.pendingExchange?.screen).toBe('lobby')
    expect(g.pendingExchange?.tradeSessionsPlayed).toBe(1)
    expect(g.pendingExchange?.trade).toBeNull()
    // roughly back near before (minus trading PnL)
    expect(g.players[0].cash).toBeGreaterThan(3)
  })

  it('second trade session blocked', () => {
    let g = atInvest(5)
    g = reduce(g, { type: 'EXCHANGE_OPEN_TRADE', stake: 0.5 })
    g = reduce(g, { type: 'EXCHANGE_CLOSE' })
    const cash = g.players[0].cash
    g = reduce(g, { type: 'EXCHANGE_OPEN_TRADE', stake: 0.5 })
    expect(g.pendingExchange?.screen).toBe('lobby')
    expect(g.players[0].cash).toBeCloseTo(cash, 5)
  })

  it('funds buy keeps location', () => {
    let g = atInvest(5)
    g = reduce(g, { type: 'EXCHANGE_OPEN_FUNDS' })
    g = reduce(g, { type: 'LOCATION_BUY_INVEST', offerId: 'bond' })
    expect(g.pendingLocation).not.toBeNull()
    expect(g.players[0].investments.length).toBe(1)
    g = reduce(g, { type: 'EXCHANGE_LEAVE' })
    expect(g.pendingLocation).toBeNull()
    expect(g.pendingExchange).toBeNull()
  })
})
