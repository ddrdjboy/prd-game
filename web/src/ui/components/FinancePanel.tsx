import { useLayoutEffect, useRef } from 'react'
import { calcFinance, shopCashflow } from '../../game/finance'
import { CAREERS } from '../../game/careers'
import type { PlayerState } from '../../game/types'
import './FinancePanel.css'

type Props = {
  player: PlayerState
}

export function FinancePanel({ player }: Props) {
  const f = calcFinance(player)
  const pct = Math.min(100, Math.round(f.freeProgress * 100))
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const careerName = CAREERS.find((c) => c.id === player.careerId)?.name

  useLayoutEffect(() => {
    const el = detailsRef.current
    if (!el) return
    const mq = window.matchMedia('(min-width: 641px)')
    const sync = () => {
      el.open = mq.matches
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <details ref={detailsRef} className="finance panel collapsible">
      <summary className="finance-summary">
        <span className="finance-summary-main">
          <strong>财务报表 · {player.name}</strong>
          <span className="muted finance-summary-meta">
            {player.track === 'worker' ? '打工人圈' : '投资人圈'}
            {careerName ? ` · ${careerName}` : ''}
          </span>
        </span>
        <span className="finance-summary-stats">
          现金 {player.cash} · 季流{' '}
          <span className={f.seasonalCashflow >= 0 ? 'pos' : 'neg'}>{f.seasonalCashflow}</span>
          {' · '}自由 {pct}%
        </span>
      </summary>
      <div className="finance-body">
        <dl>
          <div>
            <dt>现金</dt>
            <dd>{player.cash} 万</dd>
          </div>
          <div>
            <dt>工资</dt>
            <dd>{f.salary}</dd>
          </div>
          <div>
            <dt>被动收入</dt>
            <dd>{f.passiveIncome}</dd>
          </div>
          <div>
            <dt>总支出</dt>
            <dd>{f.totalExpense}</dd>
          </div>
          <div>
            <dt>季现金流</dt>
            <dd className={f.seasonalCashflow >= 0 ? 'pos' : 'neg'}>{f.seasonalCashflow}</dd>
          </div>
          <div>
            <dt>净资产</dt>
            <dd>{f.netWorth}</dd>
          </div>
          <div>
            <dt>负债</dt>
            <dd>{player.liabilities}</dd>
          </div>
        </dl>
        <div>
          <h4>关系</h4>
          <ul className="rel-list">
            {player.relations.filter((r) => r.status !== 'broken').length === 0 && (
              <li className="muted">暂无</li>
            )}
            {player.relations
              .filter((r) => r.status !== 'broken')
              .map((r) => (
                <li key={r.id}>
                  {r.kind === 'network' ? '人脉' : '恋人'}·{r.name} {r.score}
                  {r.locked ? ' 🔒' : ''}
                </li>
              ))}
          </ul>
        </div>
        <div>
          <h4>店铺 / 投资</h4>
          <ul className="rel-list">
            {player.shops.map((s) => (
              <li key={s.id}>
                店·{s.name} Lv{s.level}（实际 CF {shopCashflow(s, player.relations).toFixed(2)} /
                基 {s.baseCashflow}）
              </li>
            ))}
            {player.investments.map((i) => (
              <li key={i.id}>
                投·{i.name} (+{i.cashflow})
              </li>
            ))}
            {!player.shops.length && !player.investments.length && <li className="muted">暂无</li>}
          </ul>
        </div>
      </div>
    </details>
  )
}
