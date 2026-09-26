import {
  blackjackTotal,
  buildShoe,
  cardLabel,
  draw,
  isBlackjack,
  ranksEqualForSplit,
  type Card,
} from './cards'

export type BjPhase =
  | 'betting'
  | 'insurance'
  | 'player'
  | 'dealer'
  | 'settled'

export interface BjHand {
  cards: Card[]
  stake: number
  done: boolean
  doubled: boolean
  busted: boolean
  stood: boolean
}

export interface BlackjackRound {
  phase: BjPhase
  stake: number
  shoe: Card[]
  playerHands: BjHand[]
  activeHand: number
  dealerCards: Card[]
  dealerHoleHidden: boolean
  insuranceOffered: boolean
  insuranceTaken: boolean
  insuranceStake: number
  splitUsed: boolean
  payoutDelta: number
  message: string
}

export function emptyBlackjack(rng: () => number): BlackjackRound {
  return {
    phase: 'betting',
    stake: 0,
    shoe: buildShoe(6, rng),
    playerHands: [],
    activeHand: 0,
    dealerCards: [],
    dealerHoleHidden: true,
    insuranceOffered: false,
    insuranceTaken: false,
    insuranceStake: 0,
    splitUsed: false,
    payoutDelta: 0,
    message: '选择注码开始 21 点',
  }
}

function ensureShoe(round: BlackjackRound, rng: () => number): BlackjackRound {
  if (round.shoe.length < 40) {
    return { ...round, shoe: buildShoe(6, rng), message: round.message + '（已换新靴）' }
  }
  return round
}

export function startBlackjackDeal(
  round: BlackjackRound,
  stake: number,
  rng: () => number,
): BlackjackRound {
  let r = ensureShoe({ ...round, stake, payoutDelta: 0 }, rng)
  let shoe = r.shoe
  let d = draw(shoe)
  shoe = d.shoe
  const p1 = d.card
  d = draw(shoe)
  shoe = d.shoe
  const dealerUp = d.card
  d = draw(shoe)
  shoe = d.shoe
  const p2 = d.card
  d = draw(shoe)
  shoe = d.shoe
  const dealerHole = d.card

  const playerHands: BjHand[] = [
    { cards: [p1, p2], stake, done: false, doubled: false, busted: false, stood: false },
  ]
  const dealerCards = [dealerUp, dealerHole]
  const playerBj = isBlackjack(playerHands[0].cards)
  const dealerBj = isBlackjack(dealerCards)

  if (playerBj || dealerBj) {
    return settleImmediate({
      ...r,
      shoe,
      playerHands,
      dealerCards,
      dealerHoleHidden: false,
      phase: 'settled',
      insuranceOffered: false,
    })
  }

  const offerIns = dealerUp.rank === 1
  if (offerIns) {
    return {
      ...r,
      shoe,
      playerHands,
      dealerCards,
      dealerHoleHidden: true,
      phase: 'insurance',
      insuranceOffered: true,
      insuranceTaken: false,
      insuranceStake: 0,
      message: '庄家明牌 A，是否买保险？（半注）',
    }
  }

  return {
    ...r,
    shoe,
    playerHands,
    dealerCards,
    dealerHoleHidden: true,
    phase: 'player',
    insuranceOffered: false,
    message: '请选择：要牌 / 停牌 / 加倍' + (ranksEqualForSplit(p1, p2) ? ' / 分牌' : ''),
  }
}

export function takeInsurance(round: BlackjackRound, take: boolean): BlackjackRound {
  if (round.phase !== 'insurance') return round
  const ins = take ? round2(round.stake / 2) : 0
  // peek dealer BJ
  const dealerBj = isBlackjack(round.dealerCards)
  if (dealerBj) {
    let delta = take ? round2(ins * 2) : 0 // insurance pays 2:1 on the insurance stake → net +2*ins if we already deducted ins... 
    // We'll deduct insurance stake from cash when taking; payout: win insurance 2:1 means get 3*ins back? Standard: bet half, pays 2:1 so you receive 2x insurance bet profit + stake returned = net +ins if counted as profit only.
    // Spec: 保险猜中庄 BJ 2:1 — if paid ins amount I, win +2I profit, and main bet pushes if both BJ else lose main.
    // Dealer BJ, player not BJ: lose main stake, insurance wins +2*ins (profit). Net = -stake + 2*ins (and -ins already paid so cash: -ins -stake + 3*ins = -stake + 2*ins if we apply delta as net including insurance cost)
    // Define payoutDelta as net cash change for the whole round including stakes.
    if (take) {
      delta = round2(-round.stake - ins + ins * 3) // pay ins+stake, get 3*ins back (stake lost, ins pays 2:1 → return 3*ins)
      // simpler: net = -stake + 2*ins (insurance profit) ; cost of ins included in profit calc: -stake -ins + 3*ins = -stake +2*ins
      delta = round2(-round.stake + 2 * ins)
    } else {
      delta = round2(-round.stake)
    }
    return {
      ...round,
      phase: 'settled',
      dealerHoleHidden: false,
      insuranceTaken: take,
      insuranceStake: ins,
      payoutDelta: delta,
      message: take
        ? `庄家黑杰。保险赔付，主注输掉。净 ${fmt(delta)}`
        : `庄家黑杰。未买保险，主注输掉。`,
      playerHands: round.playerHands.map((h) => ({ ...h, done: true })),
    }
  }

  // no dealer BJ — insurance lost
  return {
    ...round,
    phase: 'player',
    insuranceTaken: take,
    insuranceStake: ins,
    payoutDelta: take ? round2(-ins) : 0,
    message: take ? '庄无黑杰，保险输掉。继续操作。' : '不买保险。继续操作。',
  }
}

export function bjHit(round: BlackjackRound): BlackjackRound {
  if (round.phase !== 'player') return round
  const hands = [...round.playerHands]
  const hi = round.activeHand
  const hand = { ...hands[hi] }
  const d = draw(round.shoe)
  hand.cards = [...hand.cards, d.card]
  const { total } = blackjackTotal(hand.cards)
  if (total > 21) {
    hand.busted = true
    hand.done = true
  }
  hands[hi] = hand
  let r: BlackjackRound = { ...round, shoe: d.shoe, playerHands: hands, message: hand.busted ? '爆牌' : `要牌 → ${total}` }
  if (hand.done) r = advanceHandOrDealer(r)
  return r
}

export function bjStand(round: BlackjackRound): BlackjackRound {
  if (round.phase !== 'player') return round
  const hands = [...round.playerHands]
  const hand = { ...hands[round.activeHand], stood: true, done: true }
  hands[round.activeHand] = hand
  return advanceHandOrDealer({ ...round, playerHands: hands, message: '停牌' })
}

export function bjDouble(round: BlackjackRound): BlackjackRound {
  if (round.phase !== 'player') return round
  const hands = [...round.playerHands]
  const hi = round.activeHand
  const hand = hands[hi]
  if (hand.cards.length !== 2 || hand.doubled) return round
  const d = draw(round.shoe)
  const next: BjHand = {
    ...hand,
    cards: [...hand.cards, d.card],
    stake: round2(hand.stake * 2),
    doubled: true,
    done: true,
    stood: true,
    busted: blackjackTotal([...hand.cards, d.card]).total > 21,
  }
  hands[hi] = next
  return advanceHandOrDealer({
    ...round,
    shoe: d.shoe,
    playerHands: hands,
    message: next.busted ? '加倍后爆牌' : `加倍，点数 ${blackjackTotal(next.cards).total}`,
  })
}

export function bjSplit(round: BlackjackRound, rng: () => number): BlackjackRound {
  if (round.phase !== 'player' || round.splitUsed) return round
  const hand = round.playerHands[0]
  if (round.playerHands.length !== 1 || hand.cards.length !== 2) return round
  if (!ranksEqualForSplit(hand.cards[0], hand.cards[1])) return round

  let shoe = round.shoe
  let d = draw(shoe)
  shoe = d.shoe
  const c1 = d.card
  d = draw(shoe)
  shoe = d.shoe
  const c2 = d.card

  const hands: BjHand[] = [
    { cards: [hand.cards[0], c1], stake: hand.stake, done: false, doubled: false, busted: false, stood: false },
    { cards: [hand.cards[1], c2], stake: hand.stake, done: false, doubled: false, busted: false, stood: false },
  ]
  return {
    ...round,
    shoe,
    playerHands: hands,
    activeHand: 0,
    splitUsed: true,
    message: '已分牌，操作第一手',
  }
}

function advanceHandOrDealer(round: BlackjackRound): BlackjackRound {
  const nextIdx = round.playerHands.findIndex((h, i) => i > round.activeHand && !h.done)
  if (nextIdx >= 0) {
    return {
      ...round,
      activeHand: nextIdx,
      message: `操作第 ${nextIdx + 1} 手`,
    }
  }
  if (round.playerHands.every((h) => h.busted)) {
    return settleVsDealer({ ...round, dealerHoleHidden: false, phase: 'settled' })
  }
  return playDealer({ ...round, dealerHoleHidden: false, phase: 'dealer' })
}

function playDealer(round: BlackjackRound): BlackjackRound {
  let shoe = round.shoe
  let dealerCards = [...round.dealerCards]
  // S17: stand on soft 17；最多补牌 12 次防止异常死循环
  for (let i = 0; i < 12; i++) {
    const { total, soft } = blackjackTotal(dealerCards)
    if (total >= 17) break
    if (total > 21) break
    if (shoe.length < 1) break
    const d = draw(shoe)
    shoe = d.shoe
    dealerCards = [...dealerCards, d.card]
    void soft
  }
  return settleVsDealer({ ...round, shoe, dealerCards, phase: 'settled' })
}

function settleImmediate(round: BlackjackRound): BlackjackRound {
  const pBj = isBlackjack(round.playerHands[0].cards)
  const dBj = isBlackjack(round.dealerCards)
  const stake = round.playerHands[0].stake
  if (pBj && dBj) {
    return {
      ...round,
      phase: 'settled',
      dealerHoleHidden: false,
      payoutDelta: 0,
      message: '双方黑杰，推注',
      playerHands: round.playerHands.map((h) => ({ ...h, done: true })),
    }
  }
  if (pBj) {
    const win = round2(stake * 1.5)
    return {
      ...round,
      phase: 'settled',
      dealerHoleHidden: false,
      payoutDelta: win,
      message: `黑杰！赔 3:2，+${win} 万`,
      playerHands: round.playerHands.map((h) => ({ ...h, done: true })),
    }
  }
  return {
    ...round,
    phase: 'settled',
    dealerHoleHidden: false,
    payoutDelta: round2(-stake),
    message: '庄家黑杰，主注输掉',
    playerHands: round.playerHands.map((h) => ({ ...h, done: true })),
  }
}

function settleVsDealer(round: BlackjackRound): BlackjackRound {
  const dealerTotal = blackjackTotal(round.dealerCards).total
  const dealerBust = dealerTotal > 21
  let delta = round.payoutDelta // may include lost insurance
  const parts: string[] = []

  for (const hand of round.playerHands) {
    if (hand.busted) {
      delta = round2(delta - hand.stake)
      parts.push(`一手爆牌 -${hand.stake}`)
      continue
    }
    const pt = blackjackTotal(hand.cards).total
    if (dealerBust || pt > dealerTotal) {
      delta = round2(delta + hand.stake)
      parts.push(`一手赢 +${hand.stake}`)
    } else if (pt < dealerTotal) {
      delta = round2(delta - hand.stake)
      parts.push(`一手输 -${hand.stake}`)
    } else {
      parts.push('一手推注')
    }
  }

  return {
    ...round,
    phase: 'settled',
    payoutDelta: delta,
    message: `庄 ${dealerBust ? '爆' : dealerTotal}。${parts.join('；')}。净 ${fmt(delta)}`,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

export function formatHand(cards: Card[], hideHole?: boolean): string {
  if (hideHole && cards.length >= 2) {
    return `${cardLabel(cards[0])} [?]`
  }
  return cards.map(cardLabel).join(' ')
}

export { blackjackTotal, cardLabel }
