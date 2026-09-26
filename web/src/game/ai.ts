import { VACANT_COST, VACANT_HIRE_EXTRA, CASINO_BETS, SHOP_ITEMS, investOffersFor } from './location'
import { OFFICE_POACH_COST, OFFICE_RECOMMEND_COST } from './office'
import type { PendingLocation, PlayerState } from './types'

export type AiLocationPick =
  | { type: 'skip' }
  | { type: 'buyVacant'; relationId: string }
  | { type: 'buyItem'; itemId: string }
  | { type: 'poach' }
  | { type: 'recommend'; kind: 'network' | 'romance' }
  | { type: 'upgrade'; shopId: string }
  | { type: 'rebind'; shopId: string; relationId: string }
  | { type: 'gamble'; bet: number }
  | { type: 'parkRest' }
  | { type: 'parkChat'; relationId: string }
  | { type: 'buyInvest'; offerId: string }

function bestOp(p: PlayerState): string | null {
  const ops = p.relations.filter((r) => r.status !== 'broken')
  if (!ops.length) return null
  return [...ops].sort((a, b) => b.score - a.score)[0].id
}

function weakestOp(p: PlayerState): string | null {
  const ops = p.relations.filter((r) => r.status !== 'broken')
  if (!ops.length) return null
  return [...ops].sort((a, b) => a.score - b.score)[0].id
}

/** @param hasPoachTargets 是否存在可挖对象（由调用方算好） */
export function pickAiLocationAction(
  player: PlayerState,
  loc: PendingLocation,
  hasPoachTargets: boolean,
): AiLocationPick {
  const style = player.aiStyle ?? 'steady'
  const op = bestOp(player)

  switch (loc.spaceKind) {
    case 'vacant': {
      const hireCost = VACANT_COST + VACANT_HIRE_EXTRA
      if (style === 'steady') {
        if (op && player.cash + 1e-9 >= VACANT_COST * 2) return { type: 'buyVacant', relationId: op }
        return { type: 'skip' }
      }
      if (op && player.cash + 1e-9 >= VACANT_COST) return { type: 'buyVacant', relationId: op }
      if (player.cash + 1e-9 >= hireCost) return { type: 'buyVacant', relationId: '__hire__' }
      return { type: 'skip' }
    }
    case 'shop': {
      if (style === 'social') {
        const gift = SHOP_ITEMS.find((i) => i.id === 'gift' || i.id === 'wine')
        const pick =
          gift && player.cash >= gift.cost ? gift : SHOP_ITEMS.find((i) => player.cash >= i.cost)
        return pick ? { type: 'buyItem', itemId: pick.id } : { type: 'skip' }
      }
      if (style === 'steady') {
        const useful = SHOP_ITEMS.find(
          (i) => (i.id === 'course' || i.id === 'gadget') && player.cash >= i.cost,
        )
        return useful ? { type: 'buyItem', itemId: useful.id } : { type: 'skip' }
      }
      const any = SHOP_ITEMS.find((i) => player.cash >= i.cost)
      return any ? { type: 'buyItem', itemId: any.id } : { type: 'skip' }
    }
    case 'office': {
      const canPoach =
        hasPoachTargets && player.poachCooldown <= 0 && player.cash + 1e-9 >= OFFICE_POACH_COST
      if (style === 'social') {
        if (canPoach) return { type: 'poach' }
        if (player.cash + 1e-9 >= OFFICE_RECOMMEND_COST) return { type: 'recommend', kind: 'romance' }
        return { type: 'skip' }
      }
      if (style === 'aggressive') {
        if (canPoach) return { type: 'poach' }
        if (player.cash + 1e-9 >= OFFICE_RECOMMEND_COST) return { type: 'recommend', kind: 'network' }
        return { type: 'skip' }
      }
      if (canPoach && Math.floor(player.cash * 100) % 4 === 0) return { type: 'poach' }
      if (player.cash + 1e-9 >= OFFICE_RECOMMEND_COST) return { type: 'recommend', kind: 'network' }
      return { type: 'skip' }
    }
    case 'manage': {
      if (!player.shops.length) return { type: 'skip' }
      const top = bestOp(player)
      if (style === 'social' && top) {
        const mismatch = player.shops.find((s) => s.operatorRelationId !== top)
        if (mismatch) return { type: 'rebind', shopId: mismatch.id, relationId: top }
      }
      if (player.cash + 1e-9 >= 0.2) return { type: 'upgrade', shopId: player.shops[0].id }
      return { type: 'skip' }
    }
    case 'casino': {
      if (style === 'steady') return { type: 'skip' }
      if (style === 'social') {
        const bet = CASINO_BETS[0]
        return player.cash >= bet ? { type: 'gamble', bet } : { type: 'skip' }
      }
      const affordable = [...CASINO_BETS].reverse().find((b) => player.cash >= b)
      return affordable != null ? { type: 'gamble', bet: affordable } : { type: 'skip' }
    }
    case 'park': {
      const weak = weakestOp(player)
      if (weak) {
        const rel = player.relations.find((r) => r.id === weak)
        if (rel && rel.score < 55) return { type: 'parkChat', relationId: weak }
        if (style === 'social') return { type: 'parkChat', relationId: weak }
      }
      return { type: 'parkRest' }
    }
    case 'invest': {
      if (style === 'social') return { type: 'skip' }
      const discount = player.trait === 'investDiscount' ? 0.9 : 1
      const pool = investOffersFor(player.track)
      const offers =
        style === 'steady' ? pool.filter((o) => o.id === 'bond') : [...pool].reverse()
      const pick = offers.find((o) => player.cash + 1e-9 >= o.cost * discount)
      return pick ? { type: 'buyInvest', offerId: pick.id } : { type: 'skip' }
    }
    default:
      return { type: 'skip' }
  }
}
