import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import {
  EVENTS,
  canAffordChoice,
  choiceCashCost,
  eventsForKind,
  pickEventChoice,
} from '../src/game/events'
import { reduce } from '../src/game/reduce'
import type { GameState } from '../src/game/types'

function withPending(eventId: string, cash = 5): GameState {
  let g = createGame({ seatCount: 2, seed: 7, endAge: 45 })
  g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
  const ev = EVENTS.find((e) => e.id === eventId)!
  return {
    ...g,
    players: g.players.map((p, i) => (i === 0 ? { ...p, cash } : p)),
    pendingEvent: {
      playerId: g.players[0].id,
      eventId: ev.id,
      title: ev.title,
      text: ev.text,
      kind: ev.kind,
      landIndex: 1,
      landTrack: 'worker',
    },
  }
}

describe('event choices', () => {
  it('every event has at least accept and decline', () => {
    for (const e of EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.choices.some((c) => c.id === 'accept')).toBe(true)
      expect(e.choices.some((c) => c.id === 'decline')).toBe(true)
    }
  })

  it('rest pool includes narrative cards', () => {
    const rest = eventsForKind('rest')
    expect(rest.some((e) => e.kind === 'narrative')).toBe(true)
  })

  it('decline does not charge shop cost', () => {
    const before = withPending('opp1', 5)
    const cashBefore = before.players[0].cash
    const after = reduce(before, { type: 'RESOLVE_EVENT_CHOICE', choiceId: 'decline' })
    expect(after.pendingEvent).toBeNull()
    expect(after.players[0].cash).toBe(cashBefore)
    expect(after.players[0].shops.length).toBe(0)
  })

  it('raise costs more than accept for doodad travel', () => {
    const ev = EVENTS.find((e) => e.id === 'dd6')!
    const accept = ev.choices.find((c) => c.id === 'accept')!
    const raise = ev.choices.find((c) => c.id === 'raise')!
    expect(choiceCashCost(raise.effects)).toBeGreaterThan(choiceCashCost(accept.effects))
  })

  it('raise is blocked when cash is insufficient', () => {
    const g = withPending('opp8', 0.5)
    const after = reduce(g, { type: 'RESOLVE_EVENT_CHOICE', choiceId: 'raise' })
    expect(after.pendingEvent).toBeTruthy()
    expect(after.players[0].shops.length).toBe(0)
    expect(after.logs.some((l) => l.text.includes('现金不足'))).toBe(true)
  })

  it('aggressive AI prefers raise when affordable', () => {
    const ev = EVENTS.find((e) => e.id === 'opp3')!
    expect(pickEventChoice(ev, { cash: 10, aiStyle: 'aggressive' })).toBe('raise')
  })

  it('steady AI prefers accept over raise', () => {
    const ev = EVENTS.find((e) => e.id === 'opp3')!
    expect(pickEventChoice(ev, { cash: 10, aiStyle: 'steady' })).toBe('accept')
  })

  it('social AI raises on relation when affordable', () => {
    const ev = EVENTS.find((e) => e.id === 'rel1')!
    expect(pickEventChoice(ev, { cash: 10, aiStyle: 'social' })).toBe('raise')
  })

  it('canAffordChoice detects offer costs', () => {
    const raise = EVENTS.find((e) => e.id === 'opp1')!.choices.find((c) => c.id === 'raise')!
    expect(canAffordChoice(0.5, raise.effects)).toBe(false)
    expect(canAffordChoice(2, raise.effects)).toBe(true)
  })
})
