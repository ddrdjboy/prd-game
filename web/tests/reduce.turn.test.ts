import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'
import type { GameState } from '../src/game/types'

function clearPendings(g: GameState): GameState {
  let s = g
  let guard = 0
  while (
    guard++ < 20 &&
    (s.pendingDecision || s.pendingEvent || s.pendingLocation || s.deferredLocation)
  ) {
    if (s.pendingEvent) s = reduce(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: 'decline' })
    else if (s.pendingDate) s = reduce(s, { type: 'DATE_CANCEL' })
    else if (s.pendingDecision?.type === 'promote') s = reduce(s, { type: 'SKIP_PROMOTE' })
    else if (s.pendingDecision?.type === 'marriage')
      s = reduce(s, { type: 'CONFIRM_MARRIAGE', accept: false })
    else if (s.pendingDecision?.type === 'bigSpend')
      s = reduce(s, { type: 'CONFIRM_BIG_SPEND', accept: false })
    else if (s.pendingDecision?.type === 'poach') s = reduce(s, { type: 'CONFIRM_POACH', accept: false })
    else if (s.pendingDecision?.type === 'bankrupt') s = reduce(s, { type: 'RESOLVE_BANKRUPT' })
    else if (s.pendingLocation) s = reduce(s, { type: 'LOCATION_SKIP' })
    else if (s.deferredLocation)
      s = { ...s, pendingLocation: s.deferredLocation, deferredLocation: null }
    else break
  }
  return s
}

describe('turn loop', () => {
  it('slots then event then optional location', () => {
    let g = createGame({ seatCount: 2, seed: 42, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = reduce(g, { type: 'ROLL_AND_MOVE' })
    expect(g.slotSpin).toBeTruthy()
    g = reduce(g, { type: 'FINISH_SLOT' })
    g = reduce(g, { type: 'FINISH_MOVE' })
    expect(g.pendingEvent).toBeTruthy()
    expect(g.pendingEvent!.landIndex).toBeGreaterThanOrEqual(0)
    g = reduce(g, { type: 'RESOLVE_EVENT_CHOICE', choiceId: 'accept' })
    g = clearPendings(g)
    const before = g.turnPlayerIndex
    g = reduce(g, { type: 'END_TURN' })
    expect(g.turnPlayerIndex).not.toBe(before)
  })

  it('END_TURN decays current player relations', () => {
    let g = createGame({ seatCount: 2, seed: 7, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const humanId = g.players[0].id
    g = {
      ...g,
      players: g.players.map((p) =>
        p.id === humanId
          ? {
              ...p,
              relations: [
                {
                  id: 'r1',
                  kind: 'network',
                  name: '阿强',
                  score: 50,
                  status: 'stable',
                  locked: false,
                },
              ],
            }
          : p,
      ),
    }
    g = clearPendings(g)
    expect(g.turnPlayerIndex).toBe(0)
    g = reduce(g, { type: 'END_TURN' })
    const r = g.players.find((p) => p.id === humanId)!.relations[0]
    expect(r.score).toBe(46)
  })
})
