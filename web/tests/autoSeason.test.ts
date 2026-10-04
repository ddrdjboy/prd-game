import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'
import { runAutoUntilBreak } from '../src/game/autoSeason'

describe('autoSeason', () => {
  it('can auto-advance without freezing', () => {
    let g = createGame({ seatCount: 2, seed: 7, endAge: 19 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    // 全部视为 AI，确保 auto 不会在人类决策处停顿
    g = { ...g, players: g.players.map((p) => ({ ...p, isHuman: false })) }
    g = reduce(g, { type: 'SET_AUTO', enabled: true })
    g = runAutoUntilBreak(g, 500)
    expect(g.phase === 'settlement' || g.age >= 18).toBe(true)
    expect(g.logs.length).toBeGreaterThan(3)
  })

  it('pauses at human pending during one-click push', () => {
    let g = createGame({ seatCount: 2, seed: 7, endAge: 19 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = reduce(g, { type: 'SET_AUTO', enabled: true })
    g = runAutoUntilBreak(g, 500)
    // 人类玩家仍是 P0，auto 推进应在第一次人类待决处停下
    const human = g.players[0]
    const hasHumanPending =
      (g.pendingEvent && g.pendingEvent.playerId === human.id) ||
      (g.pendingDate && g.pendingDate.playerId === human.id) ||
      (g.pendingLocation && g.pendingLocation.playerId === human.id) ||
      (g.pendingDecision && g.pendingDecision.playerId === human.id) ||
      (g.turnPlayerIndex === 0 && !g.pendingEvent && !g.pendingLocation)
    expect(hasHumanPending || g.phase === 'settlement').toBeTruthy()
  })
})
