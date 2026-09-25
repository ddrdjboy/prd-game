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

  const maxW = Math.max(1, ...scores.map((s) => Math.abs(s.score.netWorth)))
  const maxN = Math.max(1, ...scores.map((s) => s.score.networkScore))
  const maxR = Math.max(1, ...scores.map((s) => s.score.romanceScore))

  const radar = (nw: number, n: number, r: number) => {
    const a = (nw / maxW) * 80
    const b = (n / maxN) * 80
    const c = (r / maxR) * 80
    // triangle points around center 100,100
    const p1 = `${100},${100 - a}`
    const p2 = `${100 + b * 0.866},${100 + b * 0.5}`
    const p3 = `${100 - c * 0.866},${100 + c * 0.5}`
    return `${p1} ${p2} ${p3}`
  }

  return (
    <div className="settle">
      <h1>45 岁结算</h1>
      <p className={`free-badge ${you.score.free ? 'yes' : 'no'}`}>
        {you.score.free ? '财富自由：达成' : '财富自由：未达成'}
      </p>
      <p className="grade">评级 {you.score.grade}</p>
      <p className="comment">{you.score.comment}</p>

      <svg className="radar" viewBox="0 0 200 200" aria-label="三维雷达">
        <polygon points="100,20 170,160 30,160" fill="none" stroke="rgba(242,239,230,0.2)" />
        <polygon
          points={radar(you.score.netWorth, you.score.networkScore, you.score.romanceScore)}
          fill="rgba(226,177,74,0.35)"
          stroke="#e2b14a"
        />
        <text x="100" y="14" textAnchor="middle" fill="#a8b5ad" fontSize="10">
          资产
        </text>
        <text x="178" y="168" textAnchor="middle" fill="#a8b5ad" fontSize="10">
          人脉
        </text>
        <text x="22" y="168" textAnchor="middle" fill="#a8b5ad" fontSize="10">
          恋人
        </text>
      </svg>

      <div className="score-grid">
        {scores.map(({ player, score }) => (
          <div key={player.id} className="panel score-card">
            <h3>
              {player.name} · {score.grade}
            </h3>
            <p>净资产 {score.netWorth}</p>
            <p>人脉 {score.networkScore}</p>
            <p>恋人 {score.romanceScore}</p>
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
