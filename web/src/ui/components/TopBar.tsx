import { END_AGE, SEASONS, START_AGE, getEndAge } from '../../game/config'
import { calcFinance } from '../../game/finance'
import type { AutoSensitivity, GameState } from '../../game/types'
import { useValueFlash } from '../motion'
import './TopBar.css'

type Props = {
  state: GameState
  onToggleAuto: () => void
  onAutoRun: () => void
  onCycleSensitivity: () => void
  onOpenFinance: () => void
  financeDisabled?: boolean
}

const SENS_LABEL: Record<AutoSensitivity, string> = {
  low: '少打断',
  standard: '标准',
  high: '多打断',
}

export function TopBar({
  state,
  onToggleAuto,
  onAutoRun,
  onCycleSensitivity,
  onOpenFinance,
  financeDisabled,
}: Props) {
  const human = state.players[0]
  const fin = calcFinance(human)
  const freePct = Math.min(100, Math.round(fin.freeProgress * 100))
  const endAge = getEndAge()
  const lifeSpan = Math.max(1, endAge - START_AGE)
  const lifePct = Math.min(100, Math.round(((state.age - START_AGE) / lifeSpan) * 100))
  const yearsLeft = Math.max(0, endAge - state.age)
  const cashFlash = useValueFlash(human.cash)
  const flowFlash = useValueFlash(fin.seasonalCashflow)

  return (
    <header className="topbar">
      <div className="brand">
        <strong>45岁财富自由</strong>
        <div className="brand-row">
          <span className="brand-age">
            <span className="player-name">{human.name}</span>
            <span className="muted">
              {state.age} 岁 · {SEASONS[state.seasonIndex]}
              {endAge !== END_AGE ? ` · 速通至 ${endAge}` : ''}
            </span>
          </span>
          <button
            type="button"
            className="finance-chip"
            disabled={financeDisabled}
            onClick={onOpenFinance}
            title="打开财务报表"
          >
            <span className="finance-chip-label">财务</span>
            <span className="finance-chip-stats">
              现金{' '}
              <span key={cashFlash.key} className={cashFlash.className}>
                {human.cash}
              </span>
              <span className="dot">·</span>
              季流{' '}
              <span
                key={flowFlash.key}
                className={`${fin.seasonalCashflow >= 0 ? 'pos' : 'neg'} ${flowFlash.className}`.trim()}
              >
                {fin.seasonalCashflow}
              </span>
            </span>
          </button>
        </div>
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
