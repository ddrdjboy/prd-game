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

  const relationScore = Math.round(
    player.relations.reduce((sum, r) => {
      if (r.affinity <= 0) return sum
      return sum + r.affinity * stageWeight(r.affinity)
    }, 0),
  )

  const wealthPts = Math.max(0, finance.netWorth) * 10 + (free ? 40 : 0)
  // affinity 量纲约 ×5，系数下调使档位接近旧版
  const total = wealthPts + relationScore * 0.04

  let grade: ScoreResult['grade'] = 'C'
  if (total >= 120) grade = 'S'
  else if (total >= 80) grade = 'A'
  else if (total >= 45) grade = 'B'

  const comment = free
    ? grade === 'S' || grade === 'A'
      ? '45 岁，你摸到了财富自由，关系也没有塌方。'
      : '账面上自由了，但关系和生活还可以再丰盛一点。'
    : grade === 'A' || grade === 'B'
      ? '还没完全自由，但你把人生过成了有声有色的故事。'
      : '鼠圈很黏人。下一局换条路试试？'

  return {
    free,
    netWorth: finance.netWorth,
    relationScore,
    grade,
    comment,
    finance,
  }
}
