import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce, autoStep } from '../src/game/reduce'
import { pickEventChoice } from '../src/game/events'
import { EVENTS } from '../src/game/events'
import type { GameState } from '../src/game/types'

describe('event affordability stuck fix', () => {
  it('pickEventChoice never returns unaffordable decline', () => {
    const biz2 = EVENTS.find((e) => e.id === 'biz2')!
    const id = pickEventChoice(biz2, { cash: 0.02, aiStyle: 'steady' })
    const ch = biz2.choices.find((c) => c.id === id)!
    // with 0.02 cash, only free choices or skip marker
    expect(id === '__skip__' || ch).toBeTruthy()
    if (id !== '__skip__') {
      const cost = ch.effects
        .filter((e) => e.type === 'cash' && e.delta < 0)
        .reduce((s, e) => s + (e.type === 'cash' ? -e.delta : 0), 0)
      expect(cost).toBeLessThanOrEqual(0.02 + 1e-9)
    }
  })

  it('autoStep clears pendingEvent when broke on paid choices', () => {
    let g = createGame({ seatCount: 2, seed: 1, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const human = g.players[0]
    g = {
      ...g,
      players: g.players.map((p) => (p.id === human.id ? { ...p, cash: 0.02 } : p)),
      pendingEvent: {
        playerId: human.id,
        eventId: 'biz2',
        title: '淡季',
        text: 'x',
        kind: 'business',
        landIndex: 0,
        landTrack: 'worker',
      },
      autoEnabled: true,
    } satisfies GameState
    const next = autoStep(g)
    expect(next.pendingEvent).toBeNull()
  })
})
