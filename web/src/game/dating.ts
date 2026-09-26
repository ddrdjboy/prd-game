import type { PlayerState, Relation } from './types'

export interface DateVenue {
  id: string
  name: string
  cost: number
  boost: number
  blurb: string
}

export const DATE_VENUES: DateVenue[] = [
  { id: 'park', name: '公园散步', cost: 0.05, boost: 6, blurb: '轻松走一走' },
  { id: 'cafe', name: '咖啡厅', cost: 0.12, boost: 9, blurb: '坐下来聊聊' },
  { id: 'cinema', name: '电影院', cost: 0.2, boost: 12, blurb: '一起看场电影' },
  { id: 'dinner', name: '餐厅正餐', cost: 0.35, boost: 16, blurb: '好好吃一顿' },
  { id: 'surprise', name: '惊喜安排', cost: 0.55, boost: 22, blurb: '花心思安排一天' },
]

export function dateVenueById(id: string): DateVenue | undefined {
  return DATE_VENUES.find((v) => v.id === id)
}

/** 约会·交友：恋人 + 人脉均可选 */
export function dateableRelations(player: PlayerState): Relation[] {
  return player.relations.filter((r) => {
    if (r.status === 'broken') return false
    if (r.kind === 'romance') {
      return r.status === 'dating' || r.status === 'engaged' || r.status === 'married'
    }
    return r.status === 'new' || r.status === 'stable' || r.status === 'partner'
  })
}

export function relationKindLabel(kind: Relation['kind']): string {
  return kind === 'romance' ? '恋人' : '人脉'
}

export function relationStatusLabel(status: Relation['status']): string {
  switch (status) {
    case 'new':
      return '初识'
    case 'stable':
      return '稳定'
    case 'partner':
      return '合伙人'
    case 'dating':
      return '交往中'
    case 'engaged':
      return '订婚'
    case 'married':
      return '已婚'
    case 'broken':
      return '已破裂'
  }
}

/** AI：优先挽救低分关系；场所取能负担的最便宜档（省钱维护） */
export function pickAiDate(
  player: PlayerState,
): { relationId: string; venueId: string } | null {
  const list = dateableRelations(player)
  if (!list.length) return null
  const partner = [...list].sort((a, b) => a.score - b.score)[0]
  const affordable = DATE_VENUES.filter((v) => player.cash + 1e-9 >= v.cost)
  if (!affordable.length) return null
  const venue = [...affordable].sort((a, b) => a.cost - b.cost)[0]
  return { relationId: partner.id, venueId: venue.id }
}

export function dateBoostFor(
  player: PlayerState,
  venue: DateVenue,
  relation?: Relation,
): number {
  let bonus = 0
  if (relation?.kind === 'romance' && player.trait === 'romanceBoost') bonus = 4
  if (relation?.kind === 'network' && player.trait === 'networkBoost') bonus = 4
  if (!relation && player.trait === 'romanceBoost') bonus = 4
  return venue.boost + bonus
}
