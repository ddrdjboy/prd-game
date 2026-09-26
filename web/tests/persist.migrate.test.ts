import { describe, it, expect } from 'vitest'
import { migrateState } from '../src/persist'
import type { GameState } from '../src/game/types'

describe('persist migrate', () => {
  it('maps operatorRelationId to staffIds/managerId and fills skills', () => {
    const raw = {
      turnRolled: undefined,
      players: [
        {
          id: 'p0',
          name: '你',
          isHuman: true,
          careerId: 'dev',
          salary: 1,
          fixedExpense: 0.5,
          cash: 2,
          liabilities: 0,
          track: 'worker',
          position: 0,
          relations: [
            {
              id: 'r1',
              kind: 'network',
              name: '阿强',
              score: 50,
              status: 'stable',
              locked: false,
            },
          ],
          shops: [
            {
              id: 's1',
              name: '小店',
              level: 1,
              baseCashflow: 0.3,
              operatorRelationId: 'r1',
            },
          ],
          investments: [],
          actionPoints: 1,
          aiStyle: null,
          trait: null,
        },
      ],
    } as unknown as GameState

    const s = migrateState(raw)
    expect(s.turnRolled).toBe(false)
    expect(s.players[0].shops[0].staffIds).toEqual(['r1'])
    expect(s.players[0].shops[0].managerId).toBe('r1')
    expect(s.players[0].shops[0].typeId).toBeTruthy()
    expect(s.players[0].shops[0].baseRevenue).toBe(0.3)
    expect(s.players[0].shops[0].operatingCost).toBeGreaterThan(0)
    expect(s.players[0].relations[0].skills).toEqual(['sales'])
    expect(s.players[0].relations[0].training).toBeNull()
    expect(s.players[0].poachCooldown).toBe(0)
  })
})
