import { calcFinance } from '../../game/finance'
import type { PlayerState } from '../../game/types'
import './FinancePanel.css'

type Props = {
  player: PlayerState
}

export function FinancePanel({ player }: Props) {
  const f = calcFinance(player)
  return (
    <aside className="finance panel">
      <h3>财务报表 · {player.name}</h3>
      <p className="muted">
        {player.track === 'worker' ? '打工人圈' : '投资人圈'}
        {player.careerId ? ` · ${player.careerId}` : ''}
      </p>
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
                店·{s.name} Lv{s.level} (+{s.baseCashflow})
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
    </aside>
  )
}
