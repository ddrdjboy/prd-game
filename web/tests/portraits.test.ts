import { describe, expect, it } from 'vitest'
import { createGame } from '../src/game/createGame'
import {
  CHARACTERS,
  PORTRAIT_CATALOG,
  characterByName,
  pickCharacter,
  pickPortraitId,
  portraitUrl,
  usedPortraitIds,
} from '../src/game/portraits'
import { RELATION_NAMES, initialSkillsForName } from '../src/game/relationsCatalog'
import { applyEffects, reduce } from '../src/game/reduce'
import type { PlayerState, Relation } from '../src/game/types'

function rel(over: Partial<Relation> & Pick<Relation, 'id'>): Relation {
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

describe('portraits / characters', () => {
  it('registers twenty catalog characters aligned with prompts', () => {
    expect(CHARACTERS).toHaveLength(20)
    expect(PORTRAIT_CATALOG).toHaveLength(20)
    expect(RELATION_NAMES).toEqual(CHARACTERS.map((c) => c.name))
    expect(PORTRAIT_CATALOG[0]).toBe('g01')
    expect(PORTRAIT_CATALOG[19]).toBe('g20')
    expect(characterByName('蓝铃')?.key).toBe('blue_maid')
    expect(characterByName('铜心')?.title).toBe('蒸汽发明家')
    expect(initialSkillsForName('炽火')).toEqual(['cook', 'service'])
  })

  it('resolves url for catalog ids and null otherwise', () => {
    expect(portraitUrl('g01')).toBe('/portraits/g01.png')
    expect(portraitUrl('g20')).toBe('/portraits/g20.png')
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

  it('picks an unused character as a unit', () => {
    const players = [
      stubPlayer([
        rel({ id: 'r1', name: '蓝铃', portraitId: 'g01' }),
        rel({ id: 'r2', name: '星澜', portraitId: 'g02' }),
      ]),
    ]
    const picked = pickCharacter(players, () => 0)
    expect(picked).toBeTruthy()
    expect(picked!.portraitId).not.toBe('g01')
    expect(picked!.portraitId).not.toBe('g02')
    expect(picked!.name).not.toBe('蓝铃')
  })

  it('returns undefined when the portrait pool is exhausted', () => {
    const used = new Set(PORTRAIT_CATALOG)
    expect(pickPortraitId(used, () => 0.99)).toBeUndefined()
    const players = [
      stubPlayer(
        CHARACTERS.map((c, i) =>
          rel({ id: `r${i}`, name: c.name, portraitId: c.portraitId }),
        ),
      ),
    ]
    expect(pickCharacter(players, () => 0)).toBeUndefined()
  })

  it('assigns matching name and portraitId when meeting someone', () => {
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
    expect(PORTRAIT_CATALOG).toContain(met.portraitId as string)
    const ch = characterByName(met.name)
    expect(ch?.portraitId).toBe(met.portraitId)
  })
})
