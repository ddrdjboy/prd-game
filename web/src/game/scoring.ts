import { stageFromAffinity } from './affinity'
import { calcFinance, isFinanciallyFree } from './finance'
import type { PlayerState, ScoreResult } from './types'

function stageWeight(affinity: number): number {
  const stage = stageFromAffinity(affinity)
  if (stage === 'intimate') return 1.3
  if (stage === 'close') return 1.15
  return 1
}

export function scorePlayer(player: PlayerState): ScoreResult {
  const finance = calcFinance(player)
  const free = isFinanciallyFree(player)
  const charactersMet = player.relations.length

  const relationScore = Math.round(
    player.relations.reduce((sum, r) => {
      if (r.affinity <= 0) return sum
      return sum + r.affinity * stageWeight(r.affinity)
    }, 0),
  )

  // 主结算：净资产；副：见过角色数略加分
  const wealthPts = Math.max(0, finance.netWorth) * 10 + (free ? 40 : 0)
  const total = wealthPts + charactersMet * 2 + relationScore * 0.02

  let grade: ScoreResult['grade'] = 'C'
  if (total >= 120) grade = 'S'
  else if (total >= 80) grade = 'A'
  else if (total >= 45) grade = 'B'

  const comment = free
    ? grade === 'S' || grade === 'A'
      ? `45 岁，净资产可观，还结识了 ${charactersMet} 位朋友。`
      : `账面上自由了；图鉴里有 ${charactersMet} 人，生活还能更丰盛。`
    : grade === 'A' || grade === 'B'
      ? `还没完全自由，但你收过 ${charactersMet} 位朋友，故事不算空。`
      : '鼠圈很黏人。下一局换条路试试？'

  return {
    free,
    netWorth: finance.netWorth,
    charactersMet,
    relationScore,
    grade,
    comment,
    finance,
  }
}
