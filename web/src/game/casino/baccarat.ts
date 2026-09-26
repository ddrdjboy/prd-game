import { baccaratTotal, type Card, draw } from './cards'

export type BaccaratBetKind = 'player' | 'banker' | 'tie'

export interface BaccaratRound {
  phase: 'betting' | 'dealt' | 'settled'
  betKind: BaccaratBetKind | null
  stake: number
  playerCards: Card[]
  bankerCards: Card[]
  playerPoint: number
  bankerPoint: number
  result: 'player' | 'banker' | 'tie' | null
  /** 相对 stake 的现金变化（已含抽水） */
  payoutDelta: number
  message: string
}

export function emptyBaccarat(): BaccaratRound {
  return {
    phase: 'betting',
    betKind: null,
    stake: 0,
    playerCards: [],
    bankerCards: [],
    playerPoint: 0,
    bankerPoint: 0,
    result: null,
    payoutDelta: 0,
    message: '选择庄 / 闲 / 和并下入注码',
  }
}

/** 标准百家乐补牌表 */
export function dealBaccarat(
  shoe: Card[],
  betKind: BaccaratBetKind,
  stake: number,
): { round: BaccaratRound; shoe: Card[] } {
  let s = shoe
  let d: { card: Card; shoe: Card[] }
  d = draw(s)
  s = d.shoe
  const p1 = d.card
  d = draw(s)
  s = d.shoe
  const b1 = d.card
  d = draw(s)
  s = d.shoe
  const p2 = d.card
  d = draw(s)
  s = d.shoe
  const b2 = d.card

  let playerCards = [p1, p2]
  let bankerCards = [b1, b2]
  let p = baccaratTotal(playerCards)
  let b = baccaratTotal(bankerCards)

  // Natural
  if (p >= 8 || b >= 8) {
    return finish(playerCards, bankerCards, betKind, stake, s)
  }

  let playerThird: Card | null = null
  if (p <= 5) {
    d = draw(s)
    s = d.shoe
    playerThird = d.card
    playerCards = [...playerCards, playerThird]
    p = baccaratTotal(playerCards)
  }

  const bankerDraws = shouldBankerDraw(b, playerThird)
  if (bankerDraws) {
    d = draw(s)
    s = d.shoe
    bankerCards = [...bankerCards, d.card]
    b = baccaratTotal(bankerCards)
  }

  return finish(playerCards, bankerCards, betKind, stake, s)
}

function shouldBankerDraw(bankerPoint: number, playerThird: Card | null): boolean {
  if (playerThird === null) {
    // player stood
    return bankerPoint <= 5
  }
  const pt = baccaratValueSafe(playerThird)
  if (bankerPoint <= 2) return true
  if (bankerPoint === 3) return pt !== 8
  if (bankerPoint === 4) return pt >= 2 && pt <= 7
  if (bankerPoint === 5) return pt >= 4 && pt <= 7
  if (bankerPoint === 6) return pt === 6 || pt === 7
  return false
}

function baccaratValueSafe(c: Card): number {
  if (c.rank >= 10) return 0
  return c.rank
}

function finish(
  playerCards: Card[],
  bankerCards: Card[],
  betKind: BaccaratBetKind,
  stake: number,
  shoe: Card[],
): { round: BaccaratRound; shoe: Card[] } {
  const playerPoint = baccaratTotal(playerCards)
  const bankerPoint = baccaratTotal(bankerCards)
  let result: 'player' | 'banker' | 'tie'
  if (playerPoint > bankerPoint) result = 'player'
  else if (bankerPoint > playerPoint) result = 'banker'
  else result = 'tie'

  const { delta, message } = settleBaccarat(betKind, stake, result)
  return {
    shoe,
    round: {
      phase: 'settled',
      betKind,
      stake,
      playerCards,
      bankerCards,
      playerPoint,
      bankerPoint,
      result,
      payoutDelta: delta,
      message,
    },
  }
}

export function settleBaccarat(
  betKind: BaccaratBetKind,
  stake: number,
  result: 'player' | 'banker' | 'tie',
): { delta: number; message: string } {
  if (result === 'tie') {
    if (betKind === 'tie') {
      return { delta: round2(stake * 8), message: `和局，押和赢 ${round2(stake * 8)} 万` }
    }
    return { delta: 0, message: '和局，庄/闲注退还' }
  }
  if (betKind === 'tie') {
    return { delta: round2(-stake), message: '未开和，和注输掉' }
  }
  if (betKind === result) {
    if (result === 'banker') {
      const win = round2(stake * 0.95)
      return { delta: win, message: `庄赢，抽水后净得 +${win} 万` }
    }
    return { delta: stake, message: `闲赢，净得 +${stake} 万` }
  }
  return { delta: round2(-stake), message: `${result === 'player' ? '闲' : '庄'}胜，本注输掉` }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
