import { VACANT_COST, VACANT_HIRE_EXTRA, CASINO_BETS, SHOP_ITEMS, investOffersFor } from './location'
import { OFFICE_POACH_COST, OFFICE_RECOMMEND_COST } from './office'
import { VACANT_SHOP_TAGS } from './skills'
import { shopCashflow } from './finance'
import { upgradeCostFor } from './shopCatalog'
import { canAssignToShop, eligibleManagers } from './shopStaff'
import type { PendingLocation, PlayerState } from './types'

export type AiLocationPick =
  | { type: 'skip' }
  | { type: 'buyVacant'; relationId: string }
  | { type: 'buyItem'; itemId: string }
  | { type: 'poach' }
  | { type: 'recommend'; kind: 'network' | 'romance' }
  | { type: 'upgrade'; shopId: string }
  | { type: 'rebind'; shopId: string; relationId: string }
  | { type: 'addStaff'; shopId: string; relationId: string }
  | { type: 'gamble'; bet: number }
  | { type: 'parkRest' }
  | { type: 'parkChat'; relationId: string }
  | { type: 'buyInvest'; offerId: string }

function weakestOp(p: PlayerState): string | null {
  const ops = p.relations.filter((r) => r.status !== 'broken')
  if (!ops.length) return null
  return [...ops].sort((a, b) => a.score - b.score)[0].id
}

function skillMatchScore(player: PlayerState, relationId: string, tags: string[]): number {
  const r = player.relations.find((x) => x.id === relationId)
  if (!r) return 0
  return r.skills.filter((s) => tags.includes(s)).length * 10 + r.score
}

/** @param hasPoachTargets 是否存在可挖对象（由调用方算好） */
export function pickAiLocationAction(
  player: PlayerState,
  loc: PendingLocation,
  hasPoachTargets: boolean,
): AiLocationPick {
  const style = player.aiStyle ?? 'steady'

  switch (loc.spaceKind) {
    case 'vacant': {
      const hireCost = VACANT_COST + VACANT_HIRE_EXTRA
      const free = eligibleManagers(player, VACANT_SHOP_TAGS.requiredSkills)
      const ranked = [...free].sort(
        (a, b) =>
          skillMatchScore(player, b.id, VACANT_SHOP_TAGS.skillTags) -
          skillMatchScore(player, a.id, VACANT_SHOP_TAGS.skillTags),
      )
      const op = ranked[0]?.id ?? null
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
      const shop = player.shops[0]
      if (style === 'social') {
        const free = player.relations.filter((r) => canAssignToShop(player, r.id))
        const best = [...free].sort(
          (a, b) =>
            skillMatchScore(player, b.id, shop.skillTags) -
            skillMatchScore(player, a.id, shop.skillTags),
        )[0]
        if (best && shop.staffIds.length < shop.level * 3) {
          return { type: 'addStaff', shopId: shop.id, relationId: best.id }
        }
        const betterManager = shop.staffIds
          .map((id) => player.relations.find((r) => r.id === id))
          .filter((r): r is NonNullable<typeof r> => Boolean(r))
          .sort((a, b) => b.score - a.score)[0]
        if (betterManager && betterManager.id !== shop.managerId) {
          return { type: 'rebind', shopId: shop.id, relationId: betterManager.id }
        }
      }
      const net = shopCashflow(shop, player.relations)
      const cost = upgradeCostFor(shop)
      if (net > 0 && player.cash + 1e-9 >= cost * (style === 'aggressive' ? 1 : 1.5)) {
        return { type: 'upgrade', shopId: shop.id }
      }
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
