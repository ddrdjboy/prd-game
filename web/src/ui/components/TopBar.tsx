import { END_AGE, MONTH_FRACTION, MONTHS, SEASONS, START_AGE, getEndAge } from '../../game/config'
import { calcFinance } from '../../game/finance'
import type { AutoSpeed, GameState } from '../../game/types'
import { useValueFlash } from '../motion'
import { MoneyAmount } from './MoneyAmount'
import './TopBar.css'

type Props = {
  state: GameState
  onCyclePlayPace: () => void
  onCycleAutoSpeed: () => void
  onOpenFinance: () => void
  financeDisabled?: boolean
}

/** 顶栏一个按钮的三态：由自动推进 + 弹框代选组合而成 */
export type PlayPace = 'full' | 'semi' | 'manual'

export function playPace(state: Pick<GameState, 'autoEnabled' | 'autoChoiceMode'>): PlayPace {
  if (!state.autoEnabled) return 'manual'
  return state.autoChoiceMode === 'auto' ? 'full' : 'semi'
}

const PLAY_PACE_LABEL: Record<PlayPace, { text: string; title: string }> = {
  full: { text: '全自动', title: '所有弹框自动选最优。再点切换为半自动' },
  semi: { text: '半自动', title: '棋盘自动推进，弹框后手动选择。再点切换为手动' },
  manual: { text: '手动', title: '自己拉霸、自己选择。再点切换为全自动' },
}

const AUTO_SPEED_LABEL: Record<AutoSpeed, string> = {
  fast: '快',
  medium: '中',
  slow: '慢',
}

export function TopBar({
  state,
  onCyclePlayPace,
  onCycleAutoSpeed,
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
  const freeLife = state.lifeMode === 'free'
  const flowValue = freeLife ? fin.seasonalCashflow * MONTH_FRACTION : fin.seasonalCashflow
  const passiveShow = freeLife ? fin.passiveIncome * MONTH_FRACTION : fin.passiveIncome
  const expenseShow = freeLife ? fin.totalExpense * MONTH_FRACTION : fin.totalExpense
  const cashFlash = useValueFlash(human.cash)
  const flowFlash = useValueFlash(flowValue)
  const pace = playPace(state)
  const paceLabel = PLAY_PACE_LABEL[pace]

  return (
    <header className="topbar">
      <div className="brand">
        <strong>45岁财富自由</strong>
        <div className="brand-row">
          <span className="brand-age">
            <span className="player-name">{human.name}</span>
            <span className="muted">
              {state.age} 岁 ·{' '}
              {state.lifeMode === 'free'
                ? MONTHS[state.monthIndex] ?? `${(state.monthIndex ?? 0) + 1}月`
                : SEASONS[state.seasonIndex]}
              {state.lifeMode === 'free' ? ' · 自由生活' : ''}
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
              <span key={`cash-${cashFlash.key}`} className={cashFlash.className || undefined}>
                <MoneyAmount value={human.cash} />
              </span>
              <span className="dot">·</span>
              现金流{' '}
              <span
                key={`flow-${flowFlash.key}`}
                className={`${flowValue >= 0 ? 'pos' : 'neg'} ${flowFlash.className}`.trim()}
              >
                <MoneyAmount value={flowValue} flow signed period={freeLife ? 'month' : 'season'} />
              </span>
              <span className="dot">·</span>
              净资产{' '}
              <span className="networth">
                <MoneyAmount value={fin.netWorth} />
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
              自由 {freePct}%（被动{' '}
              <MoneyAmount value={passiveShow} flow period={freeLife ? 'month' : 'season'} /> / 支出{' '}
              <MoneyAmount value={expenseShow} flow period={freeLife ? 'month' : 'season'} />）
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${freePct}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div className="top-actions">
        <button
          type="button"
          className={`play-pace play-pace-${pace}`}
          onClick={onCyclePlayPace}
          title={paceLabel.title}
          aria-label={`${paceLabel.text}。${paceLabel.title}`}
        >
          <span className="btn-full">{paceLabel.text}</span>
          <span className="btn-short">{paceLabel.text}</span>
        </button>
        <button type="button" onClick={onCycleAutoSpeed} title="切换自动推进速度">
          <span className="btn-full">速度：{AUTO_SPEED_LABEL[state.autoSpeed]}</span>
          <span className="btn-short">{AUTO_SPEED_LABEL[state.autoSpeed]}</span>
        </button>
      </div>
    </header>
  )
}
