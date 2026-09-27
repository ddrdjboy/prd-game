/**
 * 真实试玩：3 局 × 每局约 50 个玩家回合，采集遥测并输出改进依据。
 * Run: npx tsx scripts/playtest50.ts
 */
import { createGame } from '../src/game/createGame'
import { reduce, autoStep, isCriticalPending } from '../src/game/reduce'
import { calcFinance, isFinanciallyFree } from '../src/game/finance'
import { canAffordChoice, choiceCashCost, getEvent } from '../src/game/events'
import { EXCHANGE_STAKES } from '../src/game/exchange'
import { VACANT_COST } from '../src/game/location'
import { canAssignToShop } from '../src/game/shopStaff'
import type { GameState, PlayerState } from '../src/game/types'

type Snapshot = {
  humanTurns: number
  age: number
  season: number
  cash: number
  netWorth: number
  passive: number
  expense: number
  freeProgress: number
  track: string
  shops: number
  investments: number
  relations: number
  broken: number
}

type RunReport = {
  seed: number
  humanTurns: number
  steps: number
  stuck: boolean
  stuckReason?: string
  finalAge: number
  finalSeason: number
  phase: string
  free: boolean
  track: string
  cash: number
  netWorth: number
  passive: number
  expense: number
  freeProgress: number
  shops: number
  investments: number
  relations: number
  locationCounts: Record<string, number>
  eventSkips: number
  eventPaid: number
  bankruptcies: number
  promotions: number
  visitSessions: number
  exchangeSessions: number
  casinoSessions: number
  negativeCashTicks: number
  minCash: number
  maxCash: number
  cashAtTurn10: number | null
  cashAtTurn25: number | null
  cashAtTurn50: number | null
  issues: string[]
  lastLogs: string[]
  curve: Snapshot[]
}

function fp(s: GameState): string {
  return [
    s.phase,
    s.age,
    s.seasonIndex,
    s.turnPlayerIndex,
    s.pendingEvent?.eventId ?? '-',
    s.pendingDecision?.type ?? '-',
    s.pendingLocation?.spaceKind ?? '-',
    s.pendingExchange?.screen ?? '-',
    s.pendingVisitShop?.step ?? '-',
    s.pendingCasino?.screen ?? '-',
    s.pendingDate?.step ?? '-',
    s.slotSpin ? 'spin' : '-',
    s.moveAnimation ? 'move' : '-',
    s.players.map((p) => `${p.cash.toFixed(2)}`).join('|'),
  ].join('#')
}

function humanPending(s: GameState): boolean {
  const hid = s.players[0]?.id
  if (!hid) return false
  if (s.pendingEvent?.playerId === hid) return true
  if (s.pendingDecision?.playerId === hid) return true
  if (s.pendingDate?.playerId === hid) return true
  if (s.pendingLocation?.playerId === hid) return true
  if (s.pendingExchange?.playerId === hid) return true
  if (s.pendingVisitShop?.playerId === hid) return true
  if (s.pendingCasino?.playerId === hid) return true
  return false
}

/** 扮演偏积极的真人：能买就买，探店/交易所浅尝辄止 */
function resolveHuman(s: GameState, stats: RunReport): GameState {
  if (s.pendingEvent) {
    const ev = getEvent(s.pendingEvent.eventId)
    const p = s.players.find((x) => x.id === s.pendingEvent!.playerId)
    if (!ev || !p) return reduce(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: '__skip__' })
    const ranked = [...ev.choices].sort(
      (a, b) => choiceCashCost(b.effects) - choiceCashCost(a.effects),
    )
    for (const ch of ranked) {
      if (canAffordChoice(p.cash, ch.effects)) {
        if (choiceCashCost(ch.effects) > 0) stats.eventPaid++
        return reduce(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: ch.id })
      }
    }
    stats.eventSkips++
    return reduce(s, { type: 'RESOLVE_EVENT_CHOICE', choiceId: '__skip__' })
  }

  if (s.pendingDecision) {
    const d = s.pendingDecision
    if (d.type === 'promote') {
      stats.promotions++
      return reduce(s, { type: 'PROMOTE_TO_INVESTOR' })
    }
    if (d.type === 'marriage') return reduce(s, { type: 'CONFIRM_MARRIAGE', accept: true })
    if (d.type === 'bigSpend') {
      const p = s.players.find((x) => x.id === d.playerId)
      const accept = Boolean(p && p.cash + 1e-9 >= d.cost)
      return reduce(s, { type: 'CONFIRM_BIG_SPEND', accept })
    }
    if (d.type === 'poach') return reduce(s, { type: 'CONFIRM_POACH', accept: false })
    if (d.type === 'bankrupt') {
      stats.bankruptcies++
      return reduce(s, { type: 'RESOLVE_BANKRUPT' })
    }
  }

  if (s.pendingDate) {
    if (s.pendingDate.step === 'pickPartner') {
      const p = s.players.find((x) => x.id === s.pendingDate!.playerId)!
      const r = [...p.relations]
        .filter((x) => x.status !== 'broken')
        .sort((a, b) => b.score - a.score)[0]
      if (r) return reduce(s, { type: 'DATE_PICK_PARTNER', relationId: r.id })
      return reduce(s, { type: 'DATE_CANCEL' })
    }
    const p = s.players.find((x) => x.id === s.pendingDate!.playerId)!
    if (p.cash >= 0.25) return reduce(s, { type: 'DATE_CONFIRM_VENUE', venueId: 'cafe' })
    if (p.cash >= 0.05) return reduce(s, { type: 'DATE_CONFIRM_VENUE', venueId: 'park' })
    return reduce(s, { type: 'DATE_CANCEL' })
  }

  if (s.pendingVisitShop) {
    stats.visitSessions++
    const v = s.pendingVisitShop
    if (v.step === 'pay') {
      const p = s.players.find((x) => x.id === v.playerId)!
      if (p.cash + 1e-9 >= v.entryFee) {
        let n = reduce(s, { type: 'VISIT_PAY' })
        if (n.pendingVisitShop?.step === 'talkManager') n = reduce(n, { type: 'VISIT_TALK' })
        if (n.pendingVisitShop?.step === 'pickStaff') {
          const owner = n.players.find((x) => x.id === n.pendingVisitShop!.ownerId)
          const sid = owner?.shops.find((sh) => sh.id === n.pendingVisitShop!.shopId)?.staffIds[0]
          if (sid && (n.players.find((x) => x.id === v.playerId)?.cash ?? 0) >= (n.pendingVisitShop?.tipFee ?? 0)) {
            n = reduce(n, { type: 'VISIT_PICK_STAFF', relationId: sid })
          } else {
            return reduce(n, { type: 'VISIT_LEAVE' })
          }
        }
        if (n.pendingVisitShop?.step === 'gift') n = reduce(n, { type: 'VISIT_SKIP_GIFT' })
        if (n.pendingVisitShop?.step === 'poach') n = reduce(n, { type: 'VISIT_SKIP_POACH' })
        return n
      }
      return reduce(s, { type: 'VISIT_LEAVE' })
    }
    return reduce(s, { type: 'VISIT_LEAVE' })
  }

  if (s.pendingExchange) {
    stats.exchangeSessions++
    const ex = s.pendingExchange
    const p = s.players.find((x) => x.id === ex.playerId)!
    if (ex.screen === 'lobby') {
      if (ex.tradeSessionsPlayed < 1 && p.cash >= EXCHANGE_STAKES[0]) {
        let n = reduce(s, { type: 'EXCHANGE_OPEN_TRADE', stake: EXCHANGE_STAKES[0] })
        if (n.pendingExchange?.trade) {
          n = reduce(n, { type: 'EXCHANGE_BUY', symbolId: 'bluechip', amount: 0.15 })
          n = reduce(n, { type: 'EXCHANGE_TICK' })
          if (n.pendingExchange?.trade && !n.pendingExchange.trade.ended) {
            n = reduce(n, { type: 'EXCHANGE_CLOSE' })
          }
        }
        return reduce(n, { type: 'EXCHANGE_LEAVE' })
      }
      if (p.cash >= 0.8) {
        let n = reduce(s, { type: 'EXCHANGE_OPEN_FUNDS' })
        n = reduce(n, { type: 'LOCATION_BUY_INVEST', offerId: 'bond' })
        return reduce(n, { type: 'EXCHANGE_LEAVE' })
      }
      return reduce(s, { type: 'EXCHANGE_LEAVE' })
    }
    if (ex.screen === 'funds') return reduce(s, { type: 'EXCHANGE_LEAVE' })
    if (ex.screen === 'trade') {
      let n = s
      if (n.pendingExchange?.trade && !n.pendingExchange.trade.ended) {
        n = reduce(n, { type: 'EXCHANGE_CLOSE' })
      }
      return reduce(n, { type: 'EXCHANGE_LEAVE' })
    }
  }

  if (s.pendingCasino) {
    stats.casinoSessions++
    return reduce(s, { type: 'CASINO_LEAVE' })
  }

  if (s.pendingLocation) {
    const loc = s.pendingLocation
    stats.locationCounts[loc.spaceKind] = (stats.locationCounts[loc.spaceKind] ?? 0) + 1
    const p = s.players.find((x) => x.id === loc.playerId)!
    if (loc.spaceKind === 'vacant') {
      const op = p.relations.find((r) => canAssignToShop(p, r.id))
      if (op && p.cash + 1e-9 >= VACANT_COST) {
        return reduce(s, { type: 'LOCATION_BUY_VACANT', relationId: op.id })
      }
      if (p.cash + 1e-9 >= VACANT_COST + 0.15) {
        return reduce(s, { type: 'LOCATION_BUY_VACANT', relationId: '__hire__' })
      }
      return reduce(s, { type: 'LOCATION_SKIP' })
    }
    if (loc.spaceKind === 'shop') {
      if (p.cash >= 0.2) return reduce(s, { type: 'LOCATION_BUY_ITEM', itemId: 'gift' })
      return reduce(s, { type: 'LOCATION_SKIP' })
    }
    if (loc.spaceKind === 'office') {
      if (p.cash >= 0.25) return reduce(s, { type: 'OFFICE_RECOMMEND', kind: 'network' })
      return reduce(s, { type: 'LOCATION_SKIP' })
    }
    if (loc.spaceKind === 'manage') {
      if (p.shops[0] && p.cash >= 0.25) {
        return reduce(s, { type: 'LOCATION_UPGRADE_SHOP', shopId: p.shops[0].id })
      }
      return reduce(s, { type: 'LOCATION_SKIP' })
    }
    if (loc.spaceKind === 'park') return reduce(s, { type: 'LOCATION_PARK_REST' })
    if (loc.spaceKind === 'invest') {
      // attachLocation should open exchange; if not, skip
      return reduce(s, { type: 'LOCATION_SKIP' })
    }
    if (loc.spaceKind === 'casino') return reduce(s, { type: 'CASINO_LEAVE' })
    return reduce(s, { type: 'LOCATION_SKIP' })
  }

  if (s.slotSpin) return reduce(s, { type: 'FINISH_SLOT' })
  if (s.moveAnimation) return reduce(s, { type: 'FINISH_MOVE' })
  return s
}

function snap(s: GameState, humanTurns: number): Snapshot {
  const you = s.players[0]
  const f = calcFinance(you)
  return {
    humanTurns,
    age: s.age,
    season: s.seasonIndex,
    cash: you.cash,
    netWorth: f.netWorth,
    passive: f.passiveIncome,
    expense: f.totalExpense,
    freeProgress: f.freeProgress,
    track: you.track,
    shops: you.shops.length,
    investments: you.investments.length,
    relations: you.relations.filter((r) => r.status !== 'broken').length,
    broken: you.relations.filter((r) => r.status === 'broken').length,
  }
}

function playOne(seed: number, targetHumanTurns: number): RunReport {
  const stats: RunReport = {
    seed,
    humanTurns: 0,
    steps: 0,
    stuck: false,
    finalAge: 18,
    finalSeason: 0,
    phase: 'playing',
    free: false,
    track: 'worker',
    cash: 0,
    netWorth: 0,
    passive: 0,
    expense: 0,
    freeProgress: 0,
    shops: 0,
    investments: 0,
    relations: 0,
    locationCounts: {},
    eventSkips: 0,
    eventPaid: 0,
    bankruptcies: 0,
    promotions: 0,
    visitSessions: 0,
    exchangeSessions: 0,
    casinoSessions: 0,
    negativeCashTicks: 0,
    minCash: Infinity,
    maxCash: -Infinity,
    cashAtTurn10: null,
    cashAtTurn25: null,
    cashAtTurn50: null,
    issues: [],
    lastLogs: [],
    curve: [],
  }

  let s = createGame({ seatCount: 3, seed, endAge: 45, humanName: '试玩者' })
  s = reduce(s, { type: 'CHOOSE_CAREER', careerId: s.careerChoices[0].id })
  s = { ...s, autoEnabled: true, autoSensitivity: 'standard' }

  let lastFp = ''
  let same = 0
  let lastHumanEnds = 0
  const maxSteps = 12000

  for (let i = 0; i < maxSteps; i++) {
    stats.steps = i
    if (s.phase === 'settlement') break
    if (stats.humanTurns >= targetHumanTurns) break

    const you = s.players[0]
    stats.minCash = Math.min(stats.minCash, you.cash)
    stats.maxCash = Math.max(stats.maxCash, you.cash)
    if (you.cash < 0) stats.negativeCashTicks++

    const beforeEnds = countHumanEnds(s)
    const before = fp(s)
    let next: GameState

    if (humanPending(s) || (s.pendingDecision && isCriticalPending(s))) {
      next = resolveHuman(s, stats)
      if (fp(next) === before) next = autoStep(s)
    } else {
      next = autoStep(s)
      if (fp(next) === before) next = resolveHuman(s, stats)
      if (fp(next) === before) {
        const cur = next.players[next.turnPlayerIndex]
        if (
          cur.isHuman &&
          !next.pendingEvent &&
          !next.pendingDecision &&
          !next.pendingLocation &&
          !next.pendingDate &&
          !next.pendingExchange &&
          !next.pendingVisitShop &&
          !next.pendingCasino &&
          !next.slotSpin &&
          !next.moveAnimation
        ) {
          if (
            cur.actionPoints > 0 &&
            cur.relations.some((r) => r.status !== 'broken') &&
            cur.cash >= 0.05
          ) {
            next = reduce(next, { type: 'SPEND_ACTION', action: 'date' })
            next = resolveHuman(next, stats)
          } else {
            next = reduce(next, { type: 'ROLL_AND_MOVE' })
            next = resolveHuman(next, stats)
            if (next.slotSpin) next = reduce(next, { type: 'FINISH_SLOT' })
            if (next.moveAnimation) next = reduce(next, { type: 'FINISH_MOVE' })
            next = resolveHuman(next, stats)
            if (
              !next.pendingEvent &&
              !next.pendingDecision &&
              !next.pendingLocation &&
              !next.pendingDate &&
              !next.pendingExchange &&
              !next.pendingVisitShop &&
              !next.pendingCasino &&
              !next.slotSpin &&
              !next.moveAnimation
            ) {
              next = reduce(next, { type: 'END_TURN' })
            }
          }
        }
      }
    }

    const afterEnds = countHumanEnds(next)
    if (afterEnds > beforeEnds) {
      stats.humanTurns += afterEnds - beforeEnds
      const snapN = snap(next, stats.humanTurns)
      if (stats.humanTurns === 10) stats.cashAtTurn10 = snapN.cash
      if (stats.humanTurns === 25) stats.cashAtTurn25 = snapN.cash
      if (stats.humanTurns === 50) stats.cashAtTurn50 = snapN.cash
      if (stats.humanTurns % 5 === 0 || stats.humanTurns <= 3) stats.curve.push(snapN)
    }

    const nfp = fp(next)
    if (nfp === lastFp) same++
    else {
      same = 0
      lastFp = nfp
    }
    if (same > 40) {
      stats.stuck = true
      stats.stuckReason = nfp
      stats.issues.push(`stuck: ${nfp}`)
      s = next
      break
    }

    // detect money bugs
    for (const p of next.players) {
      if (!Number.isFinite(p.cash)) stats.issues.push(`NaN cash ${p.name}`)
    }

    s = next
    lastHumanEnds = afterEnds
  }

  const you = s.players[0]
  const f = calcFinance(you)
  stats.finalAge = s.age
  stats.finalSeason = s.seasonIndex
  stats.phase = s.phase
  stats.free = isFinanciallyFree(you)
  stats.track = you.track
  stats.cash = you.cash
  stats.netWorth = f.netWorth
  stats.passive = f.passiveIncome
  stats.expense = f.totalExpense
  stats.freeProgress = f.freeProgress
  stats.shops = you.shops.length
  stats.investments = you.investments.length
  stats.relations = you.relations.filter((r) => r.status !== 'broken').length
  stats.lastLogs = s.logs.slice(-12).map((l) => l.text)
  if (!Number.isFinite(stats.minCash)) stats.minCash = you.cash
  void lastHumanEnds
  return stats
}

/** 粗略：日志里「结束回合」不好找，用 age/season/turn 变化 + 玩家是 human 且刚从 pending 清空难度高。
 *  改用：每次 END_TURN 后 turnPlayerIndex 变化且上一结束者是 human → 计 1。
 *  这里用简化：记录玩家 action 后是否轮转。更稳：数 logs 中含「——」季节线与玩家自己的走动。
 */
function countHumanEnds(s: GameState): number {
  // 用日志标记：每次成功 END_TURN 会写季节线或维护日志；不可靠。
  // 改为在 play loop 里用 before/after turn index 检测。
  // 这里提供占位，实际在循环用 meta。
  return (s as GameState & { __humanEnds?: number }).__humanEnds ?? 0
}

function bumpHumanEnd(s: GameState): GameState {
  const cur = (s as GameState & { __humanEnds?: number }).__humanEnds ?? 0
  return Object.assign(s, { __humanEnds: cur }) as GameState
}

/** 重写循环：用 turn 切换检测 human 回合结束 */
function playOneV2(seed: number, targetHumanTurns: number): RunReport {
  const base = playOneSetup(seed)
  // monkey-patch: wrap END_TURN detection in the loop below by comparing turnPlayerIndex + age after clear pendings
  const stats = emptyStats(seed)
  let s = base
  let lastFp = ''
  let same = 0
  let prevTurn = s.turnPlayerIndex
  let prevAge = s.age
  let prevSeason = s.seasonIndex
  let humanWasActing = s.players[s.turnPlayerIndex]?.isHuman

  for (let i = 0; i < 12000; i++) {
    stats.steps = i
    if (s.phase === 'settlement') break
    if (stats.humanTurns >= targetHumanTurns) break

    const you = s.players[0]
    stats.minCash = Math.min(stats.minCash, you.cash)
    stats.maxCash = Math.max(stats.maxCash, you.cash)
    if (you.cash < 0) stats.negativeCashTicks++

    const before = fp(s)
    let next: GameState
    if (humanPending(s) || (s.pendingDecision && isCriticalPending(s))) {
      next = resolveHuman(s, stats)
      if (fp(next) === before) next = autoStep(s)
    } else {
      next = autoStep(s)
      if (fp(next) === before) next = resolveHuman(s, stats)
      if (fp(next) === before) {
        const cur = next.players[next.turnPlayerIndex]
        if (
          cur?.isHuman &&
          !next.pendingEvent &&
          !next.pendingDecision &&
          !next.pendingLocation &&
          !next.pendingDate &&
          !next.pendingExchange &&
          !next.pendingVisitShop &&
          !next.pendingCasino &&
          !next.slotSpin &&
          !next.moveAnimation
        ) {
          if (
            cur.actionPoints > 0 &&
            cur.relations.some((r) => r.status !== 'broken') &&
            cur.cash >= 0.05 &&
            stats.humanTurns % 3 === 0
          ) {
            next = reduce(next, { type: 'SPEND_ACTION', action: 'date' })
            next = resolveHuman(next, stats)
          } else {
            next = reduce(next, { type: 'ROLL_AND_MOVE' })
            next = resolveHuman(next, stats)
            if (next.slotSpin) next = reduce(next, { type: 'FINISH_SLOT' })
            if (next.moveAnimation) next = reduce(next, { type: 'FINISH_MOVE' })
            next = resolveHuman(next, stats)
            if (
              !next.pendingEvent &&
              !next.pendingDecision &&
              !next.pendingLocation &&
              !next.pendingDate &&
              !next.pendingExchange &&
              !next.pendingVisitShop &&
              !next.pendingCasino &&
              !next.slotSpin &&
              !next.moveAnimation
            ) {
              next = reduce(next, { type: 'END_TURN' })
            }
          }
        }
      }
    }

    // Detect human turn completed: previous actor human, and turn/season advanced
    const turned =
      next.turnPlayerIndex !== prevTurn ||
      next.age !== prevAge ||
      next.seasonIndex !== prevSeason
    if (turned && humanWasActing) {
      stats.humanTurns++
      const sn = snap(next, stats.humanTurns)
      if (stats.humanTurns === 10) stats.cashAtTurn10 = sn.cash
      if (stats.humanTurns === 25) stats.cashAtTurn25 = sn.cash
      if (stats.humanTurns === 50) stats.cashAtTurn50 = sn.cash
      if (stats.humanTurns % 5 === 0 || stats.humanTurns <= 3) stats.curve.push(sn)
    }
    prevTurn = next.turnPlayerIndex
    prevAge = next.age
    prevSeason = next.seasonIndex
    humanWasActing = next.players[next.turnPlayerIndex]?.isHuman ?? false

    const nfp = fp(next)
    if (nfp === lastFp) same++
    else {
      same = 0
      lastFp = nfp
    }
    if (same > 40) {
      stats.stuck = true
      stats.stuckReason = nfp
      stats.issues.push(`stuck: ${nfp}`)
      s = next
      break
    }
    for (const p of next.players) {
      if (!Number.isFinite(p.cash)) stats.issues.push(`NaN cash ${p.name}`)
    }
    s = next
  }

  finalize(stats, s)
  return stats
}

function playOneSetup(seed: number): GameState {
  let s = createGame({ seatCount: 3, seed, endAge: 45, humanName: '试玩者' })
  s = reduce(s, { type: 'CHOOSE_CAREER', careerId: s.careerChoices[0].id })
  return { ...s, autoEnabled: true, autoSensitivity: 'standard' }
}

function emptyStats(seed: number): RunReport {
  return {
    seed,
    humanTurns: 0,
    steps: 0,
    stuck: false,
    finalAge: 18,
    finalSeason: 0,
    phase: 'playing',
    free: false,
    track: 'worker',
    cash: 0,
    netWorth: 0,
    passive: 0,
    expense: 0,
    freeProgress: 0,
    shops: 0,
    investments: 0,
    relations: 0,
    locationCounts: {},
    eventSkips: 0,
    eventPaid: 0,
    bankruptcies: 0,
    promotions: 0,
    visitSessions: 0,
    exchangeSessions: 0,
    casinoSessions: 0,
    negativeCashTicks: 0,
    minCash: Infinity,
    maxCash: -Infinity,
    cashAtTurn10: null,
    cashAtTurn25: null,
    cashAtTurn50: null,
    issues: [],
    lastLogs: [],
    curve: [],
  }
}

function finalize(stats: RunReport, s: GameState) {
  const you = s.players[0]
  const f = calcFinance(you)
  stats.finalAge = s.age
  stats.finalSeason = s.seasonIndex
  stats.phase = s.phase
  stats.free = isFinanciallyFree(you)
  stats.track = you.track
  stats.cash = round2(you.cash)
  stats.netWorth = f.netWorth
  stats.passive = f.passiveIncome
  stats.expense = f.totalExpense
  stats.freeProgress = f.freeProgress
  stats.shops = you.shops.length
  stats.investments = you.investments.length
  stats.relations = you.relations.filter((r) => r.status !== 'broken').length
  stats.lastLogs = s.logs.slice(-10).map((l) => l.text)
  if (!Number.isFinite(stats.minCash)) stats.minCash = you.cash
  stats.minCash = round2(stats.minCash)
  stats.maxCash = round2(stats.maxCash)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

// silence unused from first draft
void playOne
void bumpHumanEnd
void countHumanEnds

const seeds = [42, 2026, 777]
const TARGET = 50
const reports = seeds.map((seed) => playOneV2(seed, TARGET))

console.log('=== 3×50 回合试玩报告 ===\n')
for (const r of reports) {
  console.log(`--- seed ${r.seed} ---`)
  console.log(
    JSON.stringify(
      {
        humanTurns: r.humanTurns,
        steps: r.steps,
        stuck: r.stuck,
        stuckReason: r.stuckReason,
        age: `${r.finalAge}.${r.finalSeason}`,
        phase: r.phase,
        track: r.track,
        cash: r.cash,
        netWorth: r.netWorth,
        passive: r.passive,
        expense: r.expense,
        freeProgress: Math.round(r.freeProgress * 100) + '%',
        free: r.free,
        shops: r.shops,
        investments: r.investments,
        relations: r.relations,
        cashCurve: {
          t10: r.cashAtTurn10,
          t25: r.cashAtTurn25,
          t50: r.cashAtTurn50,
          min: r.minCash,
          max: r.maxCash,
        },
        locations: r.locationCounts,
        events: { paid: r.eventPaid, skipped: r.eventSkips },
        sessions: {
          visit: r.visitSessions,
          exchange: r.exchangeSessions,
          casino: r.casinoSessions,
        },
        bankruptcies: r.bankruptcies,
        promotions: r.promotions,
        negativeCashTicks: r.negativeCashTicks,
        issues: r.issues,
        curve: r.curve,
        lastLogs: r.lastLogs,
      },
      null,
      2,
    ),
  )
  console.log('')
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
console.log('=== 汇总 ===')
console.log({
  avgCash50: avg(reports.map((r) => r.cash)),
  avgPassive: avg(reports.map((r) => r.passive)),
  avgFreePct: avg(reports.map((r) => r.freeProgress * 100)),
  avgShops: avg(reports.map((r) => r.shops)),
  avgInvest: avg(reports.map((r) => r.investments)),
  avgRelations: avg(reports.map((r) => r.relations)),
  stuckRuns: reports.filter((r) => r.stuck).length,
  promoted: reports.filter((r) => r.track === 'investor').length,
  totalVisits: reports.reduce((a, r) => a + r.visitSessions, 0),
  totalExchange: reports.reduce((a, r) => a + r.exchangeSessions, 0),
  totalCasino: reports.reduce((a, r) => a + r.casinoSessions, 0),
  totalBankrupt: reports.reduce((a, r) => a + r.bankruptcies, 0),
  avgEventSkipRate: avg(
    reports.map((r) => {
      const t = r.eventPaid + r.eventSkips
      return t ? r.eventSkips / t : 0
    }),
  ),
})
