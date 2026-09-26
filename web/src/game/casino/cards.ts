/** 扑克牌与牌靴 */

export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 // A..K

export interface Card {
  suit: Suit
  rank: Rank
}

const SUITS: Suit[] = ['S', 'H', 'D', 'C']

export function cardLabel(c: Card): string {
  const r =
    c.rank === 1 ? 'A' : c.rank === 11 ? 'J' : c.rank === 12 ? 'Q' : c.rank === 13 ? 'K' : String(c.rank)
  const s = { S: '♠', H: '♥', D: '♦', C: '♣' }[c.suit]
  return `${s}${r}`
}

export function buildShoe(decks: number, rng: () => number): Card[] {
  const shoe: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        shoe.push({ suit, rank: rank as Rank })
      }
    }
  }
  // Fisher–Yates
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shoe[i], shoe[j]] = [shoe[j], shoe[i]]
  }
  return shoe
}

export function draw(shoe: Card[]): { card: Card; shoe: Card[] } {
  if (!shoe.length) throw new Error('shoe empty')
  const card = shoe[0]
  return { card, shoe: shoe.slice(1) }
}

export function baccaratValue(c: Card): number {
  if (c.rank >= 10) return 0
  return c.rank
}

export function baccaratTotal(cards: Card[]): number {
  return cards.reduce((s, c) => s + baccaratValue(c), 0) % 10
}

/** 二十一点：A 可 1/11 */
export function blackjackTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const c of cards) {
    if (c.rank === 1) {
      aces += 1
      total += 1
    } else if (c.rank >= 10) total += 10
    else total += c.rank
  }
  let soft = false
  if (aces > 0 && total + 10 <= 21) {
    total += 10
    soft = true
  }
  return { total, soft }
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && blackjackTotal(cards).total === 21
}

export function ranksEqualForSplit(a: Card, b: Card): boolean {
  const va = a.rank >= 10 ? 10 : a.rank
  const vb = b.rank >= 10 ? 10 : b.rank
  return va === vb
}
