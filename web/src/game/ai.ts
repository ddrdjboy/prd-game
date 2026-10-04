import {
  DATE_VENUES,
  dateableRelations,
  venueUnlockedFor,
} from './dating'
import { EVENTS, pickEventChoice } from './events'
import { VACANT_COST, VACANT_HIRE_EXTRA, SHOP_ITEMS, investOffersFor } from './location'
import { OFFICE_POACH_COST, OFFICE_RECOMMEND_COST, poachableTargets } from './office'
import { EXCHANGE_MAX_TRADE_SESSIONS, EXCHANGE_STAKES } from './exchange'
import { VACANT_SHOP_TAGS } from './skills'
import { shopCashflow } from './finance'
import { upgradeCostFor } from './shopCatalog'
import { canAssignToShop, eligibleManagers } from './shopStaff'
import { visitAiWouldPoach } from './visitShopReduce'
import type { GameState, PendingLocation, PlayerState } from './types'

export type AiLocationPick =
  | { type: 'skip' }
  | { type: 'buyVacant'; relationId: string }
  | { type: 'buyItem'; itemId: string }
  | { type: 'poach' }
  | { type: 'recommend' }
  | { type: 'upgrade'; shopId: string }
  | { type: 'rebind'; shopId: string; relationId: string }
  | { type: 'addStaff'; shopId: string; relationId: string }
  | { type: 'gamble'; bet: number }
  | { type: 'parkRest' }
  | { type: 'parkChat'; relationId: string }
  | { type: 'buyInvest'; offerId: string }

function weakestOp(p: PlayerState): string | null {
  if (!p.relations.length) return null
  return [...p.relations].sort((a, b) => a.affinity - b.affinity)[0].id
}

function skillMatchScore(player: PlayerState, relationId: string, tags: string[]): number {
  const r = player.relations.find((x) => x.id === relationId)
  if (!r) return 0
  return r.skills.filter((s) => tags.includes(s)).length * 10 + Math.max(0, r.affinity)
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
        if (player.cash + 1e-9 >= OFFICE_RECOMMEND_COST) return { type: 'recommend' }
        return { type: 'skip' }
      }
      if (style === 'aggressive') {
        if (canPoach) return { type: 'poach' }
        if (player.cash + 1e-9 >= OFFICE_RECOMMEND_COST) return { type: 'recommend' }
        return { type: 'skip' }
      }
      if (canPoach && Math.floor(player.cash * 100) % 4 === 0) return { type: 'poach' }
      if (player.cash + 1e-9 >= OFFICE_RECOMMEND_COST) return { type: 'recommend' }
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
          .sort((a, b) => b.affinity - a.affinity)[0]
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
    case 'park': {
      if (style === 'social') {
        const id = weakestOp(player)
        if (id) return { type: 'parkChat', relationId: id }
      }
      return { type: 'parkRest' }
    }
    case 'invest': {
      const offers = investOffersFor(player.track)
      const pick = offers.find((o) => player.cash + 1e-9 >= o.cost)
      if (pick && (style === 'aggressive' || player.cash > pick.cost * 2)) {
        return { type: 'buyInvest', offerId: pick.id }
      }
      return { type: 'skip' }
    }
    case 'casino':
      return { type: 'gamble', bet: 0 }
    default:
      return { type: 'skip' }
  }
}

/** 该玩家当前弹框是否会被自动代选（电脑始终；人类仅全自动） */
function willAutoPickDialog(
  state: GameState,
  player: PlayerState | undefined,
): player is PlayerState {
  if (!player) return false
  if (!player.isHuman) return true
  return state.autoEnabled && state.autoChoiceMode === 'auto'
}

export function locationPickKey(pick: AiLocationPick): string {
  switch (pick.type) {
    case 'skip':
      return 'location:skip'
    case 'buyVacant':
      return `location:vacant:${pick.relationId}`
    case 'buyItem':
      return `location:item:${pick.itemId}`
    case 'poach':
      return 'location:poach'
    case 'recommend':
      return 'location:recommend'
    case 'upgrade':
      return `location:upgrade:${pick.shopId}`
    case 'rebind':
      return `location:rebind:${pick.shopId}:${pick.relationId}`
    case 'addStaff':
      return `location:staff:${pick.shopId}:${pick.relationId}`
    case 'parkRest':
      return 'location:park-rest'
    case 'parkChat':
      return `location:park-chat:${pick.relationId}`
    case 'buyInvest':
      return `location:invest:${pick.offerId}`
    case 'gamble':
      return 'location:casino'
  }
}

/**
 * 自动代选即将点的按钮键（与 autoStep 同一套选择）。
 * 覆盖事件 / 约会 / 决策 / 落点；半自动人类返回 null。
 */
export function previewAutoDialogPick(state: GameState): string | null {
  if (state.phase !== 'playing') return null

  if (state.pendingDecision) {
    const d = state.pendingDecision
    const owner = state.players.find((p) => p.id === d.playerId)
    if (!willAutoPickDialog(state, owner)) return null
    if (d.type === 'enterFreeLife') return 'decision:enterFreeLife'
    if (d.type === 'marriage') return 'decision:marriage-accept'
    if (d.type === 'bigSpend') {
      return owner.aiStyle === 'aggressive' ? 'decision:bigSpend-accept' : 'decision:bigSpend-decline'
    }
    if (d.type === 'poach') return 'decision:poach-keep'
    if (d.type === 'bankrupt') return 'decision:bankrupt'
    return null
  }

  if (state.pendingEvent) {
    const p = state.players.find((x) => x.id === state.pendingEvent!.playerId)
    if (!willAutoPickDialog(state, p)) return null
    const event = EVENTS.find((e) => e.id === state.pendingEvent!.eventId)
    if (!event) return 'event:accept'
    return `event:${pickEventChoice(event, p)}`
  }

  if (state.pendingDate) {
    const pd = state.pendingDate
    const player = state.players.find((p) => p.id === pd.playerId)
    if (!willAutoPickDialog(state, player)) return null
    if (pd.step === 'pickPartner') {
      const list = dateableRelations(player)
      if (!list.length) return 'date:cancel'
      const best = [...list].sort((a, b) => b.affinity - a.affinity)[0]
      return `date-partner:${best.id}`
    }
    const partner = player.relations.find((r) => r.id === pd.relationId)
    const affordable = DATE_VENUES.filter(
      (v) => player.cash + 1e-9 >= v.cost && (!partner || venueUnlockedFor(v, partner)),
    )
    if (!affordable.length || !pd.relationId) return 'date:cancel'
    const venue = [...affordable].sort((a, b) => b.cost - a.cost)[0]
    return `date-venue:${venue.id}`
  }

  if (state.pendingVisitShop) {
    const v = state.pendingVisitShop
    const player = state.players.find((p) => p.id === v.playerId)
    if (!willAutoPickDialog(state, player)) return null
    if (v.step === 'pay') {
      return player.cash + 1e-9 < v.entryFee ? 'visit:leave' : 'visit:pay'
    }
    if (v.step === 'talkManager') return 'visit:talk'
    if (v.step === 'pickStaff') return 'visit:staff'
    if (v.step === 'gift') return 'visit:skip-gift'
    if (v.step === 'poach') {
      if (v.lastPoachOk != null) return 'visit:leave'
      return visitAiWouldPoach(state) ? 'visit:poach' : 'visit:skip-poach'
    }
    return 'visit:leave'
  }

  if (state.pendingCasino) {
    const c = state.pendingCasino
    const player = state.players.find((p) => p.id === c.playerId)
    if (!willAutoPickDialog(state, player)) return null
    const style = player.aiStyle ?? 'steady'
    const maxHands = style === 'aggressive' ? 2 : style === 'social' ? 1 : 0
    if (maxHands === 0 || c.handsPlayed >= maxHands || player.cash + 1e-9 < 0.2) {
      return 'location:casino-leave'
    }
    if (c.screen === 'lobby') {
      return style === 'social' ? 'location:casino-open:baccarat' : 'location:casino-open:dice'
    }
    // 桌内自动代打没有统一「下注」键，交给 App 计时 AUTO_STEP，避免错闪离开
    return null
  }

  if (state.pendingExchange || state.pendingLocation?.spaceKind === 'invest') {
    const pid = state.pendingExchange?.playerId ?? state.pendingLocation?.playerId
    const player = state.players.find((p) => p.id === pid)
    const loc = state.pendingLocation
    if (!willAutoPickDialog(state, player) || !loc) return null
    const ex = state.pendingExchange
    const style = player.aiStyle ?? 'steady'
    if (!ex || ex.screen === 'lobby') {
      if ((ex?.tradeSessionsPlayed ?? 0) < EXCHANGE_MAX_TRADE_SESSIONS) {
        const stake =
          style === 'aggressive' && player.cash >= 1 ? EXCHANGE_STAKES[1] : EXCHANGE_STAKES[0]
        const willing =
          style === 'steady' ? player.cash + 1e-9 >= stake * 2.5 : player.cash + 1e-9 >= stake
        if (willing) return `location:exchange-trade:${stake}`
      }
      const hasTargets = false
      const pick = pickAiLocationAction(player, loc, hasTargets)
      if (pick.type === 'buyInvest') return locationPickKey(pick)
      return 'location:exchange-leave'
    }
    if (ex.screen === 'funds') {
      const pick = pickAiLocationAction(player, loc, false)
      if (pick.type === 'buyInvest') return locationPickKey(pick)
      return 'location:exchange-leave'
    }
    return 'location:exchange-leave'
  }

  if (state.pendingLocation) {
    const loc = state.pendingLocation
    const player = state.players.find((p) => p.id === loc.playerId)
    if (!willAutoPickDialog(state, player)) return null
    if (loc.spaceKind === 'casino') {
      const style = player.aiStyle ?? 'steady'
      const maxHands = style === 'aggressive' ? 2 : style === 'social' ? 1 : 0
      if (maxHands === 0 || player.cash + 1e-9 < 0.2) return 'location:casino-leave'
      return style === 'social' ? 'location:casino-open:baccarat' : 'location:casino-open:dice'
    }
    const hasTargets = poachableTargets(loc.playerId, state.players).length > 0
    return locationPickKey(pickAiLocationAction(player, loc, hasTargets))
  }

  return null
}

/** @deprecated 用 previewAutoDialogPick */
export function previewAiDialogPick(state: GameState): string | null {
  return previewAutoDialogPick(state)
}
