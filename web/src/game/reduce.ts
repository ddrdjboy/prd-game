import { buildTrack, isPaydaySpace, move, spaceHasLocationAction } from './board'
import { ACTION_POINTS_PER_SEASON, BIG_SPEND_RATIO, POACH_COOLDOWN_TURNS, EARLY_AGE_MAX, EARLY_PAY_BONUS, INVESTOR_START_BONUS, SEASONS } from './config'
import { CAREERS } from './careers'
import { createGame } from './createGame'
import { pickAiLocationAction } from './ai'
import { EVENTS, canAffordChoice, choiceCashCost, pickEventChoice, type EventEffect } from './events'
import {
  DATE_VENUES,
  dateBoostFor,
  dateVenueById,
  dateableRelations,
  pickAiDate,
} from './dating'
import {
  OFFICE_POACH_COST,
  OFFICE_RECOMMEND_COST,
  OFFICE_DOWN_COST,
  OFFICE_UP_COST,
  adjustDelta,
  poachSuccessChance,
  poachableTargets,
} from './office'
import { VACANT_COST, VACANT_SHOP_CASHFLOW, VACANT_HIRE_EXTRA, shopItemById, investOfferById, PARK_REST_CASH, PARK_CHAT_BOOST, INVEST_SELL_RATIO } from './location'
import { resolveSlotEvent } from './slotEvents'
import { calcFinance, canPromote, rollShopSeason, round2 } from './finance'
import {
  casinoAiStep,
  casinoBaccaratBet,
  casinoBjBet,
  casinoBjDouble,
  casinoBjHit,
  casinoBjInsurance,
  casinoBjNext,
  casinoBjSplit,
  casinoBjStand,
  casinoDiceBet,
  casinoDiceRoll,
  casinoEnter,
  casinoLeave,
  casinoLobby,
  casinoOpen,
} from './casinoReduce'
import {
  visitAiStep,
  visitEnter,
  visitGift,
  visitLeave,
  visitPay,
  visitPickStaff,
  visitPoachSpin,
  visitSkipGift,
  visitSkipPoach,
  visitTalk,
} from './visitShopReduce'
import { findShopAt } from './visitShop'
import {
  exchangeAiStep,
  exchangeBuy,
  exchangeClose,
  exchangeEnter,
  exchangeLeave,
  exchangeLobby,
  exchangeOpenFunds,
  exchangeOpenTrade,
  exchangeSell,
  exchangeSetLeverage,
  exchangeTick,
} from './exchangeReduce'
import { NETWORK_NAMES, ROMANCE_NAMES, pickName } from './relationsCatalog'
import { decayPlayerRelations } from './relations'
import { createRng } from './rng'
import { skillById } from './skills'
import { applyShopUpgrade, inferShopTypeId, shopTypeById, upgradeCostFor } from './shopCatalog'
import {
  buildShop,
  canAssignToShop,
  canLearnSkill,
  closeShopPayout,
  eligibleManagers,
  makeRelation,
  meetsRequiredSkills,
  removeStaffFromShops,
  shopHasCapacity,
} from './shopStaff'
import type {
  GameAction,
  GameState,
  PlayerState,
  Relation,
  Shop,
  Track,
} from './types'

let logSeq = 0

function pushLog(state: GameState, text: string): GameState {
  logSeq += 1
  const id = `log-${logSeq}-${state.rngState}`
  return { ...state, logs: [...state.logs.slice(-80), { id, text }] }
}

function updatePlayer(state: GameState, playerId: string, fn: (p: PlayerState) => PlayerState): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? fn(p) : p)),
  }
}

function usedNames(state: GameState): Set<string> {
  const s = new Set<string>()
  for (const p of state.players) for (const r of p.relations) s.add(r.name)
  return s
}

function buyShop(
  state: GameState,
  playerId: string,
  effect: Extract<EventEffect, { type: 'offerShop' }>,
  rng: () => number,
): GameState {
  let s = state
  const p = s.players.find((x) => x.id === playerId)!
  if (p.cash < effect.cost) return pushLog(s, `${p.name} 现金不足，未能开「${effect.name}」。`)
  const typeId = effect.typeId ?? inferShopTypeId(effect.name)
  const def = shopTypeById(typeId)
  const required = def?.requiredSkills ?? []
  const ops = eligibleManagers(p, required)
  if (!ops.length) {
    return pushLog(
      s,
      `${p.name} 没有空闲且符合门槛的店长人选，未能开「${effect.name}」。`,
    )
  }
  const op = ops[0]
  const shop = buildShop({
    id: `shop-${p.shops.length}-${rng()}`,
    name: effect.name,
    typeId,
    level: effect.baseCashflow >= 0.55 ? 2 : 1,
    baseCashflow: effect.baseCashflow,
    managerId: op.id,
  })
  s = updatePlayer(s, playerId, (pl) => ({
    ...pl,
    cash: round2(pl.cash - effect.cost),
    shops: [...pl.shops, shop],
  }))
  return pushLog(s, `${p.name} 开设「${effect.name}」（${def?.label ?? typeId}），店长「${op.name}」。`)
}

function marry(state: GameState, playerId: string, relationId: string, accept: boolean): GameState {
  let s = state
  const name = s.players.find((p) => p.id === playerId)!.name
  if (!accept) {
    s = updatePlayer(s, playerId, (p) => ({
      ...p,
      relations: p.relations.map((r) =>
        r.id === relationId ? { ...r, score: Math.max(0, r.score - 15) } : r,
      ),
    }))
    return pushLog(s, `${name} 暂缓了婚事。`)
  }
  s = updatePlayer(s, playerId, (p) => ({
    ...p,
    cash: round2(p.cash - 0.5),
    relations: p.relations.map((r) => {
      if (r.id === relationId) {
        return { ...r, status: 'married' as const, locked: true, score: Math.min(100, r.score + 10) }
      }
      if (r.kind === 'romance' && r.status !== 'broken') {
        return { ...r, score: Math.max(0, Math.floor(r.score * 0.5)) }
      }
      return r
    }),
  }))
  return pushLog(s, `${name} 结婚了！其他恋情降温。`)
}

function applyClosedShops(
  player: PlayerState,
  closed: Shop[],
): { player: PlayerState; logParts: string[] } {
  if (!closed.length) return { player, logParts: [] }
  let cash = player.cash
  const logParts: string[] = []
  for (const shop of closed) {
    const payout = closeShopPayout(shop)
    cash = round2(cash + payout)
    logParts.push(`「${shop.name}」无人看店，以 ${payout} 万卖出`)
  }
  return { player: { ...player, cash }, logParts }
}

function transferRelation(state: GameState, fromId: string, toId: string, relationId: string): GameState {
  const from = state.players.find((p) => p.id === fromId)!
  const rel = from.relations.find((r) => r.id === relationId)
  if (!rel) return state
  const { shops, closed, managerChanged } = removeStaffFromShops(from.shops, relationId, from.relations)
  const applied = applyClosedShops({ ...from, shops }, closed)
  let s = updatePlayer(state, fromId, () => ({
    ...applied.player,
    relations: from.relations.filter((r) => r.id !== relationId),
  }))
  s = updatePlayer(s, toId, (p) => ({
    ...p,
    relations: [
      ...p.relations,
      makeRelation({
        ...rel,
        score: Math.max(20, rel.score - 20),
        locked: false,
        training: null,
      }),
    ],
  }))
  let msg = `${s.players.find((p) => p.id === toId)!.name} 挖走了「${rel.name}」！`
  if (managerChanged.length) msg += ` ${managerChanged.map((n) => `「${n}」改任店长`).join('；')}。`
  if (applied.logParts.length) msg += ` ${applied.logParts.join('；')}。`
  return pushLog(s, msg)
}

function maybePoach(state: GameState, actorId: string, rng: () => number): GameState {
  const targets: { player: PlayerState; rel: Relation }[] = []
  for (const p of state.players) {
    if (p.id === actorId) continue
    for (const r of p.relations) {
      if (r.status !== 'broken' && !r.locked) targets.push({ player: p, rel: r })
    }
  }
  if (!targets.length) return state
  const pick = targets[Math.floor(rng() * targets.length)]
  if (pick.player.isHuman) {
    return {
      ...state,
      pendingDecision: {
        type: 'poach',
        playerId: pick.player.id,
        fromPlayerId: actorId,
        relationId: pick.rel.id,
      },
    }
  }
  const success = rng() < (pick.rel.score > 70 ? 0.15 : 0.35)
  if (!success) {
    return pushLog(state, `${state.players.find((p) => p.id === actorId)!.name} 挖角失败。`)
  }
  return transferRelation(state, pick.player.id, actorId, pick.rel.id)
}

export function applyEffects(
  state: GameState,
  playerId: string,
  effects: EventEffect[],
  rng: () => number,
): GameState {
  let s = state
  const player = () => s.players.find((p) => p.id === playerId)!

  for (const effect of effects) {
    switch (effect.type) {
      case 'cash':
        s = updatePlayer(s, playerId, (p) => ({ ...p, cash: round2(p.cash + effect.delta) }))
        break
      case 'salary':
        s = updatePlayer(s, playerId, (p) => ({
          ...p,
          salary: round2(Math.max(0.4, p.salary + effect.delta)),
        }))
        break
      case 'liability':
        s = updatePlayer(s, playerId, (p) => ({
          ...p,
          liabilities: round2(Math.max(0, p.liabilities + effect.delta)),
        }))
        break
      case 'meet': {
        const pool = effect.relationKind === 'network' ? NETWORK_NAMES : ROMANCE_NAMES
        const name = pickName(pool, usedNames(s), rng)
        const score = effect.score ?? 40
        const boost = player().trait === 'networkBoost' && effect.relationKind === 'network' ? 8 : 0
        const rBoost = player().trait === 'romanceBoost' && effect.relationKind === 'romance' ? 8 : 0
        const rel = makeRelation({
          id: `rel-${s.logs.length}-${Math.floor(rng() * 1e6)}`,
          kind: effect.relationKind,
          name,
          score: Math.min(100, score + boost + rBoost),
          status: effect.relationKind === 'network' ? 'new' : 'dating',
          locked: false,
        })
        s = updatePlayer(s, playerId, (p) => ({ ...p, relations: [...p.relations, rel] }))
        s = pushLog(
          s,
          `${player().name} 结识了${effect.relationKind === 'network' ? '人脉' : '恋人'}「${name}」。`,
        )
        break
      }
      case 'boostRelation':
        s = updatePlayer(s, playerId, (p) => {
          const candidates = p.relations.filter(
            (r) => r.status !== 'broken' && (!effect.kind || r.kind === effect.kind),
          )
          if (!candidates.length) return p
          const target = candidates[Math.floor(rng() * candidates.length)]
          return {
            ...p,
            relations: p.relations.map((r) => {
              if (r.id !== target.id) return r
              const score = Math.max(0, Math.min(100, r.score + effect.amount))
              let status = r.status
              if (score <= 10 && effect.amount < 0) status = 'broken'
              if (r.kind === 'network' && score >= 50 && r.status === 'new') status = 'stable'
              if (r.kind === 'network' && score >= 75 && (r.status === 'stable' || r.status === 'new')) {
                status = 'partner'
              }
              return {
                ...r,
                score,
                status,
                locked: status === 'partner' || status === 'married' || r.locked,
              }
            }),
          }
        })
        break
      case 'offerShop': {
        const p = player()
        const ops = p.relations.filter((r) => r.status !== 'broken')
        if (!ops.length) {
          s = pushLog(s, `${p.name} 想开「${effect.name}」，但还没有可绑定的关系人。`)
          break
        }
        if (p.cash < effect.cost) {
          s = pushLog(s, `${p.name} 看上「${effect.name}」，现金不足（需 ${effect.cost} 万）。`)
          break
        }
        const isBig = effect.cost >= Math.max(0.01, p.cash) * BIG_SPEND_RATIO
        if (p.isHuman && isBig && !s.pendingDecision) {
          s = {
            ...s,
            pendingDecision: {
              type: 'bigSpend',
              playerId,
              investmentId: `shop-${effect.name}`,
              cost: effect.cost,
              cashflow: effect.baseCashflow,
              name: effect.name,
            },
          }
          break
        }
        s = buyShop(s, playerId, effect, rng)
        break
      }
      case 'offerInvest': {
        const p = player()
        let cost = effect.cost
        if (p.trait === 'investDiscount') cost = round2(cost * 0.9)
        const isBig = Boolean(effect.big) || cost >= Math.max(0.01, p.cash) * BIG_SPEND_RATIO
        if (p.isHuman && isBig && !s.pendingDecision) {
          s = {
            ...s,
            pendingDecision: {
              type: 'bigSpend',
              playerId,
              investmentId: `inv-${effect.name}`,
              cost,
              cashflow: effect.cashflow,
              name: effect.name,
            },
          }
          break
        }
        if (p.cash < cost) {
          s = pushLog(s, `${p.name} 想买「${effect.name}」，现金不够。`)
          break
        }
        s = updatePlayer(s, playerId, (pl) => ({
          ...pl,
          cash: round2(pl.cash - cost),
          investments: [
            ...pl.investments,
            {
              id: `inv-${pl.investments.length}-${Math.floor(rng() * 1e6)}`,
              name: effect.name,
              cost,
              cashflow: effect.cashflow,
            },
          ],
        }))
        s = pushLog(s, `${player().name} 购入「${effect.name}」（${cost} 万）。`)
        break
      }
      case 'marketBump':
        s = updatePlayer(s, playerId, (p) => ({
          ...p,
          investments: p.investments.map((i) => ({
            ...i,
            cost: round2(i.cost * effect.factor),
            cashflow: round2(i.cashflow * (effect.factor >= 1 ? 1.05 : 0.95)),
          })),
        }))
        break
      case 'poachAttempt':
        s = maybePoach(s, playerId, rng)
        break
      case 'marriagePrompt': {
        const dating = player().relations.find(
          (r) => r.kind === 'romance' && (r.status === 'dating' || r.status === 'engaged') && r.score >= 60,
        )
        if (!dating) break
        if (player().isHuman) {
          s = { ...s, pendingDecision: { type: 'marriage', playerId, relationId: dating.id } }
        } else {
          s = marry(s, playerId, dating.id, true)
        }
        break
      }
    }
  }
  return s
}

function markMaintained(state: GameState, playerId: string, relationId: string): GameState {
  return updatePlayer(state, playerId, (p) => {
    const ids = p.maintainedRelationIds ?? []
    if (ids.includes(relationId)) return p
    return { ...p, maintainedRelationIds: [...ids, relationId] }
  })
}

function applyPayday(state: GameState, playerId: string): GameState {
  const p = state.players.find((x) => x.id === playerId)!
  const rng = createRng(state.rngState)
  const rolled = rollShopSeason(p, state.seasonIndex, () => rng.next())
  const withShops = updatePlayer(state, playerId, (pl) => ({ ...pl, shops: rolled.shops }))
  const p2 = withShops.players.find((x) => x.id === playerId)!
  const f = calcFinance(p2)
  const early = state.age < EARLY_AGE_MAX ? EARLY_PAY_BONUS : 0
  const delta = round2(f.seasonalCashflow + early)
  let s = updatePlayer(withShops, playerId, (pl) => ({
    ...pl,
    cash: round2(pl.cash + delta),
  }))
  s = { ...s, rngState: rng.state() }
  let msg = `${p.name} 结算现金流 ${f.seasonalCashflow >= 0 ? '+' : ''}${f.seasonalCashflow} 万`
  if (p.shops.length) {
    msg += `（店铺净 ${rolled.shopNet >= 0 ? '+' : ''}${rolled.shopNet}）`
  }
  if (early > 0) msg += `（年轻红利 +${early}）`
  s = pushLog(s, `${msg}。`)
  const next = s.players.find((x) => x.id === playerId)!
  if (next.cash < 0) {
    s = {
      ...s,
      pendingDecision: { type: 'bankrupt', playerId, amount: round2(-next.cash) },
    }
  }
  return s
}

function chooseCareer(state: GameState, careerId: string): GameState {
  const career =
    state.careerChoices.find((c) => c.id === careerId) ?? CAREERS.find((c) => c.id === careerId)
  if (!career) return state
  const rng = createRng(state.rngState)
  let s = updatePlayer(state, state.players[0].id, (p) => ({
    ...p,
    careerId: career.id,
    salary: career.salary,
    fixedExpense: career.fixedExpense,
    cash: career.startingCash,
    trait: career.trait,
  }))

  const remaining = CAREERS.filter((c) => c.id !== career.id)
  for (let i = 1; i < s.players.length; i++) {
    const idx = Math.floor(rng.next() * remaining.length)
    const c = remaining.splice(idx, 1)[0] ?? CAREERS[i % CAREERS.length]
    s = updatePlayer(s, s.players[i].id, (p) => ({
      ...p,
      careerId: c.id,
      salary: c.salary,
      fixedExpense: c.fixedExpense,
      cash: c.startingCash,
      trait: c.trait,
      name: `AI·${c.name}`,
    }))
  }

  s = { ...s, phase: 'playing', careerChoices: [], rngState: rng.state() }
  return pushLog(s, `你选择了「${career.name}」。人生开始转动。`)
}

function promote(state: GameState, playerId: string): GameState {
  let s = updatePlayer(state, playerId, (p) => ({
    ...p,
    track: 'investor' as const,
    position: 0,
    cash: round2(p.cash + INVESTOR_START_BONUS),
  }))
  const name = s.players.find((p) => p.id === playerId)!.name
  return pushLog(
    s,
    `${name} 晋级投资人圈！身份转变，启动金 +${INVESTOR_START_BONUS} 万。`,
  )
}

function rollAndMove(state: GameState): GameState {
  if (
    state.phase !== 'playing' ||
    state.turnRolled ||
    state.pendingEvent ||
    state.pendingDecision ||
    state.pendingDate ||
    state.moveAnimation ||
    state.slotSpin ||
    state.pendingLocation
  ) {
    return state
  }
  const rng = createRng(state.rngState)
  // 第一位：行走格数 1–9；后两位：0–9 装饰（777 有小奖励）
  const steps = 1 + Math.floor(rng.next() * 9)
  const r2 = Math.floor(rng.next() * 10)
  const r3 = Math.floor(rng.next() * 10)
  const player = state.players[state.turnPlayerIndex]
  let s: GameState = {
    ...state,
    rngState: rng.state(),
    lastDice: steps,
    lastReels: [steps, r2, r3],
    turnRolled: true,
    slotSpin: {
      playerId: player.id,
      track: player.track,
      reels: [steps, r2, r3],
    },
  }
  return pushLog(s, `${player.name} 拉下 777…… 第一位将决定步数`)
}

/** 拉霸停轮后，按第一位数字开走 */
function finishSlot(state: GameState): GameState {
  const spin = state.slotSpin
  if (!spin) return state
  const steps = Math.max(1, spin.reels[0])
  const player = state.players.find((p) => p.id === spin.playerId)!
  const track = buildTrack(spin.track)
  const result = move(player.position, steps, track)
  let s: GameState = {
    ...state,
    slotSpin: null,
    lastDice: steps,
    lastReels: spin.reels,
    moveAnimation: {
      playerId: spin.playerId,
      track: spin.track,
      path: result.path,
      pathIndex: -1,
      dice: steps,
      passedPayday: result.passedPayday,
      finalPosition: result.position,
      reels: spin.reels,
    },
  }
  s = pushLog(s, `拉霸结果 ${spin.reels.join('-')}，前进 ${steps} 格（第2位定事件类型）`)
  return s
}

/** Advance token one space along path; when done, settle landing */
function animStep(state: GameState): GameState {
  const anim = state.moveAnimation
  if (!anim) return state
  const nextIndex = anim.pathIndex + 1
  if (nextIndex >= anim.path.length) return finishMove(state)

  const pos = anim.path[nextIndex]
  return {
    ...state,
    moveAnimation: { ...anim, pathIndex: nextIndex },
    players: state.players.map((p) => (p.id === anim.playerId ? { ...p, position: pos } : p)),
  }
}

function finishMove(state: GameState): GameState {
  const anim = state.moveAnimation
  if (!anim) return state
  const track = buildTrack(anim.track)
  const landed = track[anim.finalPosition]
  let s: GameState = {
    ...state,
    moveAnimation: null,
    players: state.players.map((p) =>
      p.id === anim.playerId ? { ...p, position: anim.finalPosition } : p,
    ),
  }
  s = pushLog(s, `走到「${landed.label}」。`)

  const rng = createRng(s.rngState)
  if (anim.passedPayday || isPaydaySpace(landed.kind)) {
    s = applyPayday(s, anim.playerId)
    if (s.pendingDecision) return { ...s, rngState: rng.state() }
  }

  // 事件由拉霸第 2、3 位决定（与落点无关）
  const reels = anim.reels ?? s.lastReels ?? ([anim.dice, 1, 0] as [number, number, number])
  const resolved = resolveSlotEvent(reels, anim.track)
  const hint = [
    `拉霸 ${reels.join('-')}`,
    resolved.kindLabel,
    resolved.comboLabel,
  ]
    .filter(Boolean)
    .join(' · ')

  s = pushLog(s, `触发事件【${resolved.kindLabel}】${resolved.comboLabel ? `（${resolved.comboLabel}）` : ''}`)
  if (resolved.extraEffects.length) {
    s = applyEffects(s, anim.playerId, resolved.extraEffects, () => rng.next())
  }

  return {
    ...s,
    rngState: rng.state(),
    pendingEvent: {
      playerId: anim.playerId,
      eventId: resolved.event.id,
      title: resolved.event.title,
      text: resolved.event.text,
      kind: resolved.event.kind,
      slotHint: hint,
      landIndex: anim.finalPosition,
      landTrack: anim.track,
    },
  }
}

function makeLocation(
  playerId: string,
  track: Track,
  landIndex: number,
): import('./types').PendingLocation | null {
  const board = buildTrack(track)
  const space = board[landIndex]
  if (!space || !spaceHasLocationAction(space.kind)) return null
  return {
    playerId,
    spaceKind: space.kind,
    spaceIndex: landIndex,
    track,
    label: space.label,
  }
}

function resolveEventChoice(state: GameState, choiceId: string): GameState {
  if (!state.pendingEvent) return state
  const pending = state.pendingEvent
  const event = EVENTS.find((e) => e.id === pending.eventId)
  if (!event) return { ...state, pendingEvent: null }

  const player = state.players.find((x) => x.id === pending.playerId)
  const cash = player?.cash ?? 0

  // 全部付不起或显式跳过：空手过关，不卡死
  if (choiceId === '__skip__' || !event.choices.some((ch) => canAffordChoice(cash, ch.effects))) {
    const rng = createRng(state.rngState)
    let s: GameState = { ...state, pendingEvent: null, rngState: rng.state() }
    s = pushLog(s, `事件：${event.title} — 手头太紧，只能空手过关。`)
    const loc = makeLocation(pending.playerId, pending.landTrack, pending.landIndex)
    if (loc) s = attachLocation(s, loc)
    return s
  }

  let choice =
    event.choices.find((x) => x.id === choiceId) ??
    event.choices.find((x) => x.id === 'accept') ??
    event.choices[0]
  if (!choice) return { ...state, pendingEvent: null }

  if (!canAffordChoice(cash, choice.effects) && choiceCashCost(choice.effects) > 0) {
    // 所选付不起：改走可负担项或跳过，避免 pendingEvent 残留
    const fallback = event.choices.find((ch) => canAffordChoice(cash, ch.effects))
    if (!fallback) return resolveEventChoice(state, '__skip__')
    choice = fallback
  }

  const rng = createRng(state.rngState)
  let s: GameState = { ...state, pendingEvent: null }
  s = pushLog(s, `事件：${event.title} — 选择「${choice.label}」`)
  s = applyEffects(s, pending.playerId, choice.effects, () => rng.next())
  s = { ...s, rngState: rng.state() }

  const loc = makeLocation(pending.playerId, pending.landTrack, pending.landIndex)
  const p = s.players.find((x) => x.id === pending.playerId)!
  if (canPromote(p) && p.track === 'worker' && !s.pendingDecision) {
    if (p.isHuman) {
      return {
        ...s,
        pendingDecision: { type: 'promote', playerId: p.id },
        deferredLocation: loc,
      }
    }
    s = promote(s, p.id)
  }

  // 任何决策弹层优先：落点延后，避免双 modal 叠层
  if (s.pendingDecision) {
    return {
      ...s,
      pendingLocation: null,
      pendingCasino: null,
      pendingVisitShop: null,
      pendingExchange: null,
      deferredLocation: loc ?? s.deferredLocation,
    }
  }

  if (loc) s = attachLocation(s, loc)
  return s
}

function releaseDeferredLocation(state: GameState): GameState {
  if (!state.deferredLocation) return state
  return attachLocation(
    { ...state, deferredLocation: null },
    state.deferredLocation,
  )
}

function attachLocation(state: GameState, loc: import('./types').PendingLocation | null): GameState {
  if (!loc) {
    return {
      ...state,
      pendingLocation: null,
      pendingCasino: null,
      pendingVisitShop: null,
      pendingExchange: null,
    }
  }
  let s: GameState = {
    ...state,
    pendingLocation: loc,
    pendingCasino: null,
    pendingVisitShop: null,
    pendingExchange: null,
  }
  if (loc.spaceKind === 'casino') return casinoEnter(s)
  if (loc.spaceKind === 'invest') return exchangeEnter(s)
  if (loc.spaceKind === 'vacant') {
    const owned = findShopAt(s.players, loc.track, loc.spaceIndex)
    if (owned) return visitEnter(s)
  }
  return s
}

function clearLocation(state: GameState): GameState {
  return {
    ...state,
    pendingLocation: null,
    pendingCasino: null,
    pendingVisitShop: null,
    pendingExchange: null,
  }
}

function locationBuyVacant(state: GameState, relationId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'vacant') return state
  if (findShopAt(state.players, loc.track, loc.spaceIndex)) {
    return pushLog(clearLocation(state), '这片空地已经有人开店了。')
  }
  const p = state.players.find((x) => x.id === loc.playerId)!
  const hire = relationId === '__hire__'
  const totalCost = round2(VACANT_COST + (hire ? VACANT_HIRE_EXTRA : 0))
  if (p.cash + 1e-9 < totalCost) {
    return pushLog(clearLocation(state), `${p.name} 现金不足，买不下这片空地。`)
  }

  const rng = createRng(state.rngState)
  let s = state
  const shopName = `${loc.track === 'worker' ? '市区' : '商圈'}空地店`

  if (hire) {
    const names = NETWORK_NAMES
    const used = usedNames(s)
    const name = pickName(names, used, () => rng.next())
    const opId = `hire-${Math.floor(rng.next() * 1e6)}`
    const rel = makeRelation({
      id: opId,
      kind: 'network',
      name,
      score: 32,
      status: 'new',
      locked: false,
    })
    const shop = buildShop({
      id: `lot-${loc.track}-${loc.spaceIndex}-${Math.floor(rng.next() * 1e6)}`,
      name: shopName,
      typeId: 'vacantLot',
      level: 1,
      baseCashflow: VACANT_SHOP_CASHFLOW,
      managerId: opId,
      boardTrack: loc.track,
      boardIndex: loc.spaceIndex,
    })
    s = updatePlayer(s, loc.playerId, (pl) => ({
      ...pl,
      cash: round2(pl.cash - totalCost),
      relations: [...pl.relations, rel],
      shops: [...pl.shops, shop],
    }))
    s = { ...s, rngState: rng.state(), pendingLocation: null }
    return pushLog(s, `${p.name} 花 ${totalCost} 万买空地并雇「${name}」当店长。`)
  }

  const op = p.relations.find((r) => r.id === relationId)
  if (!op || !canAssignToShop(p, relationId)) {
    return pushLog(clearLocation(state), `${p.name} 没有可绑定的空闲店长，空地只能先放弃。`)
  }
  const vacantDef = shopTypeById('vacantLot')
  if (!meetsRequiredSkills(op, vacantDef?.requiredSkills ?? [])) {
    return pushLog(clearLocation(state), `${p.name} 人选不具备开店技能门槛。`)
  }
  const shop = buildShop({
    id: `lot-${loc.track}-${loc.spaceIndex}-${Math.floor(rng.next() * 1e6)}`,
    name: shopName,
    typeId: 'vacantLot',
    level: 1,
    baseCashflow: VACANT_SHOP_CASHFLOW,
    managerId: op.id,
    boardTrack: loc.track,
    boardIndex: loc.spaceIndex,
  })
  s = updatePlayer(s, loc.playerId, (pl) => ({
    ...pl,
    cash: round2(pl.cash - VACANT_COST),
    shops: [...pl.shops, shop],
  }))
  s = { ...s, rngState: rng.state(), pendingLocation: null }
  return pushLog(s, `${p.name} 购置空地并开店，店长「${op.name}」。`)
}

function locationBuyItem(state: GameState, itemId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'shop') return state
  const item = shopItemById(itemId)
  if (!item) return state
  const p = state.players.find((x) => x.id === loc.playerId)!
  if (p.cash < item.cost) {
    return pushLog(clearLocation(state), `${p.name} 买不起「${item.name}」。`)
  }
  const rng = createRng(state.rngState)
  let s = updatePlayer(state, loc.playerId, (pl) => ({ ...pl, cash: round2(pl.cash - item.cost) }))
  if (itemId === 'gift') {
    s = applyEffects(s, loc.playerId, [{ type: 'boostRelation', amount: 12, kind: 'romance' }], () => rng.next())
  } else if (itemId === 'wine') {
    s = applyEffects(s, loc.playerId, [{ type: 'boostRelation', amount: 12, kind: 'network' }], () => rng.next())
  } else if (itemId === 'course') {
    s = applyEffects(s, loc.playerId, [{ type: 'salary', delta: 0.08 }], () => rng.next())
  } else if (itemId === 'gadget') {
    s = applyEffects(s, loc.playerId, [{ type: 'cash', delta: 0.1 }], () => rng.next())
  }
  s = { ...s, rngState: rng.state(), pendingLocation: null }
  return pushLog(s, `${p.name} 在商店购买「${item.name}」。`)
}

function locationPoach(state: GameState): GameState {
  /** AI / 兼容：随机挑一个可挖目标 */
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'office') return state
  const targets = poachableTargets(loc.playerId, state.players)
  if (!targets.length) {
    return pushLog(clearLocation(state), `${state.players.find((p) => p.id === loc.playerId)!.name} 找不到可挖对象。`)
  }
  const rng = createRng(state.rngState)
  const pick = targets[Math.floor(rng.next() * targets.length)]
  return officePoach({ ...state, rngState: rng.state() }, pick.owner.id, pick.rel.id)
}

function applyAiLocation(state: GameState): GameState {
  if (state.pendingVisitShop) {
    return visitAiStep(state, transferRelation)
  }
  if (state.pendingExchange || state.pendingLocation?.spaceKind === 'invest') {
    let s = exchangeAiStep(state)
    // 若 AI 留在大厅未离开，再试理财柜一笔或离开
    if (s.pendingExchange && s.pendingLocation?.spaceKind === 'invest') {
      const p = s.players.find((x) => x.id === s.pendingLocation!.playerId)
      if (p && s.pendingExchange.screen === 'lobby') {
        const pick = pickAiLocationAction(p, s.pendingLocation, false)
        if (pick.type === 'buyInvest') {
          s = locationBuyInvest(s, pick.offerId)
        }
        return exchangeLeave(s)
      }
      if (s.pendingLocation) return exchangeLeave(s)
    }
    return s
  }
  const loc = state.pendingLocation
  if (!loc) return state
  const p = state.players.find((x) => x.id === loc.playerId)
  if (!p) return clearLocation(state)
  const hasTargets = poachableTargets(loc.playerId, state.players).length > 0
  const pick = pickAiLocationAction(p, loc, hasTargets)
  switch (pick.type) {
    case 'buyVacant':
      return locationBuyVacant(state, pick.relationId)
    case 'buyItem':
      return locationBuyItem(state, pick.itemId)
    case 'poach':
      return locationPoach(state)
    case 'recommend':
      return officeRecommend(state, pick.kind)
    case 'upgrade':
      return locationUpgradeShop(state, pick.shopId)
    case 'rebind':
      return locationRebindOperator(state, pick.shopId, pick.relationId)
    case 'addStaff':
      return shopAddStaff(state, pick.shopId, pick.relationId)
    case 'gamble':
      return casinoAiStep(state)
    case 'parkRest':
      return locationParkRest(state)
    case 'parkChat':
      return locationParkChat(state, pick.relationId)
    case 'buyInvest':
      return locationBuyInvest(state, pick.offerId)
    default:
      return pushLog(clearLocation(state), `${p.name} 离开了${loc.label}。`)
  }
}

function officeRecommend(state: GameState, kind: 'network' | 'romance'): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'office') return state
  const player = state.players.find((p) => p.id === loc.playerId)!
  if (player.cash + 1e-9 < OFFICE_RECOMMEND_COST) {
    return pushLog(state, '现金不足，无法请事务所推荐好友。')
  }
  const rng = createRng(state.rngState)
  let s: GameState = {
    ...updatePlayer(state, loc.playerId, (p) => ({
      ...p,
      cash: round2(p.cash - OFFICE_RECOMMEND_COST),
    })),
    pendingLocation: null,
  }
  const score = 35 + Math.floor(rng.next() * 11)
  s = applyEffects(
    s,
    loc.playerId,
    [{ type: 'meet', relationKind: kind, score }],
    () => rng.next(),
  )
  s = pushLog(
    s,
    `${player.name} 花 ${OFFICE_RECOMMEND_COST} 万请事务所推荐了一位${kind === 'network' ? '人脉' : '恋人'}。`,
  )
  return { ...s, rngState: rng.state() }
}

function officeAdjust(
  state: GameState,
  ownerId: string,
  relationId: string,
  direction: 'up' | 'down',
): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'office') return state
  const actor = state.players.find((p) => p.id === loc.playerId)!
  const owner = state.players.find((p) => p.id === ownerId)
  const rel = owner?.relations.find((r) => r.id === relationId)
  if (!owner || !rel || rel.status === 'broken') return state
  if (ownerId !== loc.playerId && rel.locked) {
    return pushLog(state, '对方关系已锁定，无法调节。')
  }
  const cost = direction === 'up' ? OFFICE_UP_COST : OFFICE_DOWN_COST
  if (actor.cash + 1e-9 < cost) {
    return pushLog(state, '现金不足，无法调节好感。')
  }
  const delta = adjustDelta(loc.playerId, ownerId, direction)
  let s = updatePlayer(state, loc.playerId, (p) => ({
    ...p,
    cash: round2(p.cash - cost),
  }))
  s = boostRelationById(s, ownerId, relationId, delta)
  if (direction === 'up' && ownerId === loc.playerId) {
    s = markMaintained(s, loc.playerId, relationId)
  }
  s = { ...s, pendingLocation: null }
  const verb = direction === 'up' ? '升温' : '降温'
  const whose = ownerId === loc.playerId ? '自己的' : `${owner.name} 的`
  return pushLog(s, `${actor.name} 花 ${cost} 万让${whose}「${rel.name}」好感${verb}（${delta > 0 ? '+' : ''}${delta}）。`)
}

function officePoach(state: GameState, targetPlayerId: string, relationId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'office') return state
  const actor = state.players.find((p) => p.id === loc.playerId)!
  if (actor.poachCooldown > 0) {
    return pushLog(state, `挖角冷却中（还剩 ${actor.poachCooldown} 回合）。`)
  }
  if (targetPlayerId === loc.playerId) return state
  const target = state.players.find((p) => p.id === targetPlayerId)
  const rel = target?.relations.find((r) => r.id === relationId)
  if (!target || !rel || rel.status === 'broken' || rel.locked) {
    return pushLog(clearLocation(state), '该目标无法挖角。')
  }
  if (actor.cash + 1e-9 < OFFICE_POACH_COST) {
    return pushLog(state, '现金不足，无法发起挖角。')
  }
  const rng = createRng(state.rngState)
  let s = updatePlayer(state, loc.playerId, (p) => ({
    ...p,
    cash: round2(p.cash - OFFICE_POACH_COST),
    poachCooldown: POACH_COOLDOWN_TURNS,
  }))
  s = { ...s, pendingLocation: null, rngState: rng.state() }
  s = pushLog(s, `${actor.name} 花 ${OFFICE_POACH_COST} 万委托事务所挖「${rel.name}」。`)

  if (target.isHuman) {
    return {
      ...s,
      pendingDecision: {
        type: 'poach',
        playerId: target.id,
        fromPlayerId: loc.playerId,
        relationId: rel.id,
      },
    }
  }

  const chance = poachSuccessChance(rel.score)
  if (rng.next() >= chance) {
    return { ...pushLog(s, `${actor.name} 挖角失败。`), rngState: rng.state() }
  }
  s = transferRelation(s, target.id, loc.playerId, rel.id)
  return { ...s, rngState: rng.state() }
}

function locationUpgradeShop(state: GameState, shopId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'manage') return state
  const p = state.players.find((x) => x.id === loc.playerId)!
  const shop = p.shops.find((s) => s.id === shopId)
  if (!shop) {
    return pushLog(clearLocation(state), `${p.name} 找不到要升级的店。`)
  }
  const cost = upgradeCostFor(shop)
  if (p.cash + 1e-9 < cost) {
    return pushLog(clearLocation(state), `${p.name} 没钱追加经营投入（需 ${cost} 万）。`)
  }
  const beforeLv = shop.level
  const upgraded = applyShopUpgrade(shop)
  let s = updatePlayer(state, loc.playerId, (pl) => ({
    ...pl,
    cash: round2(pl.cash - cost),
    shops: pl.shops.map((sh) => (sh.id === shopId ? upgraded : sh)),
  }))
  s = clearLocation(s)
  const def = shopTypeById(shop.typeId)
  const verb = beforeLv >= 3 ? '追加运营' : `升级至 Lv.${upgraded.level}`
  return pushLog(
    s,
    `${p.name} ${verb}「${shop.name}」${def ? `（${def.label}）` : ''}，花费 ${cost} 万。营收 ${upgraded.baseRevenue} / 成本 ${upgraded.operatingCost}。`,
  )
}

function shopAddStaff(state: GameState, shopId: string, relationId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'manage') return state
  const p = state.players.find((x) => x.id === loc.playerId)!
  const shop = p.shops.find((s) => s.id === shopId)
  const rel = p.relations.find((r) => r.id === relationId)
  if (!shop || !rel) {
    return pushLog(clearLocation(state), `${p.name} 无法加人。`)
  }
  if (!shopHasCapacity(shop)) {
    return pushLog(clearLocation(state), `「${shop.name}」编制已满。`)
  }
  if (!canAssignToShop(p, relationId)) {
    return pushLog(clearLocation(state), `「${rel.name}」无法进店（进修中、已在他店或关系破裂）。`)
  }
  let s = updatePlayer(state, loc.playerId, (pl) => ({
    ...pl,
    shops: pl.shops.map((sh) =>
      sh.id === shopId ? { ...sh, staffIds: [...sh.staffIds, relationId] } : sh,
    ),
  }))
  s = clearLocation(s)
  return pushLog(s, `${p.name} 安排「${rel.name}」进入「${shop.name}」当店员。`)
}

function shopRemoveStaff(state: GameState, shopId: string, relationId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'manage') return state
  const p = state.players.find((x) => x.id === loc.playerId)!
  const shop = p.shops.find((s) => s.id === shopId)
  if (!shop || !shop.staffIds.includes(relationId)) {
    return pushLog(clearLocation(state), `${p.name} 无法让人离店。`)
  }
  const relName = p.relations.find((r) => r.id === relationId)?.name ?? '某人'
  const { shops, closed, managerChanged } = removeStaffFromShops(p.shops, relationId, p.relations)
  const applied = applyClosedShops({ ...p, shops }, closed)
  let s = updatePlayer(state, loc.playerId, () => applied.player)
  s = clearLocation(s)
  let msg = `${p.name} 让「${relName}」离开编制。`
  if (managerChanged.length) msg += ` ${managerChanged.map((n) => `「${n}」改任店长`).join('；')}。`
  if (applied.logParts.length) msg += ` ${applied.logParts.join('；')}。`
  return pushLog(s, msg)
}

function shopSetManager(state: GameState, shopId: string, relationId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'manage') return state
  const p = state.players.find((x) => x.id === loc.playerId)!
  const shop = p.shops.find((s) => s.id === shopId)
  const rel = p.relations.find((r) => r.id === relationId)
  if (!shop || !rel || !shop.staffIds.includes(relationId)) {
    return pushLog(clearLocation(state), `${p.name} 无法更换店长。`)
  }
  let s = updatePlayer(state, loc.playerId, (pl) => ({
    ...pl,
    shops: pl.shops.map((sh) => (sh.id === shopId ? { ...sh, managerId: relationId } : sh)),
  }))
  s = clearLocation(s)
  return pushLog(s, `${p.name} 任命「${rel.name}」为「${shop.name}」店长。`)
}

/** @deprecated 兼容旧动作：改为设为店长；若不在店内则先加人再任命 */
function locationRebindOperator(state: GameState, shopId: string, relationId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'manage') return state
  const p = state.players.find((x) => x.id === loc.playerId)!
  const shop = p.shops.find((s) => s.id === shopId)
  if (!shop) {
    return pushLog(clearLocation(state), `${p.name} 无法更换店长。`)
  }
  if (shop.staffIds.includes(relationId)) {
    return shopSetManager(state, shopId, relationId)
  }
  if (!canAssignToShop(p, relationId) || !shopHasCapacity(shop)) {
    return pushLog(clearLocation(state), `${p.name} 无法安排该人进店当店长。`)
  }
  let s = updatePlayer(state, loc.playerId, (pl) => ({
    ...pl,
    shops: pl.shops.map((sh) =>
      sh.id === shopId
        ? { ...sh, staffIds: [...sh.staffIds, relationId], managerId: relationId }
        : sh,
    ),
  }))
  const rel = p.relations.find((r) => r.id === relationId)!
  s = clearLocation(s)
  return pushLog(s, `${p.name} 将「${shop.name}」交给「${rel.name}」任店长。`)
}

function trainStart(state: GameState, relationId: string, skillId: string): GameState {
  const p = state.players[state.turnPlayerIndex]
  if (!p.isHuman && !state.autoEnabled) {
    /* AI may train via AUTO_STEP later */
  }
  const rel = p.relations.find((r) => r.id === relationId)
  if (!rel) return state
  const err = canLearnSkill(rel, skillId)
  if (err) return pushLog(state, `无法进修：${err}。`)
  const def = skillById(skillId)!
  if (p.cash + 1e-9 < def.cost) return pushLog(state, `${p.name} 现金不足，付不起学费。`)
  if (relationShopIdSafe(p, relationId)) {
    return pushLog(state, `「${rel.name}」在店里上班，先离店再进修。`)
  }
  let s = updatePlayer(state, p.id, (pl) => ({
    ...pl,
    cash: round2(pl.cash - def.cost),
    relations: pl.relations.map((r) =>
      r.id === relationId
        ? {
            ...r,
            training: {
              skillId: def.id,
              turnsLeft: def.turns,
              successChance: def.successChance,
            },
          }
        : r,
    ),
  }))
  return pushLog(
    s,
    `${p.name} 送「${rel.name}」进修「${def.name}」（学费 ${def.cost} 万，约 ${def.turns} 回合，成功率 ${Math.round(def.successChance * 100)}%）。`,
  )
}

function relationShopIdSafe(player: PlayerState, relationId: string): string | null {
  return player.shops.find((s) => s.staffIds.includes(relationId))?.id ?? null
}

function tickTraining(player: PlayerState, rng: () => number): { player: PlayerState; logs: string[] } {
  const logs: string[] = []
  const relations = player.relations.map((r) => {
    if (!r.training) return r
    const turnsLeft = r.training.turnsLeft - 1
    if (turnsLeft > 0) {
      return { ...r, training: { ...r.training, turnsLeft } }
    }
    const def = skillById(r.training.skillId)
    const ok = rng() < r.training.successChance
    if (ok && def && r.skills.length < 3 && !r.skills.includes(def.id)) {
      logs.push(`「${r.name}」进修「${def.name}」成功！`)
      return { ...r, skills: [...r.skills, def.id], training: null }
    }
    logs.push(`「${r.name}」进修「${def?.name ?? r.training.skillId}」未能掌握。`)
    return { ...r, training: null }
  })
  return { player: { ...player, relations }, logs }
}

function locationParkRest(state: GameState): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'park') return state
  const p = state.players.find((x) => x.id === loc.playerId)!
  let s = updatePlayer(state, loc.playerId, (pl) => ({
    ...pl,
    cash: round2(pl.cash + PARK_REST_CASH),
  }))
  s = clearLocation(s)
  return pushLog(s, `${p.name} 在公园休息，现金 +${PARK_REST_CASH} 万。`)
}

function locationParkChat(state: GameState, relationId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'park') return state
  const p = state.players.find((x) => x.id === loc.playerId)!
  const rel = p.relations.find((r) => r.id === relationId && r.status !== 'broken')
  if (!rel) {
    return pushLog(clearLocation(state), `${p.name} 没找到聊天对象，只好离开公园。`)
  }
  let s = boostRelationById(state, loc.playerId, relationId, PARK_CHAT_BOOST)
  s = markMaintained(s, loc.playerId, relationId)
  s = clearLocation(s)
  return pushLog(s, `${p.name} 与「${rel.name}」在公园小坐，好感 +${PARK_CHAT_BOOST}。`)
}

function locationBuyInvest(state: GameState, offerId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'invest') return state
  let s = state
  if (!s.pendingExchange) s = exchangeEnter(s)
  const ex = s.pendingExchange
  if (!ex) return state
  // 允许从大厅直接买时切到 funds
  if (ex.screen === 'trade' && ex.trade && !ex.trade.ended) return state
  if (ex.screen !== 'funds') {
    s = setExchangeFunds(s)
  }
  const offer = investOfferById(offerId)
  if (!offer) return state
  const p = s.players.find((x) => x.id === loc.playerId)!
  if (offer.investorOnly && p.track !== 'investor') {
    return pushLog(s, `${p.name} 还不是投资人，买不了「${offer.name}」。`)
  }
  const discount = p.trait === 'investDiscount' ? 0.9 : 1
  const cost = round2(offer.cost * discount)
  if (p.cash + 1e-9 < cost) {
    return pushLog(s, `${p.name} 买不起「${offer.name}」。`)
  }
  const rng = createRng(s.rngState)
  s = updatePlayer(s, loc.playerId, (pl) => ({
    ...pl,
    cash: round2(pl.cash - cost),
    investments: [
      ...pl.investments,
      {
        id: `inv-${offer.id}-${Math.floor(rng.next() * 1e6)}`,
        name: offer.name,
        cost,
        cashflow: offer.cashflow,
      },
    ],
  }))
  s = { ...s, rngState: rng.state() }
  if (s.pendingExchange) {
    s = { ...s, pendingExchange: { ...s.pendingExchange, screen: 'funds' } }
  }
  return pushLog(s, `${p.name} 在理财柜买入「${offer.name}」（${cost} 万）。`)
}

function setExchangeFunds(state: GameState): GameState {
  const ex = state.pendingExchange
  if (!ex) return state
  return { ...state, pendingExchange: { ...ex, screen: 'funds', trade: null } }
}

function locationSellInvest(state: GameState, investmentId: string): GameState {
  const loc = state.pendingLocation
  if (!loc || loc.spaceKind !== 'invest') return state
  let s = state
  if (!s.pendingExchange) s = exchangeEnter(s)
  const ex = s.pendingExchange
  if (!ex) return state
  if (ex.screen === 'trade' && ex.trade && !ex.trade.ended) return state
  const p = s.players.find((x) => x.id === loc.playerId)!
  const inv = p.investments.find((i) => i.id === investmentId)
  if (!inv) {
    return pushLog(s, `${p.name} 没有这笔持仓。`)
  }
  const refund = round2(inv.cost * INVEST_SELL_RATIO)
  s = updatePlayer(s, loc.playerId, (pl) => ({
    ...pl,
    cash: round2(pl.cash + refund),
    investments: pl.investments.filter((i) => i.id !== investmentId),
  }))
  if (s.pendingExchange) {
    s = { ...s, pendingExchange: { ...s.pendingExchange, screen: 'funds' } }
  }
  return pushLog(s, `${p.name} 卖出「${inv.name}」，回笼 ${refund} 万。`)
}

/** @deprecated 改为进入赌场会话 */
function locationGamble(state: GameState, _bet: number): GameState {
  return casinoAiStep(casinoEnter(state))
}

function boostRelationById(
  state: GameState,
  playerId: string,
  relationId: string,
  amount: number,
): GameState {
  return updatePlayer(state, playerId, (p) => ({
    ...p,
    relations: p.relations.map((r) => {
      if (r.id !== relationId) return r
      const score = Math.max(0, Math.min(100, r.score + amount))
      let status = r.status
      if (score <= 10 && amount < 0) status = 'broken'
      if (r.kind === 'romance' && score >= 80 && status === 'dating') status = 'engaged'
      return {
        ...r,
        score,
        status,
        locked: status === 'partner' || status === 'married' || status === 'engaged' || r.locked,
      }
    }),
  }))
}

function completeDate(
  state: GameState,
  playerId: string,
  relationId: string,
  venueId: string,
): GameState {
  const player = state.players.find((p) => p.id === playerId)
  if (!player || player.actionPoints <= 0) return state
  const rel = dateableRelations(player).find((r) => r.id === relationId)
  const venue = dateVenueById(venueId)
  if (!rel || !venue) return state
  if (player.cash + 1e-9 < venue.cost) {
    return pushLog(state, `现金不足，去不了「${venue.name}」。`)
  }
  const boost = dateBoostFor(player, venue, rel)
  let s = updatePlayer(state, playerId, (p) => ({
    ...p,
    actionPoints: p.actionPoints - 1,
    cash: round2(p.cash - venue.cost),
  }))
  s = boostRelationById(s, playerId, relationId, boost)
  s = markMaintained(s, playerId, relationId)
  s = { ...s, pendingDate: null }
  const verb = rel.kind === 'romance' ? '约会' : '交友'
  return pushLog(s, `${player.name} 和「${rel.name}」${verb}：${venue.name}（好感+${boost}）。`)
}

function startDateAction(state: GameState): GameState {
  const player = state.players[state.turnPlayerIndex]
  const candidates = dateableRelations(player)
  if (!candidates.length) {
    return pushLog(state, `${player.name} 还没有可约会·交友的对象。`)
  }
  const instant = !player.isHuman || state.autoEnabled
  if (instant) {
    const pick = pickAiDate(player)
    if (!pick) return pushLog(state, `${player.name} 现金不足，约不出去。`)
    return completeDate(state, player.id, pick.relationId, pick.venueId)
  }
  return {
    ...state,
    pendingDate: { playerId: player.id, step: 'pickPartner' },
  }
}

function datePickPartner(state: GameState, relationId: string): GameState {
  if (!state.pendingDate || state.pendingDate.step !== 'pickPartner') return state
  const player = state.players.find((p) => p.id === state.pendingDate!.playerId)
  if (!player) return state
  if (!dateableRelations(player).some((r) => r.id === relationId)) return state
  return {
    ...state,
    pendingDate: { playerId: player.id, step: 'pickVenue', relationId },
  }
}

function dateConfirmVenue(state: GameState, venueId: string): GameState {
  if (!state.pendingDate || state.pendingDate.step !== 'pickVenue' || !state.pendingDate.relationId) {
    return state
  }
  return completeDate(state, state.pendingDate.playerId, state.pendingDate.relationId, venueId)
}

function dateCancel(state: GameState): GameState {
  if (!state.pendingDate) return state
  return pushLog({ ...state, pendingDate: null }, '取消了约会·交友安排。')
}

function resolvePendingDateAuto(state: GameState): GameState {
  const pd = state.pendingDate
  if (!pd) return state
  const player = state.players.find((p) => p.id === pd.playerId)
  if (!player) return { ...state, pendingDate: null }
  if (pd.step === 'pickPartner') {
    const list = dateableRelations(player)
    if (!list.length) return dateCancel(state)
    const best = [...list].sort((a, b) => b.score - a.score)[0]
    return datePickPartner(state, best.id)
  }
  const affordable = DATE_VENUES.filter((v) => player.cash + 1e-9 >= v.cost)
  if (!affordable.length || !pd.relationId) return dateCancel(state)
  const venue = [...affordable].sort((a, b) => b.cost - a.cost)[0]
  return dateConfirmVenue(state, venue.id)
}

function spendAction(state: GameState, action: 'date'): GameState {
  const player = state.players[state.turnPlayerIndex]
  if (
    player.actionPoints <= 0 ||
    state.pendingEvent ||
    state.pendingDecision ||
    state.pendingDate ||
    state.moveAnimation ||
    state.slotSpin ||
    state.pendingLocation
  ) {
    return state
  }

  if (action === 'date') return startDateAction(state)
  return state
}

function endTurn(state: GameState): GameState {
  if (
    state.pendingEvent ||
    state.pendingDecision ||
    state.pendingDate ||
    state.moveAnimation ||
    state.slotSpin ||
    state.pendingLocation
  ) {
    return state
  }

  const ending = state.players[state.turnPlayerIndex]
  const rng = createRng(state.rngState)
  const trained = tickTraining(ending, () => rng.next())
  const decayed = decayPlayerRelations(trained.player, ending.maintainedRelationIds ?? [])
  const afterCooldown: typeof decayed.player = {
    ...decayed.player,
    poachCooldown: Math.max(0, (decayed.player.poachCooldown ?? 0) - 1),
    maintainedRelationIds: [],
  }
  let s: GameState = {
    ...state,
    rngState: rng.state(),
    players: state.players.map((p) => (p.id === ending.id ? afterCooldown : p)),
  }
  for (const line of trained.logs) {
    s = pushLog(s, `${ending.name}：${line}`)
  }
  if (decayed.brokenNames.length) {
    s = pushLog(s, `${ending.name} 与 ${decayed.brokenNames.join('、')} 疏于维护，关系破裂。`)
  } else if (decayed.cooled) {
    s = pushLog(s, `${ending.name} 的人际关系略有降温（疏于维护）。`)
  } else if ((ending.maintainedRelationIds ?? []).length) {
    s = pushLog(s, `${ending.name} 本回合有维护关系，部分人情未降温。`)
  }

  let nextIndex = s.turnPlayerIndex + 1

  if (nextIndex >= s.players.length) {
    nextIndex = 0
    let seasonIndex = s.seasonIndex + 1
    let age = s.age
    if (seasonIndex >= 4) {
      seasonIndex = 0
      age += 1
    }
    s = {
      ...s,
      seasonIndex,
      age,
      turnPlayerIndex: 0,
      turnRolled: false,
      players: s.players.map((p) => ({ ...p, actionPoints: ACTION_POINTS_PER_SEASON })),
    }
    s = pushLog(s, `—— ${age} 岁 · ${SEASONS[seasonIndex]} ——`)
    if (age > state.endAge) {
      return {
        ...s,
        phase: 'settlement',
        pendingEvent: null,
        pendingDecision: null,
        pendingLocation: null,
        deferredLocation: null,
        pendingDate: null,
        pendingCasino: null,
        pendingVisitShop: null,
        pendingExchange: null,
        moveAnimation: null,
        slotSpin: null,
      }
    }
  } else {
    s = { ...s, turnPlayerIndex: nextIndex, turnRolled: false }
  }

  const current = s.players[s.turnPlayerIndex]
  if (canPromote(current) && current.track === 'worker') {
    if (current.isHuman) s = { ...s, pendingDecision: { type: 'promote', playerId: current.id } }
    else s = promote(s, current.id)
  }
  return s
}

export function isCriticalPending(state: GameState): boolean {
  if (!state.pendingDecision) return false
  const t = state.pendingDecision.type
  if (state.autoSensitivity === 'low') return t === 'bankrupt' || t === 'poach'
  if (state.autoSensitivity === 'high') return true
  return t === 'promote' || t === 'marriage' || t === 'bigSpend' || t === 'poach' || t === 'bankrupt'
}

function pickSpend(_p: PlayerState): 'date' {
  return 'date'
}

/** One atomic auto step */
export function autoStep(state: GameState): GameState {
  if (state.phase !== 'playing') return state

  if (state.slotSpin) {
    return finishSlot(state)
  }

  // Skip walk animation in auto/AI
  if (state.moveAnimation) {
    return finishMove(state)
  }

  if (state.pendingDecision) {
    const d = state.pendingDecision
    const ownerId = d.playerId
    const owner = state.players.find((p) => p.id === ownerId)
    if (owner?.isHuman && isCriticalPending(state)) return state
    if (d.type === 'promote') {
      let s = promote({ ...state, pendingDecision: null }, d.playerId)
      return releaseDeferredLocation(s)
    }
    if (d.type === 'marriage') return marry({ ...state, pendingDecision: null }, d.playerId, d.relationId, true)
    if (d.type === 'bigSpend') return reduce({ ...state }, { type: 'CONFIRM_BIG_SPEND', accept: owner?.aiStyle === 'aggressive' })
    if (d.type === 'poach') return reduce({ ...state }, { type: 'CONFIRM_POACH', accept: false })
    if (d.type === 'bankrupt') return reduce({ ...state }, { type: 'RESOLVE_BANKRUPT' })
    return state
  }

  if (state.pendingEvent) {
    const p = state.players.find((x) => x.id === state.pendingEvent!.playerId)
    if (p?.isHuman && !state.autoEnabled) return state
    const event = EVENTS.find((e) => e.id === state.pendingEvent!.eventId)
    if (!event || !p) return resolveEventChoice(state, 'accept')
    return resolveEventChoice(state, pickEventChoice(event, p))
  }

  if (state.pendingDate) {
    const p = state.players.find((x) => x.id === state.pendingDate!.playerId)
    if (p?.isHuman && !state.autoEnabled) return state
    return resolvePendingDateAuto(state)
  }

  if (state.pendingLocation) {
    const p = state.players.find((x) => x.id === state.pendingLocation!.playerId)
    if (p?.isHuman && !state.autoEnabled) return state
    return applyAiLocation(state)
  }

  const current = state.players[state.turnPlayerIndex]
  if (current.isHuman && !state.autoEnabled) return state

  let s = state
  if (current.actionPoints > 0) s = spendAction(s, pickSpend(current))
  if (
    !s.pendingEvent &&
    !s.pendingDecision &&
    !s.pendingDate &&
    !s.moveAnimation &&
    !s.slotSpin &&
    !s.pendingLocation
  ) {
    s = rollAndMove(s)
  }
  if (s.slotSpin) s = finishSlot(s)
  if (s.moveAnimation) s = finishMove(s)
  if (s.pendingDate && (!current.isHuman || s.autoEnabled)) s = resolvePendingDateAuto(s)
  if (s.pendingEvent && (!current.isHuman || s.autoEnabled)) {
    const ev = EVENTS.find((e) => e.id === s.pendingEvent!.eventId)
    const pl = s.players.find((x) => x.id === s.pendingEvent!.playerId)
    if (ev && pl) s = resolveEventChoice(s, pickEventChoice(ev, pl))
    else s = resolveEventChoice(s, 'accept')
  }
  if (s.pendingLocation && (!current.isHuman || s.autoEnabled)) {
    s = applyAiLocation(s)
  }
  if (
    !s.pendingEvent &&
    !s.pendingDecision &&
    !s.pendingDate &&
    !s.moveAnimation &&
    !s.slotSpin &&
    !s.pendingLocation
  ) {
    s = endTurn(s)
  }
  return s
}

export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'NEW_GAME':
      return createGame({ seatCount: action.seatCount, seed: action.seed, endAge: action.endAge })
    case 'LOAD_STATE':
      return action.state
    case 'CHOOSE_CAREER':
      return chooseCareer(state, action.careerId)
    case 'ROLL_AND_MOVE':
      return rollAndMove(state)
    case 'FINISH_SLOT':
      return finishSlot(state)
    case 'ANIM_STEP':
      return animStep(state)
    case 'FINISH_MOVE':
      return finishMove(state)
    case 'RESOLVE_EVENT_CHOICE':
      return resolveEventChoice(state, action.choiceId)
    case 'LOCATION_BUY_VACANT':
      return locationBuyVacant(state, action.relationId)
    case 'LOCATION_BUY_ITEM':
      return locationBuyItem(state, action.itemId)
    case 'LOCATION_POACH':
      return locationPoach(state)
    case 'OFFICE_RECOMMEND':
      return officeRecommend(state, action.kind)
    case 'OFFICE_ADJUST':
      return officeAdjust(state, action.ownerId, action.relationId, action.direction)
    case 'OFFICE_POACH':
      return officePoach(state, action.targetPlayerId, action.relationId)
    case 'LOCATION_UPGRADE_SHOP':
      return locationUpgradeShop(state, action.shopId)
    case 'LOCATION_REBIND_OPERATOR':
      return locationRebindOperator(state, action.shopId, action.relationId)
    case 'SHOP_ADD_STAFF':
      return shopAddStaff(state, action.shopId, action.relationId)
    case 'SHOP_REMOVE_STAFF':
      return shopRemoveStaff(state, action.shopId, action.relationId)
    case 'SHOP_SET_MANAGER':
      return shopSetManager(state, action.shopId, action.relationId)
    case 'TRAIN_START':
      return trainStart(state, action.relationId, action.skillId)
    case 'LOCATION_PARK_REST':
      return locationParkRest(state)
    case 'LOCATION_PARK_CHAT':
      return locationParkChat(state, action.relationId)
    case 'LOCATION_BUY_INVEST':
      return locationBuyInvest(state, action.offerId)
    case 'LOCATION_SELL_INVEST':
      return locationSellInvest(state, action.investmentId)
    case 'LOCATION_GAMBLE':
      return locationGamble(state, action.bet)
    case 'CASINO_ENTER':
      return casinoEnter(state)
    case 'CASINO_LEAVE':
      return pushLog(casinoLeave(state), '离开赌场。')
    case 'CASINO_LOBBY':
      return casinoLobby(state)
    case 'CASINO_OPEN':
      return casinoOpen(state, action.game)
    case 'CASINO_BACARAT_BET':
      return casinoBaccaratBet(state, action.betKind, action.amount)
    case 'CASINO_DICE_BET':
      return casinoDiceBet(state, action.line, action.amount, action.fieldAmount ?? 0)
    case 'CASINO_DICE_ROLL':
      return casinoDiceRoll(state)
    case 'CASINO_BJ_BET':
      return casinoBjBet(state, action.amount)
    case 'CASINO_BJ_INSURANCE':
      return casinoBjInsurance(state, action.take)
    case 'CASINO_BJ_HIT':
      return casinoBjHit(state)
    case 'CASINO_BJ_STAND':
      return casinoBjStand(state)
    case 'CASINO_BJ_DOUBLE':
      return casinoBjDouble(state)
    case 'CASINO_BJ_SPLIT':
      return casinoBjSplit(state)
    case 'CASINO_BJ_NEXT':
      return casinoBjNext(state)
    case 'VISIT_PAY':
      return visitPay(state)
    case 'VISIT_TALK':
      return visitTalk(state)
    case 'VISIT_PICK_STAFF':
      return visitPickStaff(state, action.relationId)
    case 'VISIT_GIFT':
      return visitGift(state, action.giftId)
    case 'VISIT_SKIP_GIFT':
      return visitSkipGift(state)
    case 'VISIT_POACH_SPIN':
      return visitPoachSpin(state, transferRelation)
    case 'VISIT_SKIP_POACH':
      return visitSkipPoach(state)
    case 'VISIT_LEAVE':
      return visitLeave(state)
    case 'EXCHANGE_ENTER':
      return exchangeEnter(state)
    case 'EXCHANGE_LEAVE':
      return pushLog(exchangeLeave(state), '离开交易所。')
    case 'EXCHANGE_LOBBY':
      return exchangeLobby(state)
    case 'EXCHANGE_OPEN_FUNDS':
      return exchangeOpenFunds(state)
    case 'EXCHANGE_OPEN_TRADE':
      return exchangeOpenTrade(state, action.stake)
    case 'EXCHANGE_TICK':
      return exchangeTick(state)
    case 'EXCHANGE_BUY':
      return exchangeBuy(state, action.symbolId, action.amount)
    case 'EXCHANGE_SELL':
      return exchangeSell(state, action.symbolId, action.qtyRatio ?? 1)
    case 'EXCHANGE_SET_LEVERAGE':
      return exchangeSetLeverage(state, action.leverage)
    case 'EXCHANGE_CLOSE':
      return exchangeClose(state)
    case 'LOCATION_SKIP':
      return pushLog(clearLocation(state), '离开此地，什么也没做。')
    case 'SPEND_ACTION':
      return spendAction(state, action.action)
    case 'DATE_PICK_PARTNER':
      return datePickPartner(state, action.relationId)
    case 'DATE_CONFIRM_VENUE':
      return dateConfirmVenue(state, action.venueId)
    case 'DATE_CANCEL':
      return dateCancel(state)
    case 'PROMOTE_TO_INVESTOR': {
      if (state.pendingDecision?.type !== 'promote') return state
      const s = promote({ ...state, pendingDecision: null }, state.pendingDecision.playerId)
      return releaseDeferredLocation(s)
    }
    case 'SKIP_PROMOTE': {
      const s = pushLog({ ...state, pendingDecision: null }, '你选择暂时留在打工人圈。')
      return releaseDeferredLocation(s)
    }
    case 'CONFIRM_MARRIAGE': {
      if (state.pendingDecision?.type !== 'marriage') return state
      const d = state.pendingDecision
      const s = marry({ ...state, pendingDecision: null }, d.playerId, d.relationId, action.accept)
      return releaseDeferredLocation(s)
    }
    case 'CONFIRM_BIG_SPEND': {
      if (state.pendingDecision?.type !== 'bigSpend') return state
      const d = state.pendingDecision
      let s: GameState = { ...state, pendingDecision: null }
      if (!action.accept) {
        s = pushLog(s, `放弃了「${d.name}」。`)
        return releaseDeferredLocation(s)
      }
      const p = s.players.find((x) => x.id === d.playerId)!
      if (p.cash < d.cost) {
        s = pushLog(s, '现金不足。')
        return releaseDeferredLocation(s)
      }
      if (d.investmentId.startsWith('shop-')) {
        const rng = createRng(s.rngState)
        s = buyShop(
          s,
          d.playerId,
          { type: 'offerShop', name: d.name, baseCashflow: d.cashflow, cost: d.cost },
          () => rng.next(),
        )
        s = { ...s, rngState: rng.state() }
        return releaseDeferredLocation(s)
      }
      s = updatePlayer(s, d.playerId, (pl) => ({
        ...pl,
        cash: round2(pl.cash - d.cost),
        investments: [
          ...pl.investments,
          { id: d.investmentId, name: d.name, cost: d.cost, cashflow: d.cashflow },
        ],
      }))
      s = pushLog(s, `${p.name} 购入「${d.name}」。`)
      return releaseDeferredLocation(s)
    }
    case 'CONFIRM_POACH': {
      if (state.pendingDecision?.type !== 'poach') return state
      const d = state.pendingDecision
      let s: GameState = { ...state, pendingDecision: null }
      if (!action.accept) {
        s = updatePlayer(s, d.playerId, (p) => ({
          ...p,
          cash: round2(p.cash - 0.15),
          relations: p.relations.map((r) =>
            r.id === d.relationId ? { ...r, score: Math.min(100, r.score + 5) } : r,
          ),
        }))
        s = pushLog(s, '你花力气留住了关系。')
        return releaseDeferredLocation(s)
      }
      return releaseDeferredLocation(transferRelation(s, d.playerId, d.fromPlayerId, d.relationId))
    }
    case 'RESOLVE_BANKRUPT': {
      if (state.pendingDecision?.type !== 'bankrupt') return state
      const d = state.pendingDecision
      let s: GameState = { ...state, pendingDecision: null }
      s = updatePlayer(s, d.playerId, (p) => ({
        ...p,
        cash: 0,
        liabilities: round2(p.liabilities + d.amount),
        investments: p.investments.slice(0, Math.max(0, p.investments.length - 1)),
      }))
      s = pushLog(s, '负债续命：变卖一笔投资，记账负债。')
      return releaseDeferredLocation(s)
    }
    case 'END_TURN':
      return endTurn(state)
    case 'SET_AUTO':
      return { ...state, autoEnabled: action.enabled }
    case 'SET_SENSITIVITY':
      return { ...state, autoSensitivity: action.value }
    case 'AUTO_STEP':
      return autoStep(state)
    default:
      return state
  }
}
