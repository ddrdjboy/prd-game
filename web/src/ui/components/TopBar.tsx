import { END_AGE, SEASONS, START_AGE, getEndAge } from '../../game/config'
import { calcFinance } from '../../game/finance'
import type { AutoSensitivity, GameState } from '../../game/types'
import './TopBar.css'

type Props = {
  state: GameState
  onToggleAuto: () => void
  onAutoRun: () => void
  onCycleSensitivity: () => void
}

const SENS_LABEL: Record<AutoSensitivity, string> = {
  low: '少打断',
  standard: '标准',
  high: '多打断',
}

export function TopBar({ state, onToggleAuto, onAutoRun, onCycleSensitivity }: Props) {
  const human = state.players[0]
  const fin = calcFinance(human)
  const freePct = Math.min(100, Math.round(fin.freeProgress * 100))
  const endAge = getEndAge()
  const lifeSpan = Math.max(1, endAge - START_AGE)
  const lifePct = Math.min(100, Math.round(((state.age - START_AGE) / lifeSpan) * 100))
  const yearsLeft = Math.max(0, endAge - state.age)

  return (
    <header className="topbar">
      <div className="brand">
        <strong>45岁财富自由</strong>
        <span className="muted">
          {state.age} 岁 · {SEASONS[state.seasonIndex]}
          {endAge !== END_AGE ? ` · 速通至 ${endAge}` : ''}
        </span>
      </div>
      <div className="progress-wrap">
        <div className="progress-dual">
          <div className="progress-track">
            <div className="progress-label">
              人生 {lifePct}% · 还剩 {yearsLeft} 年
            </div>
            <div className="progress-bar life">
              <div className="progress-fill" style={{ width: `${lifePct}%` }} />
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-label">
              自由 {freePct}%（被动 {fin.passiveIncome} / 支出 {fin.totalExpense}）
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${freePct}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div className="top-actions">
        <button type="button" onClick={onCycleSensitivity} title="自动季打断灵敏度">
          <span className="btn-full">打断：{SENS_LABEL[state.autoSensitivity]}</span>
          <span className="btn-short">{SENS_LABEL[state.autoSensitivity]}</span>
        </button>
        <button type="button" onClick={onToggleAuto}>
          <span className="btn-full">{state.autoEnabled ? '自动：开' : '自动：关'}</span>
          <span className="btn-short">{state.autoEnabled ? '自动开' : '自动'}</span>
        </button>
        <button type="button" className="primary" onClick={onAutoRun}>
          <span className="btn-full">一键推进</span>
          <span className="btn-short">推进</span>
        </button>
      </div>
    </header>
  )
}
