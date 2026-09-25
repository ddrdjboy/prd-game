import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'
import { runAutoUntilBreak } from '../src/game/autoSeason'

describe('autoSeason', () => {
  it('can auto-advance without freezing', () => {
    let g = createGame({ seatCount: 2, seed: 7, endAge: 19 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = reduce(g, { type: 'SET_AUTO', enabled: true })
    g = runAutoUntilBreak(g, 500)
    expect(g.phase === 'settlement' || g.age >= 18).toBe(true)
    expect(g.logs.length).toBeGreaterThan(3)
  })
})
