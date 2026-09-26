import type { PlayerState, Shop, Track } from './types'

export type VisitStep = 'pay' | 'talkManager' | 'pickStaff' | 'gift' | 'poach'

export interface VisitGift {
  id: string
  name: string
  cost: number
  rapport: number
}

export interface PendingVisitShop {
  playerId: string
  ownerId: string
  shopId: string
  step: VisitStep
  entryFee: number
  tipFee: number
  paid: boolean
  /** 选中的服务店员（店主关系 id） */
  staffId: string | null
  /** 本会话累计好感，抬高挖角成功率 */
  rapport: number
  lastReels: [number, number, number] | null
  lastPoachOk: boolean | null
}

export const VISIT_TIP_FEE = 0.12
export const VISIT_POACH_FEE = 0.2
export const VISIT_MANAGER_RAPPORT = 6
export const VISIT_STAFF_RAPPORT = 8

export const VISIT_GIFTS: VisitGift[] = [
  { id: 'snack', name: '小点心', cost: 0.08, rapport: 5 },
  { id: 'nice', name: '心意礼', cost: 0.18, rapport: 10 },
  { id: 'luxury', name: '奢华礼', cost: 0.35, rapport: 18 },
]

export function visitGiftById(id: string): VisitGift | undefined {
  return VISIT_GIFTS.find((g) => g.id === id)
}

export function visitEntryFee(shop: Shop): number {
  const raw = shop.baseRevenue * 0.4
  return Math.round(Math.min(0.5, Math.max(0.08, raw)) * 100) / 100
}

export type OwnedShopRef = {
  ownerId: string
  shop: Shop
}

/** 从历史 id `lot-{track}-{index}-*` 推断格位 */
export function inferBoardFromShopId(
  id: string,
): { boardTrack: Track; boardIndex: number } | null {
  const m = /^lot-(worker|investor)-(\d+)-/.exec(id)
  if (!m) return null
  return { boardTrack: m[1] as Track, boardIndex: Number(m[2]) }
}

export function shopBoardKey(track: Track, index: number): string {
  return `${track}:${index}`
}

export function findShopAt(
  players: PlayerState[],
  track: Track,
  index: number,
): OwnedShopRef | null {
  for (const p of players) {
    for (const shop of p.shops) {
      const t = shop.boardTrack
      const i = shop.boardIndex
      if (t == null || i == null) {
        const inferred = inferBoardFromShopId(shop.id)
        if (!inferred) continue
        if (inferred.boardTrack === track && inferred.boardIndex === index) {
          return { ownerId: p.id, shop }
        }
        continue
      }
      if (t === track && i === index) return { ownerId: p.id, shop }
    }
  }
  return null
}

export function createVisitSession(
  visitorId: string,
  ownerId: string,
  shop: Shop,
): PendingVisitShop {
  return {
    playerId: visitorId,
    ownerId,
    shopId: shop.id,
    step: 'pay',
    entryFee: visitEntryFee(shop),
    tipFee: VISIT_TIP_FEE,
    paid: false,
    staffId: null,
    rapport: 0,
    lastReels: null,
    lastPoachOk: null,
  }
}

/** 拉霸对挖角成功率的修正（独立三轮，不走路） */
export function visitSlotChanceBonus(reels: [number, number, number]): number {
  const [a, b, c] = reels
  if (a === 7 && b === 7 && c === 7) return 0.45
  if (a === b && b === c) return 0.2
  if (a === b || b === c || a === c) return 0.1
  const sum = a + b + c
  if (sum >= 24) return 0.08
  if (sum <= 9) return -0.1
  return 0
}

export function visitPoachChance(
  relationScore: number,
  rapport: number,
  reels: [number, number, number],
  baseChance: (score: number) => number,
): number {
  const raw =
    baseChance(relationScore) + rapport * 0.012 + visitSlotChanceBonus(reels)
  return Math.max(0.05, Math.min(0.95, raw))
}

export function occupiedShopLabel(
  ownerName: string,
  shop: Shop,
  typeLabel?: string,
): string {
  const kind = typeLabel ?? shop.name
  return `${ownerName}的店·${kind}`
}
