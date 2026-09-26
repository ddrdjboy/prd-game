import { describe, it, expect } from 'vitest'
import { pickAiLocationAction } from '../src/game/ai'
import type { AiStyle, PlayerState, PendingLocation } from '../src/game/types'
import { VACANT_COST } from '../src/game/location'
import { OFFICE_POACH_COST } from '../src/game/office'

function player(over: Partial<PlayerState> & { aiStyle: AiStyle }): PlayerState {
  return {
    id: 'ai',
    name: 'AI',
    isHuman: false,
    careerId: 'dev',
    salary: 1,
    fixedExpense: 0.5,
    cash: 5,
    liabilities: 0,
    track: 'worker',
    position: 0,
    relations: [
      {
        id: 'r1',
        kind: 'network',
        name: '阿强',
        score: 60,
        status: 'stable',
        locked: false,
        skills: ['sales'],
        training: null,
      },
    ],
    shops: [],
    investments: [],
    actionPoints: 1,
    poachCooldown: 0,
    trait: null,
    maintainedRelationIds: [],
    ...over,
  }
}

const vacantLoc: PendingLocation = {
  playerId: 'ai',
  spaceKind: 'vacant',
  spaceIndex: 1,
  track: 'worker',
  label: '空地',
}

const officeLoc: PendingLocation = {
  playerId: 'ai',
  spaceKind: 'office',
  spaceIndex: 2,
  track: 'worker',
  label: '事务所',
}

describe('pickAiLocationAction', () => {
  it('steady skips vacant when cash is only enough for one cost', () => {
    const p = player({ aiStyle: 'steady', cash: VACANT_COST + 0.1 })
    expect(pickAiLocationAction(p, vacantLoc, true).type).toBe('skip')
  })

  it('aggressive buys vacant when affordable', () => {
    const p = player({ aiStyle: 'aggressive', cash: VACANT_COST })
    const a = pickAiLocationAction(p, vacantLoc, true)
    expect(a.type).toBe('buyVacant')
  })

  it('social prefers poach when cooldown clear and targets exist', () => {
    const p = player({ aiStyle: 'social', cash: OFFICE_POACH_COST + 1, poachCooldown: 0 })
    const a = pickAiLocationAction(p, officeLoc, true)
    expect(a.type).toBe('poach')
  })

  it('social skips poach when on cooldown', () => {
    const p = player({ aiStyle: 'social', cash: OFFICE_POACH_COST + 1, poachCooldown: 2 })
    const a = pickAiLocationAction(p, officeLoc, true)
    expect(a.type).not.toBe('poach')
  })

  it('park chats weak relation under 55', () => {
    const parkLoc: PendingLocation = {
      playerId: 'ai',
      spaceKind: 'park',
      spaceIndex: 3,
      track: 'worker',
      label: '公园',
    }
    const p = player({
      aiStyle: 'steady',
      relations: [
        {
          id: 'r1',
          kind: 'network',
          name: '阿强',
          score: 40,
          status: 'stable',
          locked: false,
          skills: ['sales'],
          training: null,
        },
      ],
    })
    const a = pickAiLocationAction(p, parkLoc, false)
    expect(a).toEqual({ type: 'parkChat', relationId: 'r1' })
  })

  it('invest on worker track does not pick pe', () => {
    const investLoc: PendingLocation = {
      playerId: 'ai',
      spaceKind: 'invest',
      spaceIndex: 1,
      track: 'worker',
      label: '投资所',
    }
    const p = player({ aiStyle: 'aggressive', cash: 10, track: 'worker' })
    const a = pickAiLocationAction(p, investLoc, false)
    expect(a.type).toBe('buyInvest')
    if (a.type === 'buyInvest') expect(a.offerId).not.toBe('pe')
  })
})
