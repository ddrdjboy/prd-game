import { describe, expect, it } from 'vitest'
import { fighterStats, runClubBattle, relationToFighter, buildCpuTeam } from '../src/game/clubPk'
import { createFreeLifeDebugGame, createGame } from '../src/game/createGame'
import { enterFreeLife, monthLabel } from '../src/game/freeLife'
import { pickFreeLifeScene, applyFreeLifeChoice } from '../src/game/freeLifeScenes'
import { reduce } from '../src/game/reduce'
import type { Relation } from '../src/game/types'

function freeGame() {
  let g = createGame({ seatCount: 2, seed: 11, endAge: 45 })
  g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
  g = {
    ...g,
    players: g.players.map((p, i) =>
      i === 0
        ? {
            ...p,
            cash: 5,
            fixedExpense: 0.2,
            investments: [{ id: 'i1', name: '基金', cost: 1, cashflow: 1 }],
            relations: [
              {
                id: 'r1',
                name: '蓝铃',
                affinity: 250,
                locked: false,
                skills: ['service'],
                training: null,
                portraitId: 'g01',
              } satisfies Relation,
            ],
          }
        : p,
    ),
  }
  return enterFreeLife(g)
}

describe('free life', () => {
  it('debug factory starts already in free life', () => {
    const g = createFreeLifeDebugGame({ endAge: 45 })
    expect(g.lifeMode).toBe('free')
    expect(g.phase).toBe('playing')
    expect(g.players[0].actionPoints).toBe(4)
    expect(g.players[0].relations.length).toBeGreaterThanOrEqual(3)
  })

  it('enter free life sets month AP and hides board mode', () => {
    const g = freeGame()
    expect(g.lifeMode).toBe('free')
    expect(g.players[0].actionPoints).toBe(4)
    expect(monthLabel(0)).toBe('1月')
  })

  it('visit place opens a scene and spends AP', () => {
    let g = freeGame()
    g = reduce(g, { type: 'FREE_VISIT', placeId: 'cafe' })
    expect(g.players[0].actionPoints).toBe(3)
    expect(g.pendingFreeScene?.scene.placeId).toBe('cafe')
    const choiceId = g.pendingFreeScene!.scene.choices[0].id
    g = reduce(g, { type: 'FREE_SCENE_CHOICE', choiceId })
    expect(g.pendingFreeScene).toBeNull()
  })

  it('close month advances calendar', () => {
    let g = freeGame()
    const age = g.age
    g = { ...g, monthIndex: 11 }
    g = reduce(g, { type: 'FREE_CLOSE_MONTH' })
    expect(g.monthIndex).toBe(0)
    expect(g.age).toBe(age + 1)
    expect(g.players[0].actionPoints).toBe(4)
  })

  it('scene meet adds relation', () => {
    const g = freeGame()
    const scene = pickFreeLifeScene('home', g.players[0], [], () => 0.1)
    // force character scene
    const withChar = {
      ...scene,
      characterName: '星澜',
      portraitId: 'g02',
      choices: [
        {
          id: 'm',
          label: '认识',
          effects: [{ type: 'meet' as const }, { type: 'affinity' as const, amount: 5 }],
        },
      ],
    }
    const applied = applyFreeLifeChoice(g.players[0], withChar, 'm', [], () => 0.2)
    expect(applied.player.relations.some((r) => r.name === '星澜')).toBe(true)
  })
})

describe('club pk', () => {
  it('higher affinity yields stronger stats', () => {
    const low = fighterStats(['service'], 50)
    const high = fighterStats(['service'], 450)
    expect(high.hp).toBeGreaterThan(low.hp)
    expect(high.atk).toBeGreaterThan(low.atk)
  })

  it('battle ends with a winner', () => {
    const g = freeGame()
    const team = g.players[0].relations.map((r, i) => relationToFighter(r, i))
    const cpu = buildCpuTeam(g.players[0], () => 0.3, 2)
    const result = runClubBattle(team, cpu, () => 0.4)
    expect(['player', 'cpu']).toContain(result.winner)
    expect(result.log.length).toBeGreaterThan(0)
  })

  it('club visit opens pick team', () => {
    let g = freeGame()
    g = reduce(g, { type: 'FREE_VISIT', placeId: 'club' })
    expect(g.pendingClub?.step).toBe('pickTeam')
    g = reduce(g, { type: 'CLUB_CONFIRM_TEAM', relationIds: ['r1'] })
    expect(g.pendingClub?.step).toBe('battle')
  })
})
