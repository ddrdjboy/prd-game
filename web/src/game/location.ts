import type { ShopItem } from './types'

export const VACANT_COST = 0.8
export const VACANT_SHOP_CASHFLOW = 0.22

/** 赌场可选赌注（万） */
export const CASINO_BETS = [0.2, 0.5, 1.0] as const

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'gift', name: '精致礼物', cost: 0.2, desc: '提升恋人感情 +12' },
  { id: 'wine', name: '好酒礼盒', cost: 0.18, desc: '提升人脉信任 +12' },
  { id: 'course', name: '短期课程', cost: 0.35, desc: '工资 +0.08' },
  { id: 'gadget', name: '效率神器', cost: 0.25, desc: '现金小回血 +0.1（净花费 0.15）' },
]

export function shopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id)
}
