import { SEASONS } from '../../game/config'
import { calcFinance } from '../../game/finance'
import type { GameState } from '../../game/types'
import './TopBar.css'

type Props = {
  state: GameState
  onToggleAuto: () => void
  onAutoRun: () => void
}

export function TopBar({ state, onToggleAuto, onAutoRun }: Props) {
  const human = state.players[0]
  const fin = calcFinance(human)
  const pct = Math.min(100, Math.round(fin.freeProgress * 100))

  return (
    <header className="topbar">
      <div className="brand">
        <strong>45岁财富自由</strong>
        <span className="muted">
          {state.age} 岁 · {SEASONS[state.seasonIndex]}
        </span>
      </div>
      <div className="progress-wrap">
        <div className="progress-label">
          财富自由 {pct}%（被动 {fin.passiveIncome} / 支出 {fin.totalExpense}）
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="top-actions">
        <button onClick={onToggleAuto}>{state.autoEnabled ? '自动：开' : '自动：关'}</button>
        <button className="primary" onClick={onAutoRun}>
          一键推进
        </button>
      </div>
    </header>
  )
}
