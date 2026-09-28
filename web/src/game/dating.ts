import {
  stageFromAffinity,
  stageGte,
  type AffinityStage,
  STAGE_LABEL,
} from './affinity'
import type { PlayerState, Relation } from './types'

export interface DateVenue {
  id: string
  name: string
  cost: number
  boost: number
  blurb: string
  minStage: AffinityStage
}

export const DATE_VENUES: DateVenue[] = [
  { id: 'chat', name: '简单聊聊', cost: 0, boost: 4, blurb: '破冰或和解', minStage: 'hate' },
  { id: 'park', name: '公园散步', cost: 0.05, boost: 6, blurb: '轻松走一走', minStage: 'neutral' },
  { id: 'cafe', name: '咖啡厅', cost: 0.12, boost: 9, blurb: '坐下来聊聊', minStage: 'friendly' },
  { id: 'cinema', name: '电影院', cost: 0.2, boost: 12, blurb: '一起看场电影', minStage: 'friendly' },
  { id: 'dinner', name: '餐厅正餐', cost: 0.35, boost: 16, blurb: '好好吃一顿', minStage: 'close' },
  { id: 'hobby', name: '共同爱好', cost: 0.28, boost: 18, blurb: '一起做喜欢的事', minStage: 'close' },
  { id: 'surprise', name: '惊喜安排', cost: 0.55, boost: 22, blurb: '花心思安排一天', minStage: 'intimate' },
  { id: 'private', name: '专属小旅行', cost: 0.8, boost: 28, blurb: '只属于你们的行程', minStage: 'intimate' },
]

export function dateVenueById(id: string): DateVenue | undefined {
  return DATE_VENUES.find((v) => v.id === id)
}

/** 互动：全体关系可选 */
export function dateableRelations(player: PlayerState): Relation[] {
  return [...player.relations]
}

export function venueUnlockedFor(venue: DateVenue, relation: Relation): boolean {
  return stageGte(stageFromAffinity(relation.affinity), venue.minStage)
}

export function relationStageLabel(relation: Relation): string {
  return STAGE_LABEL[stageFromAffinity(relation.affinity)]
}

/** @deprecated 使用 relationStageLabel */
export function relationKindLabel(_kind?: string): string {
  return '关系'
}

/** @deprecated 使用 relationStageLabel */
export function relationStatusLabel(_status?: string): string {
  return ''
}

/** AI：优先挽救低分；场所取已解锁且能负担的最便宜档 */
export function pickAiDate(
  player: PlayerState,
): { relationId: string; venueId: string } | null {
  const list = dateableRelations(player)
  if (!list.length) return null
  const partner = [...list].sort((a, b) => a.affinity - b.affinity)[0]
  const affordable = DATE_VENUES.filter(
    (v) =>
      player.cash + 1e-9 >= v.cost && venueUnlockedFor(v, partner),
  )
  if (!affordable.length) return null
  const venue = [...affordable].sort((a, b) => a.cost - b.cost)[0]
  return { relationId: partner.id, venueId: venue.id }
}

export function dateBoostFor(player: PlayerState, venue: DateVenue): number {
  const bonus = player.trait === 'relationBoost' ? 4 : 0
  return venue.boost + bonus
}
