import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'
import type { GameState, Relation } from '../src/game/types'

const rel: Relation = {
  id: 'r1',
  kind: 'network',
  name: '阿强',
  score: 60,
  status: 'stable',
  locked: false,
}

function withCareer(): GameState {
  let g = createGame({ seatCount: 2, seed: 3, endAge: 45 })
  g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
  return g
}

describe('modal queue: defer location behind decisions', () => {
  it('defers vacant location while bigSpend is pending', () => {
    let g = withCareer()
    const id = g.players[0].id
    g = {
      ...g,
      players: g.players.map((p) =>
        p.id === id ? { ...p, cash: 3, relations: [rel] } : p,
      ),
      pendingEvent: {
        playerId: id,
        eventId: 'opp8',
        landIndex: 1,
        landTrack: 'worker',
      },
    }
    // opp8 accept = 便利店 cost 2.2 → bigSpend at cash 3
    g = reduce(g, { type: 'RESOLVE_EVENT_CHOICE', choiceId: 'accept' })
    expect(g.pendingDecision?.type).toBe('bigSpend')
    expect(g.pendingLocation).toBeNull()
    expect(g.deferredLocation).toBeTruthy()

    g = reduce(g, { type: 'CONFIRM_BIG_SPEND', accept: false })
    expect(g.pendingDecision).toBeNull()
    expect(g.deferredLocation).toBeNull()
    expect(g.pendingLocation).toBeTruthy()
  })
})
