import { createRng } from './rng'
import { poachSuccessChance } from './office'
import { POACH_COOLDOWN_TURNS } from './config'
import {
  createVisitSession,
  findShopAt,
  visitGiftById,
  visitPoachChance,
  VISIT_MANAGER_RAPPORT,
  VISIT_POACH_FEE,
  VISIT_STAFF_RAPPORT,
  type PendingVisitShop,
} from './visitShop'
import type { GameState, PlayerState, Shop } from './types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function pushLog(state: GameState, text: string): GameState {
  return {
    ...state,
    logs: [...state.logs.slice(-80), { id: `visit-${state.logs.length}`, text }],
  }
}

function updatePlayer(
  state: GameState,
  playerId: string,
  fn: (p: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? fn(p) : p)),
  }
}

type TransferFn = (
  state: GameState,
  fromId: string,
  toId: string,
  relationId: string,
) => GameState

function clearVisit(state: GameState): GameState {
  return {
    ...state,
    pendingLocation: null,
    pendingVisitShop: null,
  }
}

function getVisitShop(
  state: GameState,
  visit: PendingVisitShop,
): { owner: PlayerState; shop: Shop } | null {
  const owner = state.players.find((p) => p.id === visit.ownerId)
  const shop = owner?.shops.find((s) => s.id === visit.shopId)
  if (!owner || !shop) return null
  return { owner, shop }
}

export function visitEnter(state: GameState): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'vacant') return state
  const owned = findShopAt(state.players, loc.track, loc.spaceIndex)
  if (!owned) return { ...state, pendingVisitShop: null }
  if (owned.ownerId === loc.playerId) {
    const visitor = state.players.find((p) => p.id === loc.playerId)
    return pushLog(
      { ...state, pendingLocation: null, pendingVisitShop: null },
      `${visitor?.name ?? '玩家'} 回到自己的店「${owned.shop.name}」。`,
    )
  }
  return {
    ...state,
    pendingVisitShop: createVisitSession(loc.playerId, owned.ownerId, owned.shop),
  }
}

export function visitPay(state: GameState): GameState {
  const v = state.pendingVisitShop
  if (!v || v.step !== 'pay' || v.paid) return state
  const visitor = state.players.find((p) => p.id === v.playerId)
  const ctx = getVisitShop(state, v)
  if (!visitor || !ctx) return clearVisit(state)
  if (visitor.cash + 1e-9 < v.entryFee) {
    return pushLog(state, `${visitor.name} 现金不足，付不起探店费（需 ${v.entryFee} 万）。`)
  }
  let s = updatePlayer(state, v.playerId, (p) => ({
    ...p,
    cash: round2(p.cash - v.entryFee),
  }))
  s = updatePlayer(s, v.ownerId, (p) => ({
    ...p,
    cash: round2(p.cash + v.entryFee),
  }))
  const hasManager = Boolean(ctx.shop.managerId && ctx.shop.staffIds.includes(ctx.shop.managerId))
  const next: PendingVisitShop = {
    ...v,
    paid: true,
    step: hasManager ? 'talkManager' : 'pickStaff',
  }
  s = {
    ...s,
    pendingVisitShop: next,
  }
  return pushLog(
    s,
    `${visitor.name} 花 ${v.entryFee} 万探访「${ctx.shop.name}」，钱进了 ${ctx.owner.name} 的口袋。`,
  )
}

export function visitTalk(state: GameState): GameState {
  const v = state.pendingVisitShop
  if (!v || v.step !== 'talkManager' || !v.paid) return state
  const ctx = getVisitShop(state, v)
  const visitor = state.players.find((p) => p.id === v.playerId)
  if (!ctx || !visitor) return clearVisit(state)
  const manager = ctx.owner.relations.find((r) => r.id === ctx.shop.managerId)
  const next: PendingVisitShop = {
    ...v,
    step: 'pickStaff',
    rapport: v.rapport + VISIT_MANAGER_RAPPORT,
  }
  return pushLog(
    { ...state, pendingVisitShop: next },
    `${visitor.name} 与店长「${manager?.name ?? '店长'}」闲聊，印象分 +${VISIT_MANAGER_RAPPORT}。`,
  )
}

export function visitPickStaff(state: GameState, relationId: string): GameState {
  const v = state.pendingVisitShop
  if (!v || v.step !== 'pickStaff' || !v.paid) return state
  const visitor = state.players.find((p) => p.id === v.playerId)
  const ctx = getVisitShop(state, v)
  if (!visitor || !ctx) return clearVisit(state)
  if (!ctx.shop.staffIds.includes(relationId)) return state
  const rel = ctx.owner.relations.find((r) => r.id === relationId)
  if (!rel || rel.status === 'broken') return state
  if (visitor.cash + 1e-9 < v.tipFee) {
    return pushLog(state, `${visitor.name} 现金不足，付不起服务小费（需 ${v.tipFee} 万）。`)
  }
  let s = updatePlayer(state, v.playerId, (p) => ({
    ...p,
    cash: round2(p.cash - v.tipFee),
  }))
  s = updatePlayer(s, v.ownerId, (p) => ({
    ...p,
    cash: round2(p.cash + v.tipFee),
  }))
  const next: PendingVisitShop = {
    ...v,
    staffId: relationId,
    step: 'gift',
    rapport: v.rapport + VISIT_STAFF_RAPPORT,
  }
  return pushLog(
    { ...s, pendingVisitShop: next },
    `${visitor.name} 点了「${rel.name}」的服务（小费 ${v.tipFee} 万），印象分 +${VISIT_STAFF_RAPPORT}。`,
  )
}

export function visitGift(state: GameState, giftId: string): GameState {
  const v = state.pendingVisitShop
  if (!v || v.step !== 'gift' || !v.paid || !v.staffId) return state
  const gift = visitGiftById(giftId)
  if (!gift) return state
  const visitor = state.players.find((p) => p.id === v.playerId)
  const ctx = getVisitShop(state, v)
  if (!visitor || !ctx) return clearVisit(state)
  if (visitor.cash + 1e-9 < gift.cost) {
    return pushLog(state, `${visitor.name} 买不起「${gift.name}」。`)
  }
  const rel = ctx.owner.relations.find((r) => r.id === v.staffId)
  let s = updatePlayer(state, v.playerId, (p) => ({
    ...p,
    cash: round2(p.cash - gift.cost),
  }))
  s = updatePlayer(s, v.ownerId, (p) => ({
    ...p,
    cash: round2(p.cash + gift.cost),
  }))
  const next: PendingVisitShop = {
    ...v,
    step: 'poach',
    rapport: v.rapport + gift.rapport,
  }
  return pushLog(
    { ...s, pendingVisitShop: next },
    `${visitor.name} 送给「${rel?.name ?? '店员'}」${gift.name}（${gift.cost} 万），印象分 +${gift.rapport}。`,
  )
}

export function visitSkipGift(state: GameState): GameState {
  const v = state.pendingVisitShop
  if (!v || v.step !== 'gift') return state
  return {
    ...state,
    pendingVisitShop: { ...v, step: 'poach' },
  }
}

export function visitPoachSpin(
  state: GameState,
  transferRelation: TransferFn,
): GameState {
  const v = state.pendingVisitShop
  if (!v || v.step !== 'poach' || !v.paid || !v.staffId) return state
  const visitor = state.players.find((p) => p.id === v.playerId)
  const ctx = getVisitShop(state, v)
  if (!visitor || !ctx) return clearVisit(state)
  const rel = ctx.owner.relations.find((r) => r.id === v.staffId)
  if (!rel || rel.status === 'broken' || rel.locked) {
    return pushLog(
      { ...state, pendingVisitShop: { ...v, lastPoachOk: false } },
      '该对象无法挖角。',
    )
  }
  if (visitor.poachCooldown > 0) {
    return pushLog(state, `挖角冷却中（还剩 ${visitor.poachCooldown} 回合）。`)
  }
  if (visitor.cash + 1e-9 < VISIT_POACH_FEE) {
    return pushLog(state, `${visitor.name} 现金不足，付不起挖角手续费（需 ${VISIT_POACH_FEE} 万）。`)
  }

  const rng = createRng(state.rngState)
  const reels: [number, number, number] = [
    1 + Math.floor(rng.next() * 9),
    1 + Math.floor(rng.next() * 9),
    1 + Math.floor(rng.next() * 9),
  ]
  const chance = visitPoachChance(rel.score, v.rapport, reels, poachSuccessChance)
  const ok = rng.next() < chance

  let s = updatePlayer(state, v.playerId, (p) => ({
    ...p,
    cash: round2(p.cash - VISIT_POACH_FEE),
    poachCooldown: POACH_COOLDOWN_TURNS,
  }))
  s = {
    ...s,
    rngState: rng.state(),
    pendingVisitShop: {
      ...v,
      lastReels: reels,
      lastPoachOk: ok,
    },
  }
  s = pushLog(
    s,
    `${visitor.name} 拉霸 [${reels.join('-')}] 尝试挖角「${rel.name}」（成功率约 ${Math.round(chance * 100)}%）。`,
  )
  if (!ok) {
    return pushLog(s, `${visitor.name} 挖角失败，「${rel.name}」仍留在「${ctx.shop.name}」。`)
  }
  s = transferRelation(s, v.ownerId, v.playerId, v.staffId)
  return s
}

export function visitSkipPoach(state: GameState): GameState {
  const v = state.pendingVisitShop
  if (!v || v.step !== 'poach') return state
  const visitor = state.players.find((p) => p.id === v.playerId)
  return pushLog(clearVisit(state), `${visitor?.name ?? '访客'} 结束了探店，没有挖角。`)
}

export function visitLeave(state: GameState): GameState {
  const v = state.pendingVisitShop
  const visitor = state.players.find((p) => p.id === (v?.playerId ?? ''))
  if (!v) {
    return clearVisit(state)
  }
  if (v.step === 'poach' && v.lastPoachOk != null) {
    return pushLog(clearVisit(state), `${visitor?.name ?? '访客'} 离开了店铺。`)
  }
  if (!v.paid) {
    return pushLog(clearVisit(state), `${visitor?.name ?? '访客'} 看了看就走了，没消费。`)
  }
  return pushLog(clearVisit(state), `${visitor?.name ?? '访客'} 结束了探店。`)
}

/** AI：付钱 → 随机店员 → 跳过送礼 → 偶发挖角 → 离开 */
export function visitAiStep(
  state: GameState,
  transferRelation: TransferFn,
): GameState {
  let s = state
  const rng = createRng(s.rngState)
  const roll = () => rng.next()
  if (!s.pendingVisitShop) return s
  let visitor = s.players.find((p) => p.id === s.pendingVisitShop!.playerId)
  if (!visitor) return clearVisit(s)

  if (s.pendingVisitShop.step === 'pay') {
    if (visitor.cash + 1e-9 < s.pendingVisitShop.entryFee) return visitLeave(s)
    s = visitPay(s)
  }
  s = { ...s, rngState: rng.state() }
  if (!s.pendingVisitShop) return s

  if (s.pendingVisitShop.step === 'talkManager') {
    s = visitTalk(s)
    if (!s.pendingVisitShop) return s
  }

  const visit = s.pendingVisitShop
  visitor = s.players.find((p) => p.id === visit.playerId)!
  if (visit.step === 'pickStaff') {
    const ctx = getVisitShop(s, visit)
    const staff =
      ctx?.shop.staffIds
        .map((id) => ctx.owner.relations.find((r) => r.id === id))
        .filter((r): r is NonNullable<typeof r> => r != null && r.status !== 'broken') ?? []
    if (!staff.length || visitor.cash + 1e-9 < visit.tipFee) {
      return visitLeave(s)
    }
    const pick = staff[Math.floor(roll() * staff.length)]!
    s = visitPickStaff(s, pick.id)
    if (!s.pendingVisitShop) return s
  }

  if (s.pendingVisitShop.step === 'gift') {
    s = visitSkipGift(s)
    if (!s.pendingVisitShop) return s
  }

  const visit2 = s.pendingVisitShop
  visitor = s.players.find((p) => p.id === visit2.playerId)!
  if (visit2.step === 'poach') {
    const style = visitor.aiStyle ?? 'steady'
    const tryPoach =
      style === 'social' ? roll() < 0.45 : style === 'aggressive' ? roll() < 0.35 : roll() < 0.15
    if (
      tryPoach &&
      visit2.staffId &&
      visitor.poachCooldown <= 0 &&
      visitor.cash + 1e-9 >= VISIT_POACH_FEE
    ) {
      s = visitPoachSpin(s, transferRelation)
    }
    s = { ...s, rngState: rng.state() }
    return visitLeave(s)
  }

  return visitLeave({ ...s, rngState: rng.state() })
}
