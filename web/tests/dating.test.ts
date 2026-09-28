import { describe, it, expect } from 'vitest'
import { applyAffinityDelta } from '../src/game/affinity'
import { createGame } from '../src/game/createGame'
import { DATE_VENUES, dateBoostFor, dateableRelations, pickAiDate } from '../src/game/dating'
import { reduce } from '../src/game/reduce'
import type { GameState, Relation } from '../src/game/types'

function withPartner(cash = 2, affinity = 150): GameState {
  let g = createGame({ seatCount: 2, seed: 11, endAge: 45 })
  g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
  const rel: Relation = {
    id: 'rel-date-1',
    name: '小夏',
    affinity,
    locked: false,
    skills: [],
    training: null,
  }
  return {
    ...g,
    players: g.players.map((p, i) =>
      i === 0 ? { ...p, cash, relations: [rel], actionPoints: 2 } : p,
    ),
  }
}

describe('dating flow', () => {
  it('opens partner pick without spending AP', () => {
    const g = withPartner()
    const after = reduce(g, { type: 'SPEND_ACTION', action: 'date' })
    expect(after.pendingDate?.step).toBe('pickPartner')
    expect(after.players[0].actionPoints).toBe(2)
  })

  it('cancels without cost', () => {
    let g = withPartner()
    g = reduce(g, { type: 'SPEND_ACTION', action: 'date' })
    g = reduce(g, { type: 'DATE_CANCEL' })
    expect(g.pendingDate).toBeNull()
    expect(g.players[0].actionPoints).toBe(2)
    expect(g.players[0].cash).toBe(2)
  })

  it('park date spends and boosts the chosen partner', () => {
    let g = withPartner(1, 150)
    g = reduce(g, { type: 'SPEND_ACTION', action: 'date' })
    g = reduce(g, { type: 'DATE_PICK_PARTNER', relationId: 'rel-date-1' })
    expect(g.pendingDate?.step).toBe('pickVenue')
    const raw = dateBoostFor(g.players[0], DATE_VENUES.find((v) => v.id === 'park')!)
    const expected = applyAffinityDelta(150, raw).affinity
    g = reduce(g, { type: 'DATE_CONFIRM_VENUE', venueId: 'park' })
    expect(g.pendingDate).toBeNull()
    expect(g.players[0].actionPoints).toBe(1)
    expect(g.players[0].cash).toBeCloseTo(0.95)
    expect(g.players[0].relations[0].affinity).toBe(expected)
  })

  it('blocks expensive venue when broke', () => {
    let g = withPartner(0.1, 450)
    g = reduce(g, { type: 'SPEND_ACTION', action: 'date' })
    g = reduce(g, { type: 'DATE_PICK_PARTNER', relationId: 'rel-date-1' })
    const before = g.players[0].cash
    const after = reduce(g, { type: 'DATE_CONFIRM_VENUE', venueId: 'surprise' })
    expect(after.pendingDate).toBeTruthy()
    expect(after.players[0].cash).toBe(before)
    expect(after.logs.some((l) => l.text.includes('现金不足'))).toBe(true)
  })

  it('no partner logs and skips pending', () => {
    let g = createGame({ seatCount: 2, seed: 3, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    g = {
      ...g,
      players: g.players.map((p, i) => (i === 0 ? { ...p, cash: 1, relations: [], actionPoints: 1 } : p)),
    }
    const after = reduce(g, { type: 'SPEND_ACTION', action: 'date' })
    expect(after.pendingDate).toBeNull()
    expect(after.players[0].actionPoints).toBe(1)
    expect(after.logs.some((l) => l.text.includes('可互动'))).toBe(true)
  })

  it('AI pick prefers cheapest unlocked affordable venue', () => {
    const g = withPartner(0.4, 150)
    const pick = pickAiDate(g.players[0])
    expect(pick?.venueId).toBe('chat')
    expect(DATE_VENUES.find((v) => v.id === pick!.venueId)!.cost).toBeLessThanOrEqual(0.4)
    expect(dateableRelations(g.players[0])).toHaveLength(1)
  })
})
