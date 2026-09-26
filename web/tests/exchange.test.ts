import { describe, it, expect } from 'vitest'
import {
  buySymbol,
  closeTradePositions,
  createTradeSession,
  MAINTENANCE_MARGIN,
  sellSymbol,
  shouldLiquidate,
  tickTrade,
  tradeEquity,
} from '../src/game/exchange'

describe('exchange engine', () => {
  it('creates session with symbols and stake cash', () => {
    const t = createTradeSession(1, () => 0.5)
    expect(t.cash).toBe(1)
    expect(t.symbols.length).toBe(5)
    expect(t.maxTicks).toBe(8)
  })

  it('buy then sell returns roughly stake (spot)', () => {
    let t = createTradeSession(1, () => 0.5)
    const price = t.symbols.find((s) => s.id === 'bluechip')!.price
    const res = buySymbol(t, 'bluechip', 0.4)
    expect('error' in res).toBe(false)
    if ('error' in res) return
    t = res
    expect(t.cash).toBeCloseTo(0.6, 5)
    expect(t.positions[0].leverage).toBe(1)
    expect(t.positions[0].qty).toBeCloseTo(0.4 / price, 4)

    const sold = sellSymbol(t, 'bluechip', 1)
    expect('error' in sold).toBe(false)
    if ('error' in sold) return
    expect(sold.cash).toBeCloseTo(1, 1)
    expect(sold.positions.length).toBe(0)
  })

  it('leveraged buy uses margin as spend', () => {
    let t = createTradeSession(1, () => 0.5)
    t = { ...t, cryptoLeverage: 5 }
    const res = buySymbol(t, 'btc', 0.2, 5)
    expect('error' in res).toBe(false)
    if ('error' in res) return
    expect(res.cash).toBeCloseTo(0.8, 5)
    expect(res.positions[0].leverage).toBe(5)
    const price = res.symbols.find((s) => s.id === 'btc')!.price
    expect(res.positions[0].qty * price).toBeCloseTo(1.0, 4)
  })

  it('tick changes prices and can auto-close at max ticks', () => {
    let t = createTradeSession(0.5, () => 0.5)
    t = { ...t, maxTicks: 2 }
    let rng = 0
    const next = () => {
      rng += 0.17
      return rng % 1
    }
    t = tickTrade(t, next)
    expect(t.tick).toBe(1)
    expect(t.ended).toBeNull()
    t = tickTrade(t, next)
    expect(t.ended).toBe('close')
  })

  it('detects liquidation when leveraged position crashes', () => {
    let t = createTradeSession(1, () => 0.5)
    const bought = buySymbol(t, 'alt', 0.5, 5)
    expect('error' in bought).toBe(false)
    if ('error' in bought) return
    t = bought
    // crash price
    t = {
      ...t,
      symbols: t.symbols.map((s) =>
        s.id === 'alt' ? { ...s, price: s.price * 0.1, lastChange: -0.9 } : s,
      ),
    }
    expect(shouldLiquidate(t)).toBe(true)
    const closed = closeTradePositions(t, 'liquidate', 'boom')
    expect(closed.ended).toBe('liquidate')
    expect(closed.positions.length).toBe(0)
    expect(tradeEquity(closed)).toBe(closed.cash)
  })

  it('maintenance margin constant is 0.2', () => {
    expect(MAINTENANCE_MARGIN).toBe(0.2)
  })
})
