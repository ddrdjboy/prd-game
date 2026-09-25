import { calcFinance, isFinanciallyFree } from './finance'
import type { PlayerState, ScoreResult } from './types'

export function scorePlayer(player: PlayerState): ScoreResult {
  const finance = calcFinance(player)
  const free = isFinanciallyFree(player)
  const networks = player.relations.filter((r) => r.kind === 'network' && r.status !== 'broken')
  const romances = player.relations.filter((r) => r.kind === 'romance' && r.status !== 'broken')
  const brokenRomance = player.relations.filter((r) => r.kind === 'romance' && r.status === 'broken').length

  const networkScore = Math.round(
    networks.reduce((s, r) => s + r.score * (r.status === 'partner' ? 1.3 : 1), 0),
  )
  const romanceScore = Math.round(
    Math.max(
      0,
      romances.reduce((s, r) => s + r.score * (r.status === 'married' ? 1.4 : 1), 0) - brokenRomance * 20,
    ),
  )

  const wealthPts = Math.max(0, finance.netWorth) * 10 + (free ? 40 : 0)
  const total = wealthPts + networkScore * 0.15 + romanceScore * 0.15

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
    networkScore,
    romanceScore,
    grade,
    comment,
    finance,
  }
}
