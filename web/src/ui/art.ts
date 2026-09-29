import type { EventKind, SpaceKind } from '../game/types'

/** 场景插画：文件位于 web/public/art/，仅供展示层使用 */
const art = (name: string) => `${import.meta.env.BASE_URL}art/${name}.jpg`

export const HOME_ART = art('home-hero')
export const PLAY_ART = art('play-bg')
export const SETTLE_FREE_ART = art('settle-free')
export const SETTLE_GRIND_ART = art('settle-grind')

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

export const spaceArt = (kind: SpaceKind): string => SPACE_ART[kind]
export const venueArt = (id: string): string | undefined => VENUE_ART[id]
export const careerArt = (id: string): string | undefined => CAREER_ART[id]
export const eventArt = (kind: EventKind): string => EVENT_ART[kind]

export const ALL_ART: string[] = Array.from(
  new Set([
    HOME_ART,
    PLAY_ART,
    SETTLE_FREE_ART,
    SETTLE_GRIND_ART,
    ...Object.values(SPACE_ART),
    ...Object.values(VENUE_ART),
    ...Object.values(CAREER_ART),
  ]),
)
