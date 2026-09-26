import {
  buySymbol,
  closeTradePositions,
  createExchangeSession,
  createTradeSession,
  EXCHANGE_MAX_TRADE_SESSIONS,
  EXCHANGE_STAKES,
  sellSymbol,
  setCryptoLeverage,
  tickTrade,
  type Leverage,
  type PendingExchange,
} from './exchange'
import { round2 } from './finance'
import { createRng } from './rng'
import type { GameState } from './types'

function setExchange(state: GameState, exchange: PendingExchange | null): GameState {
  return { ...state, pendingExchange: exchange }
}

function pushLog(state: GameState, text: string): GameState {
  return {
    ...state,
    logs: [...state.logs.slice(-80), { id: `ex-${state.logs.length}`, text }],
  }
}

function applyPlayerCash(state: GameState, playerId: string, delta: number): GameState {
  if (Math.abs(delta) < 1e-12) return state
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, cash: round2(p.cash + delta) } : p,
    ),
  }
}

export function exchangeEnter(state: GameState): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'invest') return state
  if (state.pendingExchange?.playerId === loc.playerId) return state
  return setExchange(state, createExchangeSession(loc.playerId))
}

export function exchangeLeave(state: GameState): GameState {
  const ex = state.pendingExchange
  if (ex?.trade && !ex.trade.ended) {
    // 强制收盘再离开
    state = exchangeClose(state)
  }
  return {
    ...state,
    pendingExchange: null,
    pendingLocation: null,
  }
}

export function exchangeLobby(state: GameState): GameState {
  const ex = state.pendingExchange
  if (!ex) return state
  if (ex.screen === 'trade' && ex.trade && !ex.trade.ended) return state
  return setExchange(state, {
    ...ex,
    screen: 'lobby',
    trade: ex.trade?.ended ? null : ex.trade,
  })
}

export function exchangeOpenFunds(state: GameState): GameState {
  const ex = state.pendingExchange
  if (!ex) return state
  if (ex.screen === 'trade' && ex.trade && !ex.trade.ended) return state
  return setExchange(state, { ...ex, screen: 'funds', trade: null })
}

export function exchangeOpenTrade(state: GameState, stake: number): GameState {
  const ex = state.pendingExchange
  if (!ex || ex.screen === 'trade') return state
  if (ex.tradeSessionsPlayed >= EXCHANGE_MAX_TRADE_SESSIONS) {
    return pushLog(state, '本落点交易盘只能玩一局。')
  }
  if (!(EXCHANGE_STAKES as readonly number[]).includes(stake)) {
    return pushLog(state, '入场金额无效。')
  }
  const player = state.players.find((p) => p.id === ex.playerId)
  if (!player) return state
  if (player.cash + 1e-9 < stake) {
    return pushLog(state, `${player.name} 现金不足，无法入场（需 ${stake} 万）。`)
  }
  const rng = createRng(state.rngState)
  const trade = createTradeSession(stake, () => rng.next())
  let s = applyPlayerCash(state, ex.playerId, -stake)
  s = setExchange(s, {
    ...ex,
    screen: 'trade',
    trade,
  })
  s = { ...s, rngState: rng.state() }
  return pushLog(s, `${player.name} 划入 ${stake} 万进交易盘。`)
}

export function exchangeTick(state: GameState): GameState {
  const ex = state.pendingExchange
  if (!ex?.trade || ex.screen !== 'trade' || ex.trade.ended) return state
  const rng = createRng(state.rngState)
  let trade = tickTrade(ex.trade, () => rng.next())
  let s: GameState = { ...state, rngState: rng.state() }

  if (trade.ended === 'liquidate' || trade.ended === 'close') {
    s = settleTradeToPlayer(s, ex, trade)
    return s
  }

  return setExchange(s, { ...ex, trade })
}

export function exchangeBuy(
  state: GameState,
  symbolId: string,
  amount: number,
): GameState {
  const ex = state.pendingExchange
  if (!ex?.trade || ex.screen !== 'trade' || ex.trade.ended) return state
  const result = buySymbol(ex.trade, symbolId, amount)
  if ('error' in result) return pushLog(state, result.error)
  return setExchange(state, { ...ex, trade: result })
}

export function exchangeSell(
  state: GameState,
  symbolId: string,
  qtyRatio = 1,
): GameState {
  const ex = state.pendingExchange
  if (!ex?.trade || ex.screen !== 'trade' || ex.trade.ended) return state
  const result = sellSymbol(ex.trade, symbolId, qtyRatio)
  if ('error' in result) return pushLog(state, result.error)
  return setExchange(state, { ...ex, trade: result })
}

export function exchangeSetLeverage(state: GameState, leverage: Leverage): GameState {
  const ex = state.pendingExchange
  if (!ex?.trade || ex.screen !== 'trade' || ex.trade.ended) return state
  const result = setCryptoLeverage(ex.trade, leverage)
  if ('error' in result) return pushLog(state, result.error)
  return setExchange(state, { ...ex, trade: result })
}

export function exchangeClose(state: GameState): GameState {
  const ex = state.pendingExchange
  if (!ex?.trade) return state
  if (ex.trade.ended) {
    return setExchange(state, {
      ...ex,
      screen: 'lobby',
      trade: null,
    })
  }
  const closed = closeTradePositions(ex.trade, 'close', '主动收盘离场。')
  return settleTradeToPlayer(state, ex, closed)
}

function settleTradeToPlayer(
  state: GameState,
  ex: PendingExchange,
  trade: NonNullable<PendingExchange['trade']>,
): GameState {
  const player = state.players.find((p) => p.id === ex.playerId)
  let s = applyPlayerCash(state, ex.playerId, trade.cash)
  const payout = trade.cash
  const delta = round2(payout - trade.stakeIn)
  s = setExchange(s, {
    ...ex,
    screen: 'lobby',
    tradeSessionsPlayed: ex.tradeSessionsPlayed + 1,
    trade: null,
  })
  const verb =
    trade.ended === 'liquidate' ? '爆仓结算' : trade.ended === 'leave' ? '离场' : '收盘'
  const sign = delta >= 0 ? '+' : ''
  return pushLog(
    s,
    `${player?.name ?? '玩家'} 交易盘${verb}：退回 ${payout} 万（${sign}${delta} 万）。${trade.lastMessage}`,
  )
}

/** AI：优先小额交易盘 1～2 tick，否则回大厅由 applyAiLocation 买理财或离开 */
export function exchangeAiStep(state: GameState): GameState {
  let s = exchangeEnter(state)
  const ex0 = s.pendingExchange
  if (!ex0) return s
  const player = s.players.find((p) => p.id === ex0.playerId)
  if (!player) return exchangeLeave(s)

  const style = player.aiStyle ?? 'steady'

  // 已在未结束的交易中：tick 一次后收盘
  if (ex0.screen === 'trade' && ex0.trade && !ex0.trade.ended) {
    if (ex0.trade.positions.length === 0 && ex0.trade.cash >= 0.1) {
      const sym = style === 'aggressive' ? 'btc' : 'bluechip'
      if (style === 'aggressive') s = exchangeSetLeverage(s, 2)
      const spend = Math.min(0.2, (s.pendingExchange?.trade?.cash ?? 0) * 0.4)
      s = exchangeBuy(s, sym, spend)
    }
    s = exchangeTick(s)
    if (s.pendingExchange?.trade && !s.pendingExchange.trade.ended) {
      s = exchangeClose(s)
    }
    return s
  }

  // 开一局交易盘
  if (ex0.tradeSessionsPlayed < EXCHANGE_MAX_TRADE_SESSIONS) {
    const stake =
      style === 'aggressive' && player.cash >= 1 ? EXCHANGE_STAKES[1] : EXCHANGE_STAKES[0]
    const willing =
      style === 'steady' ? player.cash + 1e-9 >= stake * 2.5 : player.cash + 1e-9 >= stake
    if (willing) {
      s = exchangeOpenTrade(s, stake)
      const trade = s.pendingExchange?.trade
      if (trade && !trade.ended) {
        const sym = style === 'aggressive' ? 'alt' : 'growth'
        if (style === 'aggressive') s = exchangeSetLeverage(s, 2)
        s = exchangeBuy(s, sym, Math.min(0.25, trade.cash * 0.5))
        s = exchangeTick(s)
        if (s.pendingExchange?.trade && !s.pendingExchange.trade.ended) {
          s = exchangeClose(s)
        }
        return s
      }
    }
  }

  return s
}
