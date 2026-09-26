import {
  buildShoe,
  comeOutRoll,
  createCasinoSession,
  dealBaccarat,
  emptyDice,
  openTable,
  pointRoll,
  roll2d6,
  startBlackjackDeal,
  takeInsurance,
  bjHit,
  bjStand,
  bjDouble,
  bjSplit,
  blackjackTotal,
  type CasinoGame,
  type PendingCasino,
} from './casino'
import { round2 } from './finance'
import { createRng } from './rng'
import type { GameState } from './types'

function applyCash(state: GameState, playerId: string, delta: number): GameState {
  if (Math.abs(delta) < 1e-12) return state
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, cash: round2(p.cash + delta) } : p,
    ),
  }
}

function setCasino(state: GameState, casino: PendingCasino | null): GameState {
  return { ...state, pendingCasino: casino }
}

export function casinoEnter(state: GameState): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'casino') return state
  if (state.pendingCasino?.playerId === loc.playerId) return state
  return setCasino(state, createCasinoSession(loc.playerId))
}

export function casinoLeave(state: GameState): GameState {
  return {
    ...state,
    pendingCasino: null,
    pendingLocation: null,
  }
}

export function casinoLobby(state: GameState): GameState {
  const c = state.pendingCasino
  if (!c) return state
  // 未结算局不允许逃
  if (c.baccarat && c.baccarat.phase !== 'betting' && c.baccarat.phase !== 'settled') return state
  if (c.dice && c.dice.phase !== 'betting' && c.dice.phase !== 'settled') return state
  if (c.blackjack && c.blackjack.phase !== 'betting' && c.blackjack.phase !== 'settled') return state
  return setCasino(state, {
    ...c,
    screen: 'lobby',
    baccarat: null,
    dice: null,
    blackjack: null,
  })
}

export function casinoOpen(state: GameState, game: CasinoGame): GameState {
  let s = casinoEnter(state)
  const c = s.pendingCasino
  if (!c) return s
  const rng = createRng(s.rngState)
  const next = openTable(c, game, () => rng.next())
  return { ...setCasino(s, next), rngState: rng.state() }
}

export function casinoBaccaratBet(
  state: GameState,
  betKind: 'player' | 'banker' | 'tie',
  amount: number,
): GameState {
  const c = state.pendingCasino
  if (!c || c.screen !== 'baccarat' || !c.baccarat) return state
  if (c.baccarat.phase !== 'betting' && c.baccarat.phase !== 'settled') return state
  const p = state.players.find((x) => x.id === c.playerId)!
  const stake = round2(amount)
  if (stake <= 0 || p.cash + 1e-9 < stake) return state

  const rng = createRng(state.rngState)
  let shoe = c.shoe && c.shoe.length > 20 ? c.shoe : buildShoe(8, () => rng.next())
  const { round, shoe: shoe2 } = dealBaccarat(shoe, betKind, stake)
  let s = applyCash(state, c.playerId, round.payoutDelta)
  s = {
    ...s,
    rngState: rng.state(),
    pendingCasino: {
      ...c,
      shoe: shoe2,
      handsPlayed: c.handsPlayed + 1,
      baccarat: round,
    },
  }
  return pushSimpleLog(s, `${p.name} 百家乐：${round.message}`)
}

export function casinoDiceBet(
  state: GameState,
  line: 'pass' | 'dontPass',
  amount: number,
  fieldAmount = 0,
): GameState {
  const c = state.pendingCasino
  if (!c || c.screen !== 'dice') return state
  const p = state.players.find((x) => x.id === c.playerId)!
  const stake = round2(amount)
  const field = round2(fieldAmount)
  if (stake <= 0 || p.cash + 1e-9 < stake + field) return state

  const rng = createRng(state.rngState)
  const dice = roll2d6(() => rng.next())
  let round: import('./casino').DiceRound = {
    ...emptyDice(),
    phase: 'comeOut',
    line,
    stake,
    fieldStake: field,
  }
  round = comeOutRoll(round, dice)
  let s = state
  if (round.phase === 'settled') {
    s = applyCash(s, c.playerId, round.payoutDelta)
    s = {
      ...s,
      rngState: rng.state(),
      pendingCasino: {
        ...c,
        handsPlayed: c.handsPlayed + 1,
        dice: round,
      },
    }
  } else {
    // point：先结算 Field 现金，line 注仍压在桌上
    s = applyCash(s, c.playerId, round.payoutDelta)
    s = {
      ...s,
      rngState: rng.state(),
      pendingCasino: {
        ...c,
        dice: { ...round, payoutDelta: 0 },
      },
    }
  }
  return pushSimpleLog(s, `${p.name} 骰子：${round.message}`)
}

export function casinoDiceRoll(state: GameState): GameState {
  const c = state.pendingCasino
  if (!c?.dice || c.dice.phase !== 'point') return state
  const p = state.players.find((x) => x.id === c.playerId)!
  const rng = createRng(state.rngState)
  const dice = roll2d6(() => rng.next())
  // point 阶段 payoutDelta 已清零，pointRoll 的 prior 为 0，settle 时仅为 line 输赢
  const round = pointRoll({ ...c.dice, payoutDelta: 0 }, dice)
  let s = state
  if (round.phase === 'settled') {
    s = applyCash(s, c.playerId, round.payoutDelta)
    s = {
      ...s,
      rngState: rng.state(),
      pendingCasino: {
        ...c,
        handsPlayed: c.handsPlayed + 1,
        dice: round,
      },
    }
  } else {
    s = {
      ...s,
      rngState: rng.state(),
      pendingCasino: { ...c, dice: round },
    }
  }
  return pushSimpleLog(s, `${p.name} 骰子：${round.message}`)
}

export function casinoBjBet(state: GameState, amount: number): GameState {
  const c = state.pendingCasino
  if (!c || c.screen !== 'blackjack' || !c.blackjack) return state
  if (c.blackjack.phase !== 'betting' && c.blackjack.phase !== 'settled') return state
  const p = state.players.find((x) => x.id === c.playerId)!
  const stake = round2(amount)
  if (stake <= 0 || p.cash + 1e-9 < stake) return state
  const rng = createRng(state.rngState)
  let bj = c.blackjack.phase === 'settled' ? { ...c.blackjack, phase: 'betting' as const } : c.blackjack
  bj = startBlackjackDeal(bj, stake, () => rng.next())
  let s = state
  if (bj.phase === 'settled') {
    s = applyCash(s, c.playerId, bj.payoutDelta)
    s = {
      ...s,
      rngState: rng.state(),
      pendingCasino: { ...c, handsPlayed: c.handsPlayed + 1, blackjack: bj },
    }
  } else {
    s = {
      ...s,
      rngState: rng.state(),
      pendingCasino: { ...c, blackjack: bj },
    }
  }
  return pushSimpleLog(s, `${p.name} 21点：${bj.message}`)
}

export function casinoBjInsurance(state: GameState, take: boolean): GameState {
  const c = state.pendingCasino
  if (!c?.blackjack || c.blackjack.phase !== 'insurance') return state
  const p = state.players.find((x) => x.id === c.playerId)!
  if (take && p.cash + 1e-9 < c.blackjack.stake / 2) return state
  const bj = takeInsurance(c.blackjack, take)
  let s = state
  if (bj.phase === 'settled') {
    s = applyCash(s, c.playerId, bj.payoutDelta)
    s = {
      ...s,
      pendingCasino: { ...c, handsPlayed: c.handsPlayed + 1, blackjack: bj },
    }
  } else {
    // insurance lost already in payoutDelta
    if (bj.payoutDelta) s = applyCash(s, c.playerId, bj.payoutDelta)
    s = {
      ...s,
      pendingCasino: { ...c, blackjack: { ...bj, payoutDelta: 0 } },
    }
  }
  return pushSimpleLog(s, `${p.name} 21点：${bj.message}`)
}

export function casinoBjHit(state: GameState): GameState {
  return finishBjAction(state, (bj) => bjHit(bj))
}
export function casinoBjStand(state: GameState): GameState {
  return finishBjAction(state, (bj) => bjStand(bj))
}
export function casinoBjDouble(state: GameState): GameState {
  const c = state.pendingCasino
  if (!c?.blackjack || c.blackjack.phase !== 'player') return state
  const hand = c.blackjack.playerHands[c.blackjack.activeHand]
  const p = state.players.find((x) => x.id === c.playerId)!
  if (p.cash + 1e-9 < hand.stake) return state
  return finishBjAction(state, (bj) => bjDouble(bj))
}
export function casinoBjSplit(state: GameState): GameState {
  const c = state.pendingCasino
  if (!c?.blackjack || c.blackjack.phase !== 'player') return state
  const p = state.players.find((x) => x.id === c.playerId)!
  if (p.cash + 1e-9 < c.blackjack.stake) return state
  const rng = createRng(state.rngState)
  const bj = bjSplit(c.blackjack, () => rng.next())
  let s: GameState = { ...state, rngState: rng.state() }
  s = {
    ...s,
    pendingCasino: { ...c, blackjack: bj },
  }
  return pushSimpleLog(s, `${p.name} 21点：${bj.message}`)
}

export function casinoBjNext(state: GameState): GameState {
  const c = state.pendingCasino
  if (!c?.blackjack || c.blackjack.phase !== 'settled') return state
  const rng = createRng(state.rngState)
  const bj = {
    ...c.blackjack,
    phase: 'betting' as const,
    playerHands: [],
    dealerCards: [],
    payoutDelta: 0,
    message: '再来一局，选择注码',
    insuranceOffered: false,
    insuranceTaken: false,
    splitUsed: false,
  }
  return {
    ...state,
    rngState: rng.state(),
    pendingCasino: { ...c, blackjack: bj },
  }
}

function finishBjAction(
  state: GameState,
  fn: (bj: NonNullable<PendingCasino['blackjack']>) => NonNullable<PendingCasino['blackjack']>,
): GameState {
  const c = state.pendingCasino
  if (!c?.blackjack) return state
  const p = state.players.find((x) => x.id === c.playerId)!
  const bj = fn(c.blackjack)
  let s = state
  if (bj.phase === 'settled') {
    s = applyCash(s, c.playerId, bj.payoutDelta)
    s = {
      ...s,
      pendingCasino: { ...c, handsPlayed: c.handsPlayed + 1, blackjack: bj },
    }
  } else {
    s = { ...s, pendingCasino: { ...c, blackjack: bj } }
  }
  return pushSimpleLog(s, `${p.name} 21点：${bj.message}`)
}

function pushSimpleLog(state: GameState, text: string): GameState {
  const id = `log-casino-${state.logs.length}-${state.rngState}`
  return { ...state, logs: [...state.logs.slice(-80), { id, text }] }
}

/** AI：进场玩有限局后离开 */
export function casinoAiStep(state: GameState): GameState {
  let s = casinoEnter(state)
  const c = s.pendingCasino
  if (!c) return casinoLeave(s)
  const p = s.players.find((x) => x.id === c.playerId)!
  const style = p.aiStyle ?? 'steady'
  const maxHands = style === 'aggressive' ? 2 : style === 'social' ? 1 : 0
  if (maxHands === 0) return pushSimpleLog(casinoLeave(s), `${p.name} 路过赌场，未入座。`)
  if (c.handsPlayed >= maxHands) return pushSimpleLog(casinoLeave(s), `${p.name} 离开赌场。`)

  // 若在局中，尽量收尾
  if (c.screen === 'dice' && c.dice?.phase === 'point') {
    s = casinoDiceRoll(s)
    return s
  }
  if (c.screen === 'blackjack' && c.blackjack) {
    if (c.blackjack.phase === 'insurance') return casinoBjInsurance(s, false)
    if (c.blackjack.phase === 'player') {
      const hand = c.blackjack.playerHands[c.blackjack.activeHand]
      const total = hand ? blackjackTotal(hand.cards).total : 21
      if (total <= 11) return casinoBjHit(s)
      return casinoBjStand(s)
    }
    if (c.blackjack.phase === 'settled' || c.blackjack.phase === 'betting') {
      // fall through to new bet or leave
    }
  }

  if (c.handsPlayed >= maxHands) return casinoLeave(s)

  const bet = 0.2
  if (p.cash + 1e-9 < bet) return casinoLeave(s)

  if (c.screen === 'lobby') {
    s = casinoOpen(s, style === 'social' ? 'baccarat' : 'dice')
  }
  const c2 = s.pendingCasino!
  if (c2.screen === 'baccarat') {
    return casinoBaccaratBet(s, 'player', bet)
  }
  if (c2.screen === 'dice') {
    if (c2.dice?.phase === 'point') return casinoDiceRoll(s)
    return casinoDiceBet(s, 'pass', bet, 0)
  }
  if (c2.screen === 'blackjack') {
    if (c2.blackjack?.phase === 'settled') s = casinoBjNext(s)
    return casinoBjBet(s, bet)
  }
  return casinoLeave(s)
}
