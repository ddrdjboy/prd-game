import { ACTION_POINTS_PER_MONTH, MONTH_FRACTION, MONTHS } from './config'
import { calcFinance, rollShopSeason, round2 } from './finance'
import { CHARACTERS } from './portraits'
import { decayPlayerRelations } from './relations'
import { stageFromAffinity } from './affinity'
import type {
  FreeLifePlaceId,
  FreeLifeQuest,
  FreeLifeTile,
  FreeLifeVibe,
  GameState,
  PlayerState,
  Relation,
} from './types'

export type FreeLifePlaceDef = {
  id: FreeLifePlaceId
  name: string
  blurb: string
  tile: FreeLifeTile
  vibe: FreeLifeVibe
}

export const FREE_LIFE_PLACES: FreeLifePlaceDef[] = [
  // NW 水岸
  { id: 'riverside', name: '江边', blurb: '散步吹风，关系更容易拉近。', tile: 'nw', vibe: 'date' },
  { id: 'cafe', name: '咖啡馆', blurb: '闲聊、碰见熟人、听一点小道消息。', tile: 'nw', vibe: 'chat' },
  { id: 'pier', name: '码头', blurb: '船笛与晚风，适合偶遇。', tile: 'nw', vibe: 'date' },
  { id: 'bookstore', name: '独立书店', blurb: '书架后常有创作型朋友。', tile: 'nw', vibe: 'creative' },
  { id: 'teahouse', name: '茶馆', blurb: '慢聊、打听一点圈子消息。', tile: 'nw', vibe: 'chat' },
  { id: 'yoga', name: '瑜伽馆', blurb: '拉伸一下，顺便放松心情。', tile: 'nw', vibe: 'rest' },
  { id: 'flower', name: '花店', blurb: '买束花，或聊聊近况。', tile: 'nw', vibe: 'chat' },
  // NE 文创
  { id: 'gallery', name: '画廊', blurb: '展览与灵感，创作型朋友常出现。', tile: 'ne', vibe: 'creative' },
  { id: 'museum', name: '小博物馆', blurb: '安静展厅，适合叙事向对话。', tile: 'ne', vibe: 'creative' },
  { id: 'studio', name: '创作工作室', blurb: '灯还亮着，有人在赶稿。', tile: 'ne', vibe: 'creative' },
  { id: 'indieCinema', name: '独立影院', blurb: '冷场次里更容易说真心话。', tile: 'ne', vibe: 'date' },
  { id: 'craftFair', name: '手作摊', blurb: '小买卖，现金进出更随意。', tile: 'ne', vibe: 'market' },
  { id: 'cityLibrary', name: '城市书房', blurb: '安静社交，翻书也能结识人。', tile: 'ne', vibe: 'chat' },
  { id: 'skyBar', name: '天台酒廊', blurb: '夜景闲谈（不是会所对战）。', tile: 'ne', vibe: 'chat' },
  // SW 生活
  { id: 'home', name: '我家', blurb: '歇脚、整理账单、偶尔有访客上门。', tile: 'sw', vibe: 'home' },
  { id: 'market', name: '市集', blurb: '买卖波动，现金进出更频繁。', tile: 'sw', vibe: 'market' },
  { id: 'gym', name: '健身房', blurb: '出出汗，也可能碰上熟人。', tile: 'sw', vibe: 'rest' },
  { id: 'clinic', name: '社区诊所', blurb: '体检、小开销，偶尔遇见邻居。', tile: 'sw', vibe: 'home' },
  { id: 'grocery', name: '生鲜超市', blurb: '日常开销，偶尔捡漏。', tile: 'sw', vibe: 'market' },
  { id: 'greenPark', name: '街心公园', blurb: '轻松散步，约会向对话。', tile: 'sw', vibe: 'date' },
  { id: 'nightSchool', name: '社区夜校', blurb: '技能闲聊、结识新面孔。', tile: 'sw', vibe: 'chat' },
  // SE 城东
  { id: 'office', name: '旧事务所', blurb: '入股、介绍、被动收入机会。', tile: 'se', vibe: 'office' },
  { id: 'club', name: '会所', blurb: '带朋友上场，和电脑队伍打一场。', tile: 'se', vibe: 'club' },
  { id: 'privateBank', name: '私人银行', blurb: '理财会客，可能抬被动收入。', tile: 'se', vibe: 'office' },
  { id: 'hotelLobby', name: '酒店大堂', blurb: '商务闲聊、遇见出差的人。', tile: 'se', vibe: 'chat' },
  { id: 'bistro', name: '西餐厅', blurb: '请客吃饭，约会向。', tile: 'se', vibe: 'date' },
  { id: 'arcade', name: '电玩城', blurb: '小赌娱乐，现金波动。', tile: 'se', vibe: 'market' },
  { id: 'spa', name: '水疗馆', blurb: '休息充电，顺带升温。', tile: 'se', vibe: 'rest' },
]

/** 角色常驻公共地点（1–2 个）；与「好友的家」无关 */
export const CHARACTER_HOME_PLACES: Record<string, FreeLifePlaceId[]> = {
  蓝铃: ['cafe', 'flower'],
  星澜: ['gallery', 'studio'],
  涟心: ['riverside', 'indieCinema'],
  樱奈: ['teahouse', 'pier'],
  夏澄: ['market', 'craftFair'],
  炽火: ['arcade', 'office'],
  青羽: ['greenPark', 'bookstore'],
  紫砚: ['museum', 'privateBank'],
  霓可: ['skyBar', 'cafe'],
  花穗: ['gallery', 'flower'],
  冰璃: ['riverside', 'yoga'],
  茶纪: ['teahouse', 'hotelLobby'],
  沙言: ['grocery', 'market'],
  星柚: ['cityLibrary', 'studio'],
  墨探: ['office', 'privateBank'],
  糖绘: ['craftFair', 'gallery'],
  绯甲: ['gym', 'arcade'],
  珊瑚: ['pier', 'bistro'],
  雪踪: ['yoga', 'spa'],
  铜心: ['nightSchool', 'office'],
}

/** 梧桐里公寓簇（SW 区大图内局部百分比） */
export const FRIEND_HOME_CLUSTER = { left: 28, top: 24, width: 8, height: 10 }

export function placeDef(id: FreeLifePlaceId): FreeLifePlaceDef | undefined {
  return FREE_LIFE_PLACES.find((p) => p.id === id)
}

export function placeLabel(id: FreeLifePlaceId): string {
  return placeDef(id)?.name ?? id
}

export function placeVibe(id: FreeLifePlaceId): FreeLifeVibe {
  return placeDef(id)?.vibe ?? 'chat'
}

export function monthLabel(monthIndex: number): string {
  return MONTHS[((monthIndex % 12) + 12) % 12] ?? `${monthIndex + 1}月`
}

export function isFreeLife(state: GameState): boolean {
  return state.lifeMode === 'free'
}

function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

export function canShowFriendHome(r: Relation): boolean {
  return stageFromAffinity(r.affinity) !== 'hate'
}

export type FriendHomePin = {
  relationId: string
  name: string
  portraitId?: string
  left: number
  top: number
}

/** 已结识且非仇恨 → 梧桐里动态针脚 */
export function listFriendHomePins(player: PlayerState): FriendHomePin[] {
  const { left, top, width, height } = FRIEND_HOME_CLUSTER
  return player.relations.filter(canShowFriendHome).map((r) => {
    const a = hash01(r.id)
    const b = hash01(`${r.id}:y`)
    return {
      relationId: r.id,
      name: r.name,
      portraitId: r.portraitId,
      left: left + a * width,
      top: top + b * height,
    }
  })
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
