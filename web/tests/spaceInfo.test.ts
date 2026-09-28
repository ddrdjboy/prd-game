import { describe, it, expect } from 'vitest'
import { buildTrack } from '../src/game/board'
import { createGame } from '../src/game/createGame'
import { buildShop, makeRelation } from '../src/game/shopStaff'
import { buildSpaceDetail, SPACE_KIND_INFO } from '../src/game/spaceInfo'
import type { GameState, SpaceKind } from '../src/game/types'

const ALL_KINDS: SpaceKind[] = [
  'payday',
  'vacant',
  'shop',
  'office',
  'manage',
  'park',
  'invest',
  'casino',
]

describe('spaceInfo', () => {
  it('has info for every SpaceKind', () => {
    for (const kind of ALL_KINDS) {
      expect(SPACE_KIND_INFO[kind].title.length).toBeGreaterThan(0)
      expect(SPACE_KIND_INFO[kind].description.length).toBeGreaterThan(0)
    }
  })

  it('lists occupants; human as 你', () => {
    let g = createGame({ seatCount: 2, seed: 3 })
    g = {
      ...g,
      phase: 'playing',
      players: g.players.map((p, i) =>
        i === 0
          ? { ...p, track: 'worker', position: 5 }
          : { ...p, track: 'worker', position: 5, name: '阿豪' },
      ),
    }
    const d = buildSpaceDetail(g, 'worker', 5)
    expect(d.headline).toContain('打工人圈')
    expect(d.headline).toContain('#5')
    expect(d.facts).toContain('站在此格：你、阿豪')
  })

  it('empty cell shows 无人', () => {
    const g = createGame({ seatCount: 2, seed: 3 })
    const d = buildSpaceDetail(g, 'worker', 11)
    expect(d.facts.some((f) => f.includes('无人'))).toBe(true)
  })

  it('vacant with shop shows owner and name', () => {
    const vacantIdx = buildTrack('worker').find((s) => s.kind === 'vacant')!.index
    let g = createGame({ seatCount: 2, seed: 7 }) as GameState
    g = {
      ...g,
      phase: 'playing',
      players: g.players.map((p, i) =>
        i === 1
          ? {
              ...p,
              name: '小林',
              relations: [
                makeRelation({
                  id: 'mgr1',
                  kind: 'network',
                  name: '店长',
                  score: 40,
                  status: 'stable',
                  locked: false,
                }),
              ],
              shops: [
                buildShop({
                  id: `lot-worker-${vacantIdx}-1`,
                  name: '咖啡小馆',
                  typeId: 'vacantLot',
                  managerId: 'mgr1',
                  boardTrack: 'worker',
                  boardIndex: vacantIdx,
                }),
              ],
            }
          : p,
      ),
    }
    const d = buildSpaceDetail(g, 'worker', vacantIdx)
    expect(d.kind).toBe('vacant')
    expect(d.facts.some((f) => f.includes('咖啡小馆') && f.includes('小林'))).toBe(true)
  })

  it('vacant without shop shows 尚未开店', () => {
    const g = createGame({ seatCount: 2, seed: 3 })
    const idx = buildTrack('worker').find((s) => s.kind === 'vacant')!.index
    const d = buildSpaceDetail(g, 'worker', idx)
    expect(d.facts).toContain('尚未开店')
  })
})
