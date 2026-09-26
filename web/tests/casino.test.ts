import { describe, it, expect } from 'vitest'
import { dealBaccarat, settleBaccarat } from '../src/game/casino/baccarat'
import { comeOutRoll, emptyDice, pointRoll } from '../src/game/casino/craps'
import { buildShoe } from '../src/game/casino/cards'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'

describe('baccarat settle', () => {
  it('banker win pays 0.95', () => {
    const { delta } = settleBaccarat('banker', 1, 'banker')
    expect(delta).toBe(0.95)
  })
  it('tie refunds player/banker bets', () => {
    expect(settleBaccarat('player', 1, 'tie').delta).toBe(0)
    expect(settleBaccarat('tie', 1, 'tie').delta).toBe(8)
  })
  it('deal produces settled round', () => {
    const shoe = buildShoe(1, () => 0.1)
    const { round } = dealBaccarat(shoe, 'player', 0.2)
    expect(round.phase).toBe('settled')
    expect(round.result).toBeTruthy()
  })
})

describe('craps', () => {
  it('pass wins on come-out 7', () => {
    let r = { ...emptyDice(), phase: 'comeOut' as const, line: 'pass' as const, stake: 1, fieldStake: 0 }
    r = comeOutRoll(r, [3, 4])
    expect(r.phase).toBe('settled')
    expect(r.payoutDelta).toBe(1)
  })
  it('pass establishes point then seven out', () => {
    let r = { ...emptyDice(), phase: 'comeOut' as const, line: 'pass' as const, stake: 1, fieldStake: 0 }
    r = comeOutRoll(r, [2, 2])
    expect(r.phase).toBe('point')
    expect(r.point).toBe(4)
    r = pointRoll(r, [3, 4])
    expect(r.phase).toBe('settled')
    expect(r.payoutDelta).toBe(-1)
  })
})

describe('casino session reduce', () => {
  it('enter lobby, play baccarat, leave', () => {
    let g = createGame({ seatCount: 2, seed: 99, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = {
      ...g,
      pendingLocation: {
        playerId: g.players[0].id,
        spaceKind: 'casino',
        spaceIndex: 1,
        track: 'worker',
        label: '赌场',
      },
      players: g.players.map((p, i) => (i === 0 ? { ...p, cash: 5 } : p)),
    }
    g = reduce(g, { type: 'CASINO_ENTER' })
    expect(g.pendingCasino?.screen).toBe('lobby')
    g = reduce(g, { type: 'CASINO_OPEN', game: 'baccarat' })
    expect(g.pendingCasino?.screen).toBe('baccarat')
    const cashBefore = g.players[0].cash
    g = reduce(g, { type: 'CASINO_BACARAT_BET', betKind: 'player', amount: 0.2 })
    expect(g.pendingCasino?.baccarat?.phase).toBe('settled')
    expect(g.pendingCasino?.baccarat?.message.length).toBeGreaterThan(0)
    // 和局退注时现金可不变
    expect(typeof g.players[0].cash).toBe('number')
    expect(g.players[0].cash).toBeLessThanOrEqual(cashBefore + 0.2 * 8 + 1e-9)
    g = reduce(g, { type: 'CASINO_LEAVE' })
    expect(g.pendingCasino).toBeNull()
    expect(g.pendingLocation).toBeNull()
  })
})
