import { describe, it, expect } from 'vitest'
import { applyAffinityDelta } from '../src/game/affinity'
import { createGame } from '../src/game/createGame'
import { OFFICE_POACH_COST, OFFICE_RECOMMEND_COST, OFFICE_UP_COST } from '../src/game/office'
import { reduce } from '../src/game/reduce'
import type { GameState, Relation } from '../src/game/types'

function rel(partial: Partial<Relation> & Pick<Relation, 'id' | 'name' | 'affinity'>): Relation {
  return { locked: false, skills: [], training: null, ...partial }
}

function baseWithOffice(): GameState {
  let g = createGame({ seatCount: 2, seed: 21, endAge: 45 })
  g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
  const aiRel = rel({ id: 'ai-rel-1', name: '老周', affinity: 200 })
  return {
    ...g,
    players: g.players.map((p, i) =>
      i === 0
        ? { ...p, cash: 5, relations: [] }
        : { ...p, cash: 2, relations: [aiRel] },
    ),
    pendingLocation: {
      playerId: g.players[0].id,
      spaceKind: 'office',
      spaceIndex: 3,
      track: 'worker',
      label: '私人事务所',
    },
  }
}

describe('private office', () => {
  it('recommends a new friend', () => {
    const g = baseWithOffice()
    const after = reduce(g, { type: 'OFFICE_RECOMMEND' })
    expect(after.pendingLocation).toBeNull()
    expect(after.players[0].cash).toBeCloseTo(5 - OFFICE_RECOMMEND_COST)
    expect(after.players[0].relations.length).toBeGreaterThan(0)
  })

  it('adjusts own relation upward', () => {
    let g = baseWithOffice()
    const mine = rel({ id: 'my-rel', name: '小夏', affinity: 200 })
    g = {
      ...g,
      players: g.players.map((p, i) => (i === 0 ? { ...p, relations: [mine] } : p)),
    }
    const expected = applyAffinityDelta(200, 10).affinity
    const after = reduce(g, {
      type: 'OFFICE_ADJUST',
      ownerId: g.players[0].id,
      relationId: 'my-rel',
      direction: 'up',
    })
    expect(after.players[0].cash).toBeCloseTo(5 - OFFICE_UP_COST)
    expect(after.players[0].relations[0].affinity).toBe(expected)
    expect(after.pendingLocation).toBeNull()
  })

  it('poaches a target relation with fee', () => {
    const g = baseWithOffice()
    const cashBefore = g.players[0].cash
    const after = reduce(g, {
      type: 'OFFICE_POACH',
      targetPlayerId: g.players[1].id,
      relationId: 'ai-rel-1',
    })
    expect(after.players[0].cash).toBeCloseTo(cashBefore - OFFICE_POACH_COST)
    expect(after.pendingLocation).toBeNull()
    const got = after.players[0].relations.some((r) => r.name === '老周')
    const kept = after.players[1].relations.some((r) => r.id === 'ai-rel-1')
    expect(got || kept).toBe(true)
  })
})
