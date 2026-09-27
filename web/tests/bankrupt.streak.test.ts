import { describe, it, expect } from 'vitest'
import { createGame } from '../src/game/createGame'
import { reduce } from '../src/game/reduce'
import type { GameState } from '../src/game/types'

function withCareer(seed = 1): GameState {
  let g = createGame({ seatCount: 2, seed, endAge: 45, humanName: '试玩者' })
  g = reduce(g, { type: 'CHOOSE_CAREER', careerId: g.careerChoices[0].id })
  return g
}

/** 直接走完一步并带发薪 */
function paydayMove(g: GameState, cash: number, streak = 0): GameState {
  const id = g.players[0].id
  return reduce(
    {
      ...g,
      phase: 'playing',
      turnRolled: true,
      players: g.players.map((p) =>
        p.id === id
          ? {
              ...p,
              cash,
              salary: 0.1,
              fixedExpense: 2,
              shops: [],
              investments: [],
              negativePaydayStreak: streak,
            }
          : p,
      ),
      moveAnimation: {
        playerId: id,
        track: 'worker',
        path: [0, 1],
        pathIndex: 1,
        dice: 1,
        passedPayday: true,
        finalPosition: 1,
        reels: [1, 1, 1],
      },
    },
    { type: 'FINISH_MOVE' },
  )
}

describe('negative payday streak bankruptcy', () => {
  it('first negative payday warns and sets streak=1', () => {
    let g = withCareer(3)
    g = paydayMove(g, 0.05, 0)
    expect(g.phase).toBe('playing')
    expect(g.players[0].negativePaydayStreak).toBe(1)
    expect(g.players[0].cash).toBeLessThan(0)
    expect(g.logs.some((l) => /警告 1\/2/.test(l.text))).toBe(true)
    expect(g.pendingDecision?.type).not.toBe('bankrupt')
  })

  it('second consecutive negative payday ends game for human', () => {
    let g = withCareer(5)
    g = paydayMove(g, 0.05, 1)
    expect(g.phase).toBe('settlement')
    expect(g.settlementReason).toBe('bankrupt')
    expect(g.logs.some((l) => /宣布破产/.test(l.text))).toBe(true)
  })

  it('positive payday clears streak', () => {
    let g = withCareer(7)
    const id = g.players[0].id
    g = paydayMove(
      {
        ...g,
        players: g.players.map((p) =>
          p.id === id
            ? { ...p, cash: 5, salary: 2, fixedExpense: 0.3, negativePaydayStreak: 1 }
            : p,
        ),
      } as GameState,
      5,
      1,
    )
    // override: call again with high cash path
    g = reduce(
      {
        ...withCareer(8),
        phase: 'playing',
        players: withCareer(8).players.map((p, i) =>
          i === 0
            ? {
                ...p,
                cash: 3,
                salary: 1.5,
                fixedExpense: 0.4,
                shops: [],
                investments: [],
                negativePaydayStreak: 1,
              }
            : p,
        ),
        moveAnimation: {
          playerId: 'p0',
          track: 'worker',
          path: [0, 1],
          pathIndex: 1,
          dice: 1,
          passedPayday: true,
          finalPosition: 1,
          reels: [1, 1, 1],
        },
      },
      { type: 'FINISH_MOVE' },
    )
    expect(g.players[0].cash).toBeGreaterThanOrEqual(0)
    expect(g.players[0].negativePaydayStreak).toBe(0)
    expect(g.phase).toBe('playing')
  })
})
