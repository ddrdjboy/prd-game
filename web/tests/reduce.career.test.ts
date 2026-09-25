import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'

describe('career pick', () => {
  it('starts playing after human picks career', () => {
    const g = createGame({ seatCount: 2, seed: 1 })
    expect(g.phase).toBe('careerPick')
    expect(g.careerChoices.length).toBe(3)
    const next = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    expect(next.phase).toBe('playing')
    expect(next.players[0].salary).toBeGreaterThan(0)
    expect(next.players.every((p) => p.careerId)).toBe(true)
  })
})
