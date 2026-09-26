/** 交易所：标的目录、报价刷新、保证金与爆仓纯函数 */

export type SymbolKind = 'stock' | 'crypto'
export type Leverage = 1 | 2 | 5

export interface ExchangeSymbolDef {
  id: string
  name: string
  kind: SymbolKind
  /** 每棒价格相对波动半幅 */
  volatility: number
  /** 初始参考价（万/单位，抽象单位） */
  basePrice: number
  /** 股票每棒股息占持仓名义的比例；币圈 0 */
  dividendRate: number
  allowedLeverage: Leverage[]
}

export interface ExchangeSymbolState {
  id: string
  price: number
  /** 上一棒涨跌幅，供 UI */
  lastChange: number
}

export interface ExchangePosition {
  symbolId: string
  /** 持仓数量（抽象股/币） */
  qty: number
  /** 开仓均价 */
  entry: number
  leverage: Leverage
}

export type TradeEndReason = 'close' | 'liquidate' | 'leave'

export interface TradeSession {
  stakeIn: number
  cash: number
  tick: number
  maxTicks: number
  symbols: ExchangeSymbolState[]
  positions: ExchangePosition[]
  /** 币圈默认杠杆偏好（无仓时设） */
  cryptoLeverage: Leverage
  ended: TradeEndReason | null
  lastMessage: string
}

export interface PendingExchange {
  playerId: string
  screen: 'lobby' | 'funds' | 'trade'
  tradeSessionsPlayed: number
  trade: TradeSession | null
}

export const EXCHANGE_STAKES = [0.5, 1.0, 2.0] as const
export const EXCHANGE_MAX_TICKS = 8
export const EXCHANGE_MAX_TRADE_SESSIONS = 1
/** 维持保证金率：权益/名义 < 此值爆仓 */
export const MAINTENANCE_MARGIN = 0.2
export const STOCK_DIVIDEND_RATE = 0.002

export const EXCHANGE_SYMBOLS: ExchangeSymbolDef[] = [
  {
    id: 'bluechip',
    name: '蓝筹股',
    kind: 'stock',
    volatility: 0.04,
    basePrice: 1.0,
    dividendRate: STOCK_DIVIDEND_RATE,
    allowedLeverage: [1],
  },
  {
    id: 'growth',
    name: '成长股',
    kind: 'stock',
    volatility: 0.08,
    basePrice: 0.8,
    dividendRate: STOCK_DIVIDEND_RATE,
    allowedLeverage: [1],
  },
  {
    id: 'theme',
    name: '题材股',
    kind: 'stock',
    volatility: 0.12,
    basePrice: 0.5,
    dividendRate: STOCK_DIVIDEND_RATE,
    allowedLeverage: [1],
  },
  {
    id: 'btc',
    name: '主流币',
    kind: 'crypto',
    volatility: 0.18,
    basePrice: 1.2,
    dividendRate: 0,
    allowedLeverage: [1, 2, 5],
  },
  {
    id: 'alt',
    name: '山寨币',
    kind: 'crypto',
    volatility: 0.28,
    basePrice: 0.4,
    dividendRate: 0,
    allowedLeverage: [1, 2, 5],
  },
]

export function symbolDefById(id: string): ExchangeSymbolDef | undefined {
  return EXCHANGE_SYMBOLS.find((s) => s.id === id)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function createExchangeSession(playerId: string): PendingExchange {
  return {
    playerId,
    screen: 'lobby',
    tradeSessionsPlayed: 0,
    trade: null,
  }
}

export function createTradeSession(stake: number, rng: () => number): TradeSession {
  const symbols: ExchangeSymbolState[] = EXCHANGE_SYMBOLS.map((d) => {
    const jitter = 1 + (rng() * 2 - 1) * 0.03
    return {
      id: d.id,
      price: round4(d.basePrice * jitter),
      lastChange: 0,
    }
  })
  return {
    stakeIn: stake,
    cash: stake,
    tick: 0,
    maxTicks: EXCHANGE_MAX_TICKS,
    symbols,
    positions: [],
    cryptoLeverage: 1,
    ended: null,
    lastMessage: `入场 ${stake} 万，等待开盘。`,
  }
}

export function getSymbolPrice(trade: TradeSession, symbolId: string): number {
  return trade.symbols.find((s) => s.id === symbolId)?.price ?? 0
}

/** 名义价值 = qty * price */
export function positionNotional(pos: ExchangePosition, price: number): number {
  return Math.abs(pos.qty) * price
}

/** 占用保证金 = 名义 / leverage */
export function positionMargin(pos: ExchangePosition, price: number): number {
  const lev = Math.max(1, pos.leverage)
  return positionNotional(pos, price) / lev
}

/** 未实现盈亏（多头） */
export function positionUpnl(pos: ExchangePosition, price: number): number {
  return pos.qty * (price - pos.entry)
}

export function tradeEquity(trade: TradeSession): number {
  let eq = trade.cash
  for (const pos of trade.positions) {
    const price = getSymbolPrice(trade, pos.symbolId)
    eq += positionMargin(pos, price) + positionUpnl(pos, price)
  }
  return round2(eq)
}

export function tradeUsedMargin(trade: TradeSession): number {
  let m = 0
  for (const pos of trade.positions) {
    m += positionMargin(pos, getSymbolPrice(trade, pos.symbolId))
  }
  return round2(m)
}

export function freeCash(trade: TradeSession): number {
  return round2(trade.cash)
}

/** 刷新全部报价；发股息；返回是否应爆仓 */
export function tickTrade(trade: TradeSession, rng: () => number): TradeSession {
  if (trade.ended) return trade
  const symbols = trade.symbols.map((s) => {
    const def = symbolDefById(s.id)
    const sigma = def?.volatility ?? 0.1
    const change = (rng() * 2 - 1) * sigma
    const next = Math.max(0.05, s.price * (1 + change))
    return {
      ...s,
      price: round4(next),
      lastChange: round4(change),
    }
  })

  let cash = trade.cash
  // 股票股息
  for (const pos of trade.positions) {
    const def = symbolDefById(pos.symbolId)
    if (!def || def.kind !== 'stock' || def.dividendRate <= 0) continue
    const price = symbols.find((x) => x.id === pos.symbolId)?.price ?? pos.entry
    cash = round2(cash + positionNotional(pos, price) * def.dividendRate)
  }

  let next: TradeSession = {
    ...trade,
    symbols,
    cash,
    tick: trade.tick + 1,
    lastMessage: `第 ${trade.tick + 1} 棒行情已刷新。`,
  }

  if (shouldLiquidate(next)) {
    return liquidateTrade(next, '行情波动触发强制平仓。')
  }
  if (next.tick >= next.maxTicks) {
    return closeTradePositions(next, 'close', '棒数用尽，自动收盘。')
  }
  return next
}

export function shouldLiquidate(trade: TradeSession): boolean {
  for (const pos of trade.positions) {
    if (pos.leverage <= 1) continue
    const price = getSymbolPrice(trade, pos.symbolId)
    const notional = positionNotional(pos, price)
    if (notional < 1e-9) continue
    const equity = positionMargin(pos, price) + positionUpnl(pos, price)
    if (equity / notional < MAINTENANCE_MARGIN) return true
  }
  // 总权益过低
  if (trade.positions.some((p) => p.leverage > 1) && tradeEquity(trade) < trade.stakeIn * 0.15) {
    return true
  }
  return false
}

/** 市价平全部仓，现金合并；不把钱退给玩家（由 reduce 处理） */
export function closeTradePositions(
  trade: TradeSession,
  reason: TradeEndReason,
  message: string,
): TradeSession {
  let cash = trade.cash
  for (const pos of trade.positions) {
    const price = getSymbolPrice(trade, pos.symbolId)
    // 归还占用保证金 + 盈亏
    cash = round2(cash + positionMargin(pos, price) + positionUpnl(pos, price))
  }
  return {
    ...trade,
    cash: Math.max(0, cash),
    positions: [],
    ended: reason,
    lastMessage: message,
  }
}

export function liquidateTrade(trade: TradeSession, message: string): TradeSession {
  return closeTradePositions(trade, 'liquidate', message)
}

/**
 * 买入：amount = 花费的局内可用现金（作为保证金）
 * 名义 = amount * leverage；qty = 名义 / price
 */
export function buySymbol(
  trade: TradeSession,
  symbolId: string,
  amount: number,
  leverage?: Leverage,
): TradeSession | { error: string } {
  if (trade.ended) return { error: '本局已结束' }
  const def = symbolDefById(symbolId)
  if (!def) return { error: '未知标的' }
  const price = getSymbolPrice(trade, symbolId)
  if (price <= 0) return { error: '无报价' }
  const spend = round2(amount)
  if (spend < 0.05) return { error: '下单金额过小' }
  if (trade.cash + 1e-9 < spend) return { error: '局内现金不足' }

  let lev: Leverage = 1
  if (def.kind === 'crypto') {
    lev = leverage ?? trade.cryptoLeverage
    if (!def.allowedLeverage.includes(lev)) return { error: '杠杆不可用' }
  }

  const notional = spend * lev
  const qty = round4(notional / price)
  if (qty <= 0) return { error: '数量无效' }

  const existing = trade.positions.find((p) => p.symbolId === symbolId)
  let positions: ExchangePosition[]
  if (existing) {
    if (existing.leverage !== lev) return { error: '请先平仓再改杠杆' }
    const totalQty = existing.qty + qty
    const entry = round4((existing.entry * existing.qty + price * qty) / totalQty)
    positions = trade.positions.map((p) =>
      p.symbolId === symbolId ? { ...p, qty: round4(totalQty), entry } : p,
    )
  } else {
    positions = [...trade.positions, { symbolId, qty, entry: price, leverage: lev }]
  }

  return {
    ...trade,
    cash: round2(trade.cash - spend),
    positions,
    lastMessage: `买入 ${def.name} ${qty} 单位（${lev}×，保证金 ${spend} 万）。`,
  }
}

/** qtyRatio 1 = 全平 */
export function sellSymbol(
  trade: TradeSession,
  symbolId: string,
  qtyRatio = 1,
): TradeSession | { error: string } {
  if (trade.ended) return { error: '本局已结束' }
  const pos = trade.positions.find((p) => p.symbolId === symbolId)
  if (!pos || pos.qty <= 0) return { error: '无持仓' }
  const ratio = Math.min(1, Math.max(0.01, qtyRatio))
  const sellQty = round4(pos.qty * ratio)
  const price = getSymbolPrice(trade, symbolId)
  const frac = sellQty / pos.qty
  const marginBack = positionMargin(pos, price) * frac
  const upnl = positionUpnl(pos, price) * frac
  const cash = round2(trade.cash + marginBack + upnl)
  const remain = round4(pos.qty - sellQty)
  const positions =
    remain < 1e-6
      ? trade.positions.filter((p) => p.symbolId !== symbolId)
      : trade.positions.map((p) => (p.symbolId === symbolId ? { ...p, qty: remain } : p))
  const def = symbolDefById(symbolId)
  return {
    ...trade,
    cash,
    positions,
    lastMessage: `卖出 ${def?.name ?? symbolId} ${sellQty} 单位。`,
  }
}

export function setCryptoLeverage(
  trade: TradeSession,
  leverage: Leverage,
): TradeSession | { error: string } {
  if (trade.ended) return { error: '本局已结束' }
  if (![1, 2, 5].includes(leverage)) return { error: '杠杆无效' }
  const hasCryptoPos = trade.positions.some((p) => {
    const d = symbolDefById(p.symbolId)
    return d?.kind === 'crypto'
  })
  if (hasCryptoPos) return { error: '请先平掉币圈仓位再改杠杆' }
  return {
    ...trade,
    cryptoLeverage: leverage,
    lastMessage: `币圈默认杠杆设为 ${leverage}×。`,
  }
}
