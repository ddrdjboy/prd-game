import { calcFinance, shopBreakdown } from '../../game/finance'
import { CAREERS } from '../../game/careers'
import { shopTypeById } from '../../game/shopCatalog'
import type { PlayerState } from '../../game/types'
import { MoneyAmount } from './MoneyAmount'
import './FinancePanel.css'

type Props = {
  player: PlayerState
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 财务报表弹层（触发器已移至顶栏年龄旁） */
export function FinancePanel({ player, open, onOpenChange }: Props) {
  const f = calcFinance(player)
  const careerName = CAREERS.find((c) => c.id === player.careerId)?.name

  if (!open) return null

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="财务报表">
      <div className="modal-card panel finance-modal-card">
        <h3>财务报表 · {player.name}</h3>
        <p className="muted">
          {player.track === 'worker' ? '打工人' : '投资人（旧档）'}
          {careerName ? ` · ${careerName}` : ''}
        </p>
        <div className="finance-body">
          <dl>
            <div>
              <dt>现金</dt>
              <dd>
                <MoneyAmount value={player.cash} />
              </dd>
            </div>
            <div>
              <dt>工资</dt>
              <dd>
                <MoneyAmount value={f.salary} flow />
              </dd>
            </div>
            <div>
              <dt>被动收入</dt>
              <dd>
                <MoneyAmount value={f.passiveIncome} flow />
              </dd>
            </div>
            <div>
              <dt>总支出</dt>
              <dd>
                <MoneyAmount value={f.totalExpense} flow />
              </dd>
            </div>
            <div>
              <dt>季现金流</dt>
              <dd className={f.seasonalCashflow >= 0 ? 'pos' : 'neg'}>
                <MoneyAmount value={f.seasonalCashflow} flow signed />
              </dd>
            </div>
            <div>
              <dt>净资产</dt>
              <dd>
                <MoneyAmount value={f.netWorth} />
              </dd>
            </div>
            <div>
              <dt>负债</dt>
              <dd>
                <MoneyAmount value={player.liabilities} />
              </dd>
            </div>
          </dl>
          <div>
            <h4>关系</h4>
            <ul className="rel-list">
              {player.relations.length === 0 && (
                <li className="muted">暂无</li>
              )}
              {player.relations.map((r) => (
                  <li key={r.id}>
                    关系·{r.name} {r.affinity}
                    <span className="money-unit">好感</span>
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
                    店·{s.name}（{label} Lv{s.level}）营收 <MoneyAmount value={bd.gross} flow /> − 成本{' '}
                    <MoneyAmount value={bd.cost} flow /> ={' '}
                    <span className={bd.net >= 0 ? 'pos' : 'neg'}>
                      <MoneyAmount value={bd.net} flow signed />
                    </span>
                  </li>
                )
              })}
              {player.investments.map((i) => (
                <li key={i.id}>
                  投·{i.name}（<MoneyAmount value={i.cashflow} flow signed />）
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
  )
}
