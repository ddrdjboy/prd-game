import { describe, it, expect } from 'vitest'
import { applyAffinityDelta } from '../src/game/affinity'
import { createGame } from '../src/game/createGame'
import { autoStep, reduce } from '../src/game/reduce'
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
    else if (s.pendingDecision?.type === 'enterFreeLife') s = reduce(s, { type: 'SKIP_FREE_LIFE' })
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
  it('live auto step leaves the walk so the board can animate', () => {
    let g = createGame({ seatCount: 2, seed: 42, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = reduce(g, { type: 'SET_AUTO', enabled: true })
    g = reduce(g, { type: 'SET_AUTO_CHOICE_MODE', value: 'auto' })
    const started = reduce(g, { type: 'AUTO_STEP' })
    expect(started.moveAnimation?.path.length).toBeGreaterThan(0)
    expect(started.pendingEvent).toBeNull()

    let s = started
    let guard = 0
    const seen = new Set<number>([s.players[0].position])
    while (s.moveAnimation && guard++ < 20) {
      s = reduce(s, { type: 'ANIM_STEP' })
      const mover = s.players.find((p) => p.id === started.moveAnimation!.playerId)
      if (mover) seen.add(mover.position)
    }
    expect(seen.size).toBeGreaterThan(1)
    expect(s.moveAnimation).toBeNull()
    expect(s.pendingEvent).toBeTruthy()
  })

  it('batch autoStep still finishes the walk in one call', () => {
    let g = createGame({ seatCount: 2, seed: 42, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = { ...g, autoEnabled: true, players: g.players.map((p) => ({ ...p, isHuman: false })) }
    const next = autoStep(g)
    expect(next.moveAnimation).toBeNull()
    expect(next.logs.some((l) => l.text.includes('走到'))).toBe(true)
  })

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

                  name: '阿强',
                  affinity: 250,
                  skills: [],
                  training: null,
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
    expect(r.affinity).toBe(applyAffinityDelta(250, -4).affinity)
  })
})
