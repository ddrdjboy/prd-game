import { calcFinance, shopBreakdown } from '../../game/finance'
import { CAREERS } from '../../game/careers'
import { shopTypeById } from '../../game/shopCatalog'
import type { PlayerState } from '../../game/types'
import './FinancePanel.css'

type Props = {
  player: PlayerState
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 外部正打开其它面板时禁用触发 */
  disabled?: boolean
}

export function FinancePanel({ player, open, onOpenChange, disabled }: Props) {
  const f = calcFinance(player)
  const careerName = CAREERS.find((c) => c.id === player.careerId)?.name

  return (
    <>
      <button
        type="button"
        className="finance panel finance-trigger"
        disabled={disabled}
        onClick={() => onOpenChange(true)}
      >
        <span className="finance-summary-main">
          <strong>财务报表</strong>
          <span className="finance-summary-stats">
            现金 {player.cash} · 季流{' '}
            <span className={f.seasonalCashflow >= 0 ? 'pos' : 'neg'}>{f.seasonalCashflow}</span>
          </span>
        </span>
      </button>

      {open && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="财务报表">
          <div className="modal-card panel finance-modal-card">
            <h3>财务报表 · {player.name}</h3>
            <p className="muted">
              {player.track === 'worker' ? '打工人圈' : '投资人圈'}
              {careerName ? ` · ${careerName}` : ''}
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
                  {player.shops.map((s) => {
                    const bd = shopBreakdown(s, player.relations)
                    const label = shopTypeById(s.typeId)?.label ?? s.typeId
                    return (
                      <li key={s.id}>
                        店·{s.name}（{label} Lv{s.level}）营收 {bd.gross.toFixed(2)} − 成本{' '}
                        {bd.cost.toFixed(2)} ={' '}
                        <span className={bd.net >= 0 ? 'pos' : 'neg'}>{bd.net.toFixed(2)}</span>
                      </li>
                    )
                  })}
                  {player.investments.map((i) => (
                    <li key={i.id}>
                      投·{i.name} (+{i.cashflow})
                    </li>
                  ))}
                  {!player.shops.length && !player.investments.length && (
                    <li className="muted">暂无</li>
                  )}
                </ul>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={() => onOpenChange(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
