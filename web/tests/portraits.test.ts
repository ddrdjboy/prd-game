import { describe, expect, it } from 'vitest'
import { createGame } from '../src/game/createGame'
import {
  PORTRAIT_CATALOG,
  pickPortraitId,
  portraitUrl,
  usedPortraitIds,
} from '../src/game/portraits'
import { applyEffects, reduce } from '../src/game/reduce'
import type { PlayerState, Relation } from '../src/game/types'

function rel(over: Partial<Relation> & Pick<Relation, 'id' | 'portraitId'>): Relation {
  return {
    name: '测',
    affinity: 40,
    locked: false,
    skills: [],
    training: null,
    ...over,
  }
}

function stubPlayer(relations: Relation[]): PlayerState {
  return {
    id: 'p1',
    name: '测',
    isHuman: true,
    careerId: 'c1',
    salary: 1,
    fixedExpense: 0.5,
    cash: 1,
    liabilities: 0,
    track: 'worker',
    position: 0,
    relations,
    shops: [],
    investments: [],
    actionPoints: 1,
    aiStyle: null,
    trait: null,
    poachCooldown: 0,
    maintainedRelationIds: [],
    negativePaydayStreak: 0,
  }
}

describe('portraits', () => {
  it('lists the initial five catalog ids', () => {
    expect(PORTRAIT_CATALOG).toEqual(['g01', 'g02', 'g03', 'g04', 'g05'])
  })

  it('resolves url for catalog ids and null otherwise', () => {
    expect(portraitUrl('g01')).toBe('/portraits/g01.png')
    expect(portraitUrl('missing')).toBeNull()
    expect(portraitUrl(undefined)).toBeNull()
  })

  it('collects used portrait ids across players', () => {
    const used = usedPortraitIds([
      stubPlayer([rel({ id: 'r1', portraitId: 'g01' })]),
      stubPlayer([rel({ id: 'r2', portraitId: 'g03' })]),
    ])
    expect([...used].sort()).toEqual(['g01', 'g03'])
  })

  it('picks an unused catalog id', () => {
    const used = new Set(['g01', 'g02', 'g03', 'g04'])
    expect(pickPortraitId(used, () => 0)).toBe('g05')
  })

  it('returns undefined when the pool is exhausted', () => {
    const used = new Set(PORTRAIT_CATALOG)
    expect(pickPortraitId(used, () => 0.99)).toBeUndefined()
  })

  it('assigns a catalog portraitId when meeting someone', () => {
    let g = createGame({ seatCount: 2, seed: 11, endAge: 45 })
    g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
    const before = g.players[0].relations.length
    const next = applyEffects(
      g,
      g.players[0].id,
      [{ type: 'meet', affinity: 40 }],
      () => 0.1,
    )
    expect(next.players[0].relations.length).toBe(before + 1)
    const met = next.players[0].relations[next.players[0].relations.length - 1]!
    expect(met.portraitId).toBeTruthy()
    expect(PORTRAIT_CATALOG).toContain(met.portraitId as (typeof PORTRAIT_CATALOG)[number])
  })
})
