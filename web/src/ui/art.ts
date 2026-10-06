import { placeVibe } from '../game/freeLife'
import type { EventKind, FreeLifePlaceId, FreeLifeVibe, SpaceKind } from '../game/types'

/** 场景插画：文件位于 web/public/art/，仅供展示层使用 */
const art = (name: string) => `${import.meta.env.BASE_URL}art/${name}.jpg`

export const HOME_ART = art('home-hero')
export const PLAY_ART = art('play-bg')
export const SETTLE_FREE_ART = art('settle-free')
export const SETTLE_GRIND_ART = art('settle-grind')
/** @deprecated 单张旧图；总览改用 FREE_LIFE_WORLD_ART，分区仍用四切片 */
export const FREE_LIFE_MAP = art('free-life-map')

/** 自由生活无缝世界图总览 */
export const FREE_LIFE_WORLD_ART = art('free-life-world')

export const FREE_LIFE_MAP_TILE_ART = {
  nw: art('free-life-map-nw'),
  ne: art('free-life-map-ne'),
  sw: art('free-life-map-sw'),
  se: art('free-life-map-se'),
} as const

export const SPACE_ART: Record<SpaceKind, string> = {
  payday: art('space-payday'),
  vacant: art('space-vacant'),
  shop: art('space-shop'),
  office: art('space-office'),
  manage: art('space-manage'),
  park: art('space-park'),
  invest: art('space-invest'),
  casino: art('space-casino'),
}

export const VENUE_ART: Record<string, string> = {
  chat: art('venue-chat'),
  park: art('venue-park'),
  cafe: art('venue-cafe'),
  cinema: art('venue-cinema'),
  dinner: art('venue-dinner'),
  hobby: art('venue-hobby'),
  surprise: art('venue-surprise'),
  private: art('venue-private'),
}

export const CAREER_ART: Record<string, string> = {
  dev: art('career-dev'),
  sales: art('career-sales'),
  nurse: art('career-nurse'),
  civil: art('career-civil'),
  designer: art('career-designer'),
  teacher: art('career-teacher'),
  chef: art('career-chef'),
  lawyer: art('career-lawyer'),
  media: art('career-media'),
}

/** 事件大类复用落点 / 场所图，不单独出图 */
export const EVENT_ART: Record<EventKind, string> = {
  opportunity: SPACE_ART.vacant,
  market: SPACE_ART.invest,
  doodad: SPACE_ART.shop,
  relation: VENUE_ART.cafe!,
  business: SPACE_ART.manage,
  rest: SPACE_ART.park,
  career: CAREER_ART.sales!,
  cashflowDay: SPACE_ART.payday,
  narrative: HOME_ART,
}

const VIBE_ART: Record<FreeLifeVibe, string> = {
  home: art('venue-chat'),
  chat: art('venue-cafe'),
  date: art('venue-park'),
  creative: art('career-designer'),
  market: art('space-shop'),
  rest: art('venue-hobby'),
  office: art('space-office'),
  club: art('space-casino'),
  friendHome: art('venue-private'),
}

/** 个别地点覆盖 vibe 默认图 */
export const FREE_PLACE_ART: Partial<Record<FreeLifePlaceId | string, string>> = {
  cafe: art('venue-cafe'),
  riverside: art('venue-park'),
  gallery: art('career-designer'),
  indieCinema: art('venue-cinema'),
  bistro: art('venue-dinner'),
  club: art('space-casino'),
  friendHome: art('venue-private'),
}

export const spaceArt = (kind: SpaceKind): string => SPACE_ART[kind]
export const venueArt = (id: string): string | undefined => VENUE_ART[id]
export const careerArt = (id: string): string | undefined => CAREER_ART[id]
export const eventArt = (kind: EventKind): string => EVENT_ART[kind]

export const freePlaceArt = (id: string): string => {
  if (FREE_PLACE_ART[id]) return FREE_PLACE_ART[id]!
  if (id in VIBE_ART) return VIBE_ART[id as FreeLifeVibe]
  try {
    return VIBE_ART[placeVibe(id as FreeLifePlaceId)] ?? PLAY_ART
  } catch {
    return PLAY_ART
  }
}

export const ALL_ART: string[] = Array.from(
  new Set([
    HOME_ART,
    PLAY_ART,
    SETTLE_FREE_ART,
    SETTLE_GRIND_ART,
    FREE_LIFE_MAP,
    FREE_LIFE_WORLD_ART,
    ...Object.values(FREE_LIFE_MAP_TILE_ART),
    ...Object.values(SPACE_ART),
    ...Object.values(VENUE_ART),
    ...Object.values(CAREER_ART),
  ]),
)
