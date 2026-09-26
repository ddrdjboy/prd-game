import type { BaccaratRound } from './baccarat'
import type { BlackjackRound } from './blackjack'
import type { DiceRound } from './craps'
import { emptyBaccarat } from './baccarat'
import { emptyDice } from './craps'
import { emptyBlackjack } from './blackjack'

export type CasinoGame = 'baccarat' | 'dice' | 'blackjack'

export interface PendingCasino {
  playerId: string
  screen: 'lobby' | CasinoGame
  /** 本会话已完成局数（用于 AI 限制） */
  handsPlayed: number
  shoe: import('./cards').Card[] | null
  baccarat: BaccaratRound | null
  dice: DiceRound | null
  blackjack: BlackjackRound | null
}

export function createCasinoSession(playerId: string): PendingCasino {
  return {
    playerId,
    screen: 'lobby',
    handsPlayed: 0,
    shoe: null,
    baccarat: null,
    dice: null,
    blackjack: null,
  }
}

export function openTable(
  session: PendingCasino,
  game: CasinoGame,
  rng: () => number,
): PendingCasino {
  if (game === 'baccarat') {
    return {
      ...session,
      screen: 'baccarat',
      baccarat: emptyBaccarat(),
      dice: null,
      blackjack: null,
    }
  }
  if (game === 'dice') {
    return {
      ...session,
      screen: 'dice',
      dice: emptyDice(),
      baccarat: null,
      blackjack: null,
    }
  }
  return {
    ...session,
    screen: 'blackjack',
    blackjack: emptyBlackjack(rng),
    baccarat: null,
    dice: null,
  }
}

export * from './baccarat'
export * from './craps'
export * from './blackjack'
export * from './cards'
