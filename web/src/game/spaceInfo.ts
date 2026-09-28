import { SPACE_LABELS, buildTrack } from './board'
import {
  PARK_CHAT_BOOST,
  PARK_REST_CASH,
  VACANT_COST,
  VACANT_HIRE_EXTRA,
} from './location'
import { findShopAt } from './visitShop'
import type { GameState, SpaceKind, Track } from './types'

export type SpaceKindInfo = { title: string; description: string }

export const SPACE_KIND_INFO: Record<SpaceKind, SpaceKindInfo> = {
  payday: {
    title: SPACE_LABELS.payday,
    description: '经过或停在此格时结算工资与固定支出。本格没有额外落点菜单。',
  },
  vacant: {
    title: SPACE_LABELS.vacant,
    description: `可花费约 ${VACANT_COST} 万开店；无合适关系人时另付雇工费约 ${VACANT_HIRE_EXTRA} 万。已有店铺时，他人踩到可探店互动。`,
  },
  shop: {
    title: SPACE_LABELS.shop,
    description: '购买礼物、课程等消耗品，提升关系或小幅强化自身。',
  },
  office: {
    title: SPACE_LABELS.office,
    description: '私人事务所：推荐好友、调节好感、挖角对手关系人。',
  },
  manage: {
    title: SPACE_LABELS.manage,
    description: '经营区：管理己方店铺编制、升级与经营事项。',
  },
  park: {
    title: SPACE_LABELS.park,
    description: `公园：休息回血（现金约 +${PARK_REST_CASH} 万），或与关系人聊天（好感 +${PARK_CHAT_BOOST}）。`,
  },
  invest: {
    title: SPACE_LABELS.invest,
    description: '投资所：买入或卖出理财/标的（投资人圈选项更全）。',
  },
  casino: {
    title: SPACE_LABELS.casino,
    description: '赌场：用现金参与小游戏下注娱乐。',
  },
}

export type SpaceDetail = {
  track: Track
  index: number
  kind: SpaceKind
  headline: string
  description: string
  facts: string[]
}

function trackLabel(track: Track): string {
  return track === 'worker' ? '打工人圈' : '投资人圈'
}

function occupantLabel(isHuman: boolean, name: string): string {
  return isHuman ? '你' : name
}

export function buildSpaceDetail(state: GameState, track: Track, index: number): SpaceDetail {
  const spaces = buildTrack(track)
  const space = spaces[index]
  const kind = space?.kind ?? 'vacant'
  const info = SPACE_KIND_INFO[kind]
  const occupants = state.players.filter((p) => p.track === track && p.position === index)
  const stand =
    occupants.length === 0
      ? '站在此格：无人'
      : `站在此格：${occupants.map((p) => occupantLabel(p.isHuman, p.name)).join('、')}`

  const facts: string[] = []
  if (kind === 'vacant') {
    const owned = findShopAt(state.players, track, index)
    if (owned) {
      const owner = state.players.find((p) => p.id === owned.ownerId)
      facts.push(`店铺：${owned.shop.name}（老板：${owner?.name ?? '未知'}）`)
    } else {
      facts.push('尚未开店')
    }
  }
  facts.push(stand)

  return {
    track,
    index,
    kind,
    headline: `${info.title} · ${trackLabel(track)} #${index}`,
    description: info.description,
    facts,
  }
}
