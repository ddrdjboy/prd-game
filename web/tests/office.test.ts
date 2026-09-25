import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { OFFICE_POACH_COST, OFFICE_RECOMMEND_COST, OFFICE_UP_COST } from '../src/game/office'
import { reduce } from '../src/game/reduce'
import type { GameState, Relation } from '../src/game/types'

function baseWithOffice(): GameState {
  let g = createGame({ seatCount: 2, seed: 21, endAge: 45 })
  g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
  const aiRel: Relation = {
    id: 'ai-rel-1',
    kind: 'network',
    name: '老周',
    score: 40,
    status: 'stable',
    locked: false,
  }
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
  it('recommends a new network friend', () => {
    const g = baseWithOffice()
    const after = reduce(g, { type: 'OFFICE_RECOMMEND', kind: 'network' })
    expect(after.pendingLocation).toBeNull()
    expect(after.players[0].cash).toBeCloseTo(5 - OFFICE_RECOMMEND_COST)
    expect(after.players[0].relations.some((r) => r.kind === 'network')).toBe(true)
  })

  it('adjusts own relation upward', () => {
    let g = baseWithOffice()
    const mine: Relation = {
      id: 'my-rel',
      kind: 'romance',
      name: '小夏',
      score: 40,
      status: 'dating',
      locked: false,
    }
    g = {
      ...g,
      players: g.players.map((p, i) => (i === 0 ? { ...p, relations: [mine] } : p)),
    }
    const after = reduce(g, {
      type: 'OFFICE_ADJUST',
      ownerId: g.players[0].id,
      relationId: 'my-rel',
      direction: 'up',
    })
    expect(after.players[0].cash).toBeCloseTo(5 - OFFICE_UP_COST)
    expect(after.players[0].relations[0].score).toBe(50)
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
    // success or fail both valid; fee always paid
    const got = after.players[0].relations.some((r) => r.name === '老周')
    const kept = after.players[1].relations.some((r) => r.id === 'ai-rel-1')
    expect(got || kept).toBe(true)
  })
})
