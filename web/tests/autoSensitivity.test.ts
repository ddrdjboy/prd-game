import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { isCriticalPending, reduce } from '../src/game/reduce'

describe('autoSensitivity', () => {
  it('low only treats bankrupt and poach as critical', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = reduce(g, { type: 'SET_SENSITIVITY', value: 'low' })
    g = {
      ...g,
      pendingDecision: { type: 'promote', playerId: g.players[0].id },
    }
    expect(isCriticalPending(g)).toBe(false)
    g = {
      ...g,
      pendingDecision: {
        type: 'poach',
        playerId: g.players[0].id,
        fromPlayerId: g.players[1].id,
        relationId: 'r1',
      },
    }
    expect(isCriticalPending(g)).toBe(true)
  })

  it('high treats any pendingDecision as critical', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = reduce(g, { type: 'SET_SENSITIVITY', value: 'high' })
    g = {
      ...g,
      pendingDecision: { type: 'promote', playerId: g.players[0].id },
    }
    expect(isCriticalPending(g)).toBe(true)
  })
})
