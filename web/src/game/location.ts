import type { ShopItem } from './types'

export const VACANT_COST = 0.55
export const VACANT_SHOP_CASHFLOW = 0.22
/** 空地无关系人时，雇临时店员的额外花费 */
export const VACANT_HIRE_EXTRA = 0.15
export const PARK_REST_CASH = 0.08
export const PARK_CHAT_BOOST = 5
export const INVEST_SELL_RATIO = 0.9

/** 赌场可选赌注（万） */
export const CASINO_BETS = [0.2, 0.5, 1.0] as const

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'gift', name: '精致礼物', cost: 0.2, desc: '提升恋人感情 +12' },
  { id: 'wine', name: '好酒礼盒', cost: 0.18, desc: '提升人脉信任 +12' },
  { id: 'course', name: '短期课程', cost: 0.35, desc: '工资 +0.08' },
  { id: 'gadget', name: '效率神器', cost: 0.25, desc: '现金小回血 +0.1（净花费 0.15）' },
]

export interface InvestOffer {
  id: string
  name: string
  cost: number
  cashflow: number
  /** 仅投资人圈可见 */
  investorOnly?: boolean
}

export const INVEST_OFFERS: InvestOffer[] = [
  { id: 'bond', name: '稳健债基', cost: 0.8, cashflow: 0.06 },
  { id: 'etf', name: '宽基 ETF', cost: 1.2, cashflow: 0.1 },
  { id: 'equity', name: '成长份额', cost: 2.0, cashflow: 0.18 },
  { id: 'pe', name: '私募份额', cost: 2.5, cashflow: 0.28, investorOnly: true },
  { id: 'reit', name: '商业地产REIT', cost: 3.2, cashflow: 0.35, investorOnly: true },
]

export function investOffersFor(track: 'worker' | 'investor'): InvestOffer[] {
  return INVEST_OFFERS.filter((o) => !o.investorOnly || track === 'investor')
}

export function shopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id)
}

export function investOfferById(id: string): InvestOffer | undefined {
  return INVEST_OFFERS.find((i) => i.id === id)
}
