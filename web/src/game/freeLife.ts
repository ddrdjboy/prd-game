import { ACTION_POINTS_PER_MONTH, MONTH_FRACTION, MONTHS } from './config'
import { calcFinance, rollShopSeason, round2 } from './finance'
import { CHARACTERS } from './portraits'
import { decayPlayerRelations } from './relations'
import type {
  FreeLifePlaceId,
  FreeLifeQuest,
  GameState,
  PlayerState,
} from './types'

export const FREE_LIFE_PLACES: {
  id: FreeLifePlaceId
  name: string
  blurb: string
}[] = [
  { id: 'home', name: '家', blurb: '歇脚、整理账单、偶尔有访客上门。' },
  { id: 'cafe', name: '咖啡馆', blurb: '闲聊、碰见熟人、听一点小道消息。' },
  { id: 'riverside', name: '江边', blurb: '散步吹风，关系更容易拉近。' },
  { id: 'gallery', name: '画廊', blurb: '展览与灵感，创作型朋友常出现。' },
  { id: 'market', name: '市集', blurb: '买卖波动，现金进出更频繁。' },
  { id: 'office', name: '旧事务所', blurb: '入股、介绍、被动收入机会。' },
  { id: 'club', name: '会所', blurb: '带朋友上场，和电脑队伍打一场。' },
]

/** 角色常驻地点（1–2 个） */
export const CHARACTER_HOME_PLACES: Record<string, FreeLifePlaceId[]> = {
  蓝铃: ['home', 'cafe'],
  星澜: ['gallery', 'riverside'],
  涟心: ['riverside', 'gallery'],
  樱奈: ['cafe', 'riverside'],
  夏澄: ['market', 'cafe'],
  炽火: ['market', 'office'],
  青羽: ['riverside', 'home'],
  紫砚: ['gallery', 'office'],
  霓可: ['cafe', 'market'],
  花穗: ['gallery', 'cafe'],
  冰璃: ['riverside', 'home'],
  茶纪: ['cafe', 'office'],
  沙言: ['market', 'riverside'],
  星柚: ['gallery', 'home'],
  墨探: ['office', 'gallery'],
  糖绘: ['cafe', 'gallery'],
  绯甲: ['market', 'office'],
  珊瑚: ['riverside', 'market'],
  雪踪: ['riverside', 'home'],
  铜心: ['office', 'market'],
}

export function placeLabel(id: FreeLifePlaceId): string {
  return FREE_LIFE_PLACES.find((p) => p.id === id)?.name ?? id
}

export function monthLabel(monthIndex: number): string {
  return MONTHS[((monthIndex % 12) + 12) % 12] ?? `${monthIndex + 1}月`
}

export function isFreeLife(state: GameState): boolean {
  return state.lifeMode === 'free'
}

export function enterFreeLife(state: GameState): GameState {
  const humanIdx = state.players.findIndex((p) => p.isHuman)
  const human = humanIdx >= 0 ? state.players[humanIdx] : null
  const players = state.players.map((p) => ({
    ...p,
    track: 'worker' as const,
    actionPoints: p.isHuman ? ACTION_POINTS_PER_MONTH : 0,
    maintainedRelationIds: [],
  }))
  return {
    ...state,
    lifeMode: 'free',
    monthIndex: state.monthIndex ?? Math.min(11, (state.seasonIndex ?? 0) * 3),
    questFlags: state.questFlags ?? [],
    pendingFreeScene: null,
    pendingClub: null,
    pendingEvent: null,
    pendingDecision: null,
    pendingLocation: null,
    deferredLocation: null,
    pendingDate: null,
    pendingCasino: null,
    pendingVisitShop: null,
    pendingExchange: null,
    slotSpin: null,
    moveAnimation: null,
    turnRolled: true,
    turnPlayerIndex: humanIdx >= 0 ? humanIdx : 0,
    players,
    logs: [
      ...state.logs,
      {
        id: `log${state.logs.length}`,
        text: `${human?.name ?? '你'} 摸到了财富自由。棋盘收起，自由生活开始。`,
      },
    ].slice(-80),
  }
}

/** 月结现金流：季值 × 1/3 */
export function applyMonthlyCashflow(
  player: PlayerState,
  monthIndex: number,
  rng: () => number,
): { player: PlayerState; delta: number; log: string } {
  const seasonProxy = Math.floor(monthIndex / 3) % 4
  const rolled = rollShopSeason(player, seasonProxy, rng)
  const withShops = { ...player, shops: rolled.shops }
  const f = calcFinance(withShops)
  const delta = round2(f.seasonalCashflow * MONTH_FRACTION)
  const cash = round2(Math.max(0, withShops.cash + delta))
  const next = { ...withShops, cash }
  const log = `${player.name} 月结现金流 ${delta >= 0 ? '+' : ''}${delta} 万（现金 ${cash}）`
  return { player: next, delta, log }
}

export function closeFreeMonth(state: GameState, rng: () => number): GameState {
  const payLogs: string[] = []
  const players = state.players.map((p) => {
    const paid = applyMonthlyCashflow(p, state.monthIndex, rng)
    payLogs.push(paid.log)
    if (!p.isHuman) {
      return { ...paid.player, actionPoints: 0, maintainedRelationIds: [] }
    }
    const decayed = decayPlayerRelations(
      paid.player,
      p.maintainedRelationIds ?? [],
      MONTH_FRACTION,
    )
    return {
      ...decayed.player,
      actionPoints: ACTION_POINTS_PER_MONTH,
      maintainedRelationIds: [],
    }
  })

  let age = state.age
  let monthIndex = state.monthIndex + 1
  if (monthIndex >= 12) {
    monthIndex = 0
    age += 1
  }

  const logs = [
    ...state.logs,
    ...payLogs.map((text, i) => ({ id: `log${state.logs.length + i}`, text })),
    {
      id: `log${state.logs.length + payLogs.length}`,
      text: `—— ${age} 岁 · ${monthLabel(monthIndex)} ——`,
    },
  ].slice(-80)

  let s: GameState = {
    ...state,
    age,
    monthIndex,
    seasonIndex: Math.floor(monthIndex / 3) % 4,
    players,
    pendingFreeScene: null,
    pendingClub: null,
    turnRolled: true,
    turnPlayerIndex: state.players.findIndex((p) => p.isHuman),
    logs,
  }

  if (age > state.endAge) {
    return {
      ...s,
      phase: 'settlement',
      settlementReason: 'age',
      pendingFreeScene: null,
      pendingClub: null,
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
  return s
}

export function charactersAtPlace(
  placeId: FreeLifePlaceId,
  player: PlayerState,
): { name: string; portraitId: string; met: boolean }[] {
  const out: { name: string; portraitId: string; met: boolean }[] = []
  for (const c of CHARACTERS) {
    const homes = CHARACTER_HOME_PLACES[c.name] ?? []
    if (!homes.includes(placeId)) continue
    const met = player.relations.some((r) => r.name === c.name || r.portraitId === c.portraitId)
    out.push({ name: c.name, portraitId: c.portraitId, met })
  }
  return out
}

export function upsertQuest(flags: FreeLifeQuest[], quest: FreeLifeQuest): FreeLifeQuest[] {
  const rest = flags.filter((q) => q.id !== quest.id)
  return [...rest, quest].slice(0, 5)
}

export function clearQuest(flags: FreeLifeQuest[], id: string): FreeLifeQuest[] {
  return flags.filter((q) => q.id !== id)
}
