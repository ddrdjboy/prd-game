import { describe, it, expect } from 'vitest'
import { EARLY_AGE_MAX, EARLY_PAY_BONUS, INVESTOR_START_BONUS } from '../src/game/config'
import { createGame } from '../src/game/createGame'
import { pickAiDate } from '../src/game/dating'
import { calcFinance } from '../src/game/finance'
import { investOffersFor } from '../src/game/location'
import { reduce } from '../src/game/reduce'
import type { GameState, Relation } from '../src/game/types'

function withCareer(seed = 7): GameState {
  let g = createGame({ seatCount: 2, seed, endAge: 45 })
  return reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
}

function paydayMove(playerId: string): GameState['moveAnimation'] {
  return {
    playerId,
    track: 'worker',
    path: [0],
    pathIndex: 0,
    dice: 1,
    passedPayday: true,
    finalPosition: 0,
    reels: [1, 0, 0],
  }
}

describe('体验打磨', () => {
  it('early payday adds young bonus under EARLY_AGE_MAX', () => {
    let g = withCareer()
    const id = g.players[0].id
    const before = g.players[0].cash
    const f = calcFinance(g.players[0])
    g = {
      ...g,
      age: EARLY_AGE_MAX - 1,
      moveAnimation: paydayMove(id),
    }
    g = reduce(g, { type: 'FINISH_MOVE' })
    expect(g.players[0].cash).toBeCloseTo(
      before + f.seasonalCashflow + EARLY_PAY_BONUS,
      5,
    )
    expect(g.logs.some((l) => l.text.includes('年轻红利'))).toBe(true)
  })

  it('payday after EARLY_AGE_MAX has no young bonus', () => {
    let g = withCareer(8)
    const id = g.players[0].id
    const before = g.players[0].cash
    const f = calcFinance(g.players[0])
    g = {
      ...g,
      age: EARLY_AGE_MAX,
      moveAnimation: paydayMove(id),
    }
    g = reduce(g, { type: 'FINISH_MOVE' })
    expect(g.players[0].cash).toBeCloseTo(before + f.seasonalCashflow, 5)
    expect(g.logs.some((l) => l.text.includes('年轻红利'))).toBe(false)
  })

  it('promote grants investor start bonus', () => {
    let g = withCareer(9)
    const id = g.players[0].id
    const before = g.players[0].cash
    g = {
      ...g,
      pendingDecision: { type: 'promote', playerId: id },
    }
    g = reduce(g, { type: 'PROMOTE_TO_INVESTOR' })
    expect(g.players[0].track).toBe('investor')
    expect(g.players[0].cash).toBeCloseTo(before + INVESTOR_START_BONUS, 5)
    expect(g.logs.some((l) => l.text.includes('身份转变'))).toBe(true)
  })

  it('investOffersFor hides investor-only on worker track', () => {
    const worker = investOffersFor('worker')
    const investor = investOffersFor('investor')
    expect(worker.every((o) => !o.investorOnly)).toBe(true)
    expect(investor.some((o) => o.id === 'pe')).toBe(true)
    expect(investor.some((o) => o.id === 'reit')).toBe(true)
    expect(worker.find((o) => o.id === 'pe')).toBeUndefined()
  })

  it('park chat marks relation maintained so endTurn skips its decay', () => {
    const rel: Relation = {
      id: 'r-keep',
      kind: 'network',
      name: '阿强',
      score: 40,
      status: 'stable',
      locked: false,
    }
    const other: Relation = {
      id: 'r-cool',
      kind: 'network',
      name: '阿伟',
      score: 40,
      status: 'stable',
      locked: false,
    }
    let g = withCareer(10)
    const id = g.players[0].id
    g = {
      ...g,
      players: g.players.map((p) =>
        p.id === id
          ? { ...p, relations: [rel, other], maintainedRelationIds: [], actionPoints: 0 }
          : p,
      ),
      turnPlayerIndex: 0,
      pendingLocation: {
        playerId: id,
        spaceKind: 'park',
        spaceIndex: 2,
        track: 'worker',
        label: '公园',
      },
    }
    g = reduce(g, { type: 'LOCATION_PARK_CHAT', relationId: 'r-keep' })
    expect(g.players[0].maintainedRelationIds).toContain('r-keep')
    expect(g.players[0].relations[0].score).toBe(45)

    g = reduce(g, { type: 'END_TURN' })
    const after = g.players.find((p) => p.id === id)!
    expect(after.relations.find((r) => r.id === 'r-keep')!.score).toBe(45)
    expect(after.relations.find((r) => r.id === 'r-cool')!.score).toBe(36)
    expect(after.maintainedRelationIds).toEqual([])
  })

  it('pickAiDate prefers lowest score then cheapest venue', () => {
    let g = withCareer(11)
    const low: Relation = {
      id: 'low',
      kind: 'romance',
      name: '低',
      score: 30,
      status: 'dating',
      locked: false,
    }
    const high: Relation = {
      id: 'high',
      kind: 'romance',
      name: '高',
      score: 70,
      status: 'dating',
      locked: false,
    }
    g = {
      ...g,
      players: g.players.map((p, i) =>
        i === 0 ? { ...p, cash: 0.4, relations: [high, low] } : p,
      ),
    }
    const pick = pickAiDate(g.players[0])
    expect(pick?.relationId).toBe('low')
    expect(pick?.venueId).toBe('park')
  })
})
