import { scorePlayer } from '../../game/scoring'
import type { GameState } from '../../game/types'
import './SettlementScreen.css'

type Props = {
  state: GameState
  onRestart: () => void
}

export function SettlementScreen({ state, onRestart }: Props) {
  const scores = state.players.map((p) => ({ player: p, score: scorePlayer(p) }))
  const you = scores[0]
  const bankrupt = state.settlementReason === 'bankrupt'

  const maxW = Math.max(1, ...scores.map((s) => Math.abs(s.score.netWorth)))
  const maxRel = Math.max(1, ...scores.map((s) => s.score.relationScore))

  /** 二维：资产 vs 关系（对称三角简化为两轴展示） */
  const radar = (nw: number, rel: number) => {
    const a = (Math.abs(nw) / maxW) * 80
    const b = (rel / maxRel) * 80
    const p1 = `${100},${100 - a}`
    const p2 = `${100 + b * 0.866},${100 + b * 0.5}`
    const p3 = `${100 - b * 0.866},${100 + b * 0.5}`
    return `${p1} ${p2} ${p3}`
  }

  return (
    <div className="settle">
      <h1>{bankrupt ? '破产出局' : '45 岁结算'}</h1>
      {bankrupt ? (
        <p className="free-badge no">连续两次发薪后现金为负，人生提前结束。</p>
      ) : (
        <p className={`free-badge ${you.score.free ? 'yes' : 'no'}`}>
          {you.score.free ? '财富自由：达成' : '财富自由：未达成'}
        </p>
      )}
      <p className="grade">评级 {you.score.grade}</p>
      <p className="comment">
        {bankrupt
          ? '现金流断裂。下次注意支出节奏，开店与互动都要留发薪余粮。'
          : you.score.comment}
      </p>

      <svg className="radar" viewBox="0 0 200 200" aria-label="财富与关系">
        <polygon points="100,20 170,160 30,160" fill="none" stroke="rgba(242,239,230,0.2)" />
        <polygon
          points={radar(you.score.netWorth, you.score.relationScore)}
          fill="rgba(226,177,74,0.35)"
          stroke="#e2b14a"
        />
        <text x="100" y="14" textAnchor="middle" fill="#a8b5ad" fontSize="10">
          资产
        </text>
        <text x="100" y="178" textAnchor="middle" fill="#a8b5ad" fontSize="10">
          关系
        </text>
      </svg>

      <div className="score-grid">
        {scores.map(({ player, score }) => (
          <div key={player.id} className="panel score-card">
            <h3>
              {player.name} · {score.grade}
            </h3>
            <p>净资产 {score.netWorth}</p>
            <p>关系 {score.relationScore}</p>
            <p>{score.free ? '已自由' : '未自由'}</p>
          </div>
        ))}
      </div>

      <button className="primary" onClick={onRestart}>
        再来一局
      </button>
    </div>
  )
}
