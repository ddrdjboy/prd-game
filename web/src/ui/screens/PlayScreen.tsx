import { useEffect, useState } from 'react'
import { MOVE_STEP_MS, SLOT_SPIN_MS } from '../../game/config'
import {
  DATE_VENUES,
  dateBoostFor,
  dateableRelations,
  relationKindLabel,
  relationStatusLabel,
} from '../../game/dating'
import { canAffordChoice, choiceCashCost, getEvent } from '../../game/events'
import { shopBookValue, shopCashflow } from '../../game/finance'
import { SHOP_ITEMS, VACANT_COST } from '../../game/location'
import {
  OFFICE_DOWN_COST,
  OFFICE_POACH_COST,
  OFFICE_RECOMMEND_COST,
  OFFICE_UP_COST,
  adjustDelta,
  adjustableRelations,
  poachSuccessChance,
  poachableTargets,
} from '../../game/office'
import type { GameAction, GameState, RelationKind } from '../../game/types'
import { Board } from '../components/Board'
import { FinancePanel } from '../components/FinancePanel'
import { TopBar } from '../components/TopBar'
import './PlayScreen.css'

type Props = {
  state: GameState
  dispatch: (a: GameAction) => void
  onAutoRun: () => void
}

type ShopPanel =
  | { step: 'list' }
  | { step: 'detail'; shopId: string }

type FriendPanel =
  | { step: 'list' }
  | { step: 'detail'; relationId: string }

type OfficeUi =
  | { step: 'menu' }
  | { step: 'recommend' }
  | { step: 'adjustPick' }
  | { step: 'adjustDir'; ownerId: string; relationId: string; label: string }
  | { step: 'poachPlayer' }
  | { step: 'poachRel'; targetPlayerId: string; targetName: string }

export function PlayScreen({ state, dispatch, onAutoRun }: Props) {
  const human = state.players[0]
  const isHumanTurn = state.players[state.turnPlayerIndex]?.isHuman
  const spinning = Boolean(state.slotSpin)
  const moving = Boolean(state.moveAnimation)
  const [shopPanel, setShopPanel] = useState<ShopPanel | null>(null)
  const [friendPanel, setFriendPanel] = useState<FriendPanel | null>(null)
  const [officeUi, setOfficeUi] = useState<OfficeUi | null>(null)
  const browseOpen = Boolean(shopPanel || friendPanel)
  const busy = Boolean(
    state.pendingEvent ||
      state.pendingDecision ||
      state.pendingLocation ||
      state.pendingDate ||
      moving ||
      spinning,
  )

  useEffect(() => {
    if (state.pendingLocation?.spaceKind === 'office') setOfficeUi({ step: 'menu' })
    else setOfficeUi(null)
  }, [state.pendingLocation])

  // 777 拉霸动画
  useEffect(() => {
    if (!state.slotSpin) return
    if (state.autoEnabled) {
      dispatch({ type: 'FINISH_SLOT' })
      return
    }
    const t = window.setTimeout(() => dispatch({ type: 'FINISH_SLOT' }), SLOT_SPIN_MS)
    return () => window.clearTimeout(t)
  }, [state.slotSpin, state.autoEnabled, dispatch])

  // 逐格走棋动画
  useEffect(() => {
    if (!state.moveAnimation) return
    if (state.autoEnabled) {
      dispatch({ type: 'FINISH_MOVE' })
      return
    }
    const anim = state.moveAnimation
    if (anim.path.length === 0) {
      dispatch({ type: 'FINISH_MOVE' })
      return
    }
    if (anim.pathIndex < anim.path.length - 1) {
      const t = window.setTimeout(() => dispatch({ type: 'ANIM_STEP' }), MOVE_STEP_MS)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => dispatch({ type: 'FINISH_MOVE' }), MOVE_STEP_MS)
    return () => window.clearTimeout(t)
  }, [state.moveAnimation, state.autoEnabled, dispatch])

  const highlightId =
    state.slotSpin?.playerId ??
    state.moveAnimation?.playerId ??
    state.players[state.turnPlayerIndex]?.id
  const forcedTrack = state.slotSpin?.track ?? state.moveAnimation?.track ?? null

  return (
    <div className="play">
      <TopBar
        state={state}
        onToggleAuto={() => dispatch({ type: 'SET_AUTO', enabled: !state.autoEnabled })}
        onAutoRun={onAutoRun}
      />
      <div className="play-grid">
        <Board
          players={state.players}
          highlightPlayerId={highlightId}
          forcedTrack={forcedTrack}
          slotSpin={state.slotSpin}
          lastReels={state.lastReels}
        />
        <FinancePanel player={human} />
      </div>

      <div className="controls panel">
        <div className="control-row">
          <button
            className="primary"
            disabled={!isHumanTurn || busy || state.autoEnabled}
            onClick={() => dispatch({ type: 'ROLL_AND_MOVE' })}
          >
            {spinning
              ? '拉霸转动中…'
              : moving
                ? '行走中…'
                : `777 拉霸${state.lastDice ? `（上次 ${state.lastReels?.join('-') ?? state.lastDice} 步）` : ''}`}
          </button>
          <button
            disabled={!isHumanTurn || busy || human.actionPoints <= 0}
            onClick={() => dispatch({ type: 'SPEND_ACTION', action: 'date' })}
          >
            约会·交友
          </button>
          <button
            disabled={busy || browseOpen}
            onClick={() => setShopPanel({ step: 'list' })}
          >
            店铺
          </button>
          <button
            disabled={busy || browseOpen}
            onClick={() => setFriendPanel({ step: 'list' })}
          >
            好友
          </button>
          <button
            disabled={!isHumanTurn || busy}
            onClick={() => dispatch({ type: 'END_TURN' })}
          >
            结束回合
          </button>
          {!isHumanTurn && !moving && !spinning && (
            <button className="primary" onClick={() => dispatch({ type: 'AUTO_STEP' })}>
              推进 AI
            </button>
          )}
        </div>
        <p className="muted">
          行动点 {human.actionPoints} · 当前回合：{state.players[state.turnPlayerIndex]?.name}
          {moving ? ' · 棋子移动中' : ''}
        </p>
      </div>

      {state.pendingEvent && (() => {
        const ev = getEvent(state.pendingEvent!.eventId)
        const cash = state.players.find((p) => p.id === state.pendingEvent!.playerId)?.cash ?? 0
        return (
          <div className="modal">
            <div className="modal-card panel">
              {state.pendingEvent!.slotHint && (
                <p className="slot-event-hint muted">{state.pendingEvent!.slotHint}</p>
              )}
              <h3>{state.pendingEvent!.title}</h3>
              <p>{state.pendingEvent!.text}</p>
              <div className="modal-actions event-choices">
                {(ev?.choices ?? [{ id: 'accept', label: '确认', effects: [] }]).map((ch) => {
                  const cost = choiceCashCost(ch.effects)
                  const broke = cost > 0 && !canAffordChoice(cash, ch.effects)
                  return (
                    <button
                      key={ch.id}
                      className={ch.id === 'accept' || ch.id === 'raise' ? 'primary' : undefined}
                      disabled={broke}
                      title={broke ? `现金不足（需约 ${cost} 万）` : undefined}
                      onClick={() => dispatch({ type: 'RESOLVE_EVENT_CHOICE', choiceId: ch.id })}
                    >
                      {ch.label}
                      {broke ? '（现金不足）' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {state.pendingLocation && (
        <div className="modal">
          <div className="modal-card panel location-card">
            <p className="slot-event-hint">落点 · {state.pendingLocation.label}</p>
            {state.pendingLocation.spaceKind === 'vacant' && (
              <>
                <h3>空地待售</h3>
                <p>花 {VACANT_COST} 万买下并开店（需有关系人经营）。</p>
                <div className="modal-actions">
                  <button className="primary" onClick={() => dispatch({ type: 'LOCATION_BUY_VACANT' })}>
                    购置开店
                  </button>
                  <button onClick={() => dispatch({ type: 'LOCATION_SKIP' })}>走开</button>
                </div>
              </>
            )}
            {state.pendingLocation.spaceKind === 'shop' && (
              <>
                <h3>商店柜台</h3>
                <p>买点东西增强关系或能力。</p>
                <div className="shop-list">
                  {SHOP_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      className="shop-item"
                      onClick={() => dispatch({ type: 'LOCATION_BUY_ITEM', itemId: item.id })}
                    >
                      <strong>{item.name}</strong>
                      <span>{item.cost} 万</span>
                      <em>{item.desc}</em>
                    </button>
                  ))}
                </div>
                <button onClick={() => dispatch({ type: 'LOCATION_SKIP' })}>不买了</button>
              </>
            )}
            {state.pendingLocation.spaceKind === 'office' && officeUi && (
              <>
                {officeUi.step === 'menu' && (
                  <>
                    <h3>私人事务所</h3>
                    <p className="muted">本格一次互动：推荐、调好感或挖角。</p>
                    <div className="shop-list">
                      <button
                        className="shop-item"
                        disabled={human.cash + 1e-9 < OFFICE_RECOMMEND_COST}
                        onClick={() => setOfficeUi({ step: 'recommend' })}
                      >
                        <strong>推荐好友</strong>
                        <span>{OFFICE_RECOMMEND_COST} 万</span>
                        <em>为自己结识新人脉或恋人</em>
                      </button>
                      <button
                        className="shop-item"
                        onClick={() => setOfficeUi({ step: 'adjustPick' })}
                      >
                        <strong>调好感</strong>
                        <span>
                          升温 {OFFICE_UP_COST} / 降温 {OFFICE_DOWN_COST} 万
                        </span>
                        <em>对自己或他人的关系升温/降温</em>
                      </button>
                      <button
                        className="shop-item"
                        disabled={
                          human.cash + 1e-9 < OFFICE_POACH_COST ||
                          poachableTargets(human.id, state.players).length === 0
                        }
                        onClick={() => setOfficeUi({ step: 'poachPlayer' })}
                      >
                        <strong>挖角抢人</strong>
                        <span>{OFFICE_POACH_COST} 万</span>
                        <em>选手家再选目标关系</em>
                      </button>
                    </div>
                    <div className="modal-actions">
                      <button onClick={() => dispatch({ type: 'LOCATION_SKIP' })}>离开</button>
                    </div>
                  </>
                )}
                {officeUi.step === 'recommend' && (
                  <>
                    <h3>推荐好友</h3>
                    <p className="muted">花费 {OFFICE_RECOMMEND_COST} 万，选想结识的类型。</p>
                    <div className="modal-actions">
                      {(['network', 'romance'] as RelationKind[]).map((kind) => (
                        <button
                          key={kind}
                          className="primary"
                          disabled={human.cash + 1e-9 < OFFICE_RECOMMEND_COST}
                          onClick={() => dispatch({ type: 'OFFICE_RECOMMEND', kind })}
                        >
                          {kind === 'network' ? '人脉' : '恋人'}
                        </button>
                      ))}
                      <button onClick={() => setOfficeUi({ step: 'menu' })}>返回</button>
                    </div>
                  </>
                )}
                {officeUi.step === 'adjustPick' && (
                  <>
                    <h3>调好感：选对象</h3>
                    <div className="shop-list">
                      {adjustableRelations(human.id, state.players).map(({ owner, rel }) => (
                        <button
                          key={`${owner.id}-${rel.id}`}
                          className="shop-item"
                          onClick={() =>
                            setOfficeUi({
                              step: 'adjustDir',
                              ownerId: owner.id,
                              relationId: rel.id,
                              label: `${owner.id === human.id ? '自己' : owner.name} · ${rel.name}`,
                            })
                          }
                        >
                          <strong>{rel.name}</strong>
                          <span>
                            {owner.id === human.id ? '自己' : owner.name} ·{' '}
                            {relationKindLabel(rel.kind)} · 好感 {rel.score}
                          </span>
                        </button>
                      ))}
                    </div>
                    {!adjustableRelations(human.id, state.players).length && (
                      <p className="muted">暂无可调对象。</p>
                    )}
                    <div className="modal-actions">
                      <button onClick={() => setOfficeUi({ step: 'menu' })}>返回</button>
                    </div>
                  </>
                )}
                {officeUi.step === 'adjustDir' && (
                  <>
                    <h3>调节「{officeUi.label}」</h3>
                    <div className="modal-actions">
                      <button
                        className="primary"
                        disabled={human.cash + 1e-9 < OFFICE_UP_COST}
                        onClick={() =>
                          dispatch({
                            type: 'OFFICE_ADJUST',
                            ownerId: officeUi.ownerId,
                            relationId: officeUi.relationId,
                            direction: 'up',
                          })
                        }
                      >
                        升温（{OFFICE_UP_COST} 万 · +
                        {adjustDelta(human.id, officeUi.ownerId, 'up')}）
                      </button>
                      <button
                        disabled={human.cash + 1e-9 < OFFICE_DOWN_COST}
                        onClick={() =>
                          dispatch({
                            type: 'OFFICE_ADJUST',
                            ownerId: officeUi.ownerId,
                            relationId: officeUi.relationId,
                            direction: 'down',
                          })
                        }
                      >
                        降温（{OFFICE_DOWN_COST} 万 ·{' '}
                        {adjustDelta(human.id, officeUi.ownerId, 'down')}）
                      </button>
                      <button onClick={() => setOfficeUi({ step: 'adjustPick' })}>返回</button>
                    </div>
                  </>
                )}
                {officeUi.step === 'poachPlayer' && (
                  <>
                    <h3>挖角：选手家</h3>
                    <div className="shop-list">
                      {state.players
                        .filter((p) => p.id !== human.id)
                        .filter((p) => poachableTargets(human.id, [p]).length > 0 || p.relations.some((r) => r.status !== 'broken' && !r.locked))
                        .map((p) => {
                          const n = poachableTargets(human.id, state.players).filter(
                            (t) => t.owner.id === p.id,
                          ).length
                          return (
                            <button
                              key={p.id}
                              className="shop-item"
                              disabled={n === 0}
                              onClick={() =>
                                setOfficeUi({
                                  step: 'poachRel',
                                  targetPlayerId: p.id,
                                  targetName: p.name,
                                })
                              }
                            >
                              <strong>{p.name}</strong>
                              <span>可挖 {n} 人</span>
                            </button>
                          )
                        })}
                    </div>
                    <div className="modal-actions">
                      <button onClick={() => setOfficeUi({ step: 'menu' })}>返回</button>
                    </div>
                  </>
                )}
                {officeUi.step === 'poachRel' && (
                  <>
                    <h3>挖角：选「{officeUi.targetName}」的关系</h3>
                    <p className="muted">花费 {OFFICE_POACH_COST} 万（失败也扣）。</p>
                    <div className="shop-list">
                      {poachableTargets(human.id, state.players)
                        .filter((t) => t.owner.id === officeUi.targetPlayerId)
                        .map(({ rel }) => (
                          <button
                            key={rel.id}
                            className="shop-item"
                            disabled={human.cash + 1e-9 < OFFICE_POACH_COST}
                            onClick={() =>
                              dispatch({
                                type: 'OFFICE_POACH',
                                targetPlayerId: officeUi.targetPlayerId,
                                relationId: rel.id,
                              })
                            }
                          >
                            <strong>{rel.name}</strong>
                            <span>
                              {relationKindLabel(rel.kind)} · 好感 {rel.score} · 成功率约{' '}
                              {Math.round(poachSuccessChance(rel.score) * 100)}%
                            </span>
                          </button>
                        ))}
                    </div>
                    <div className="modal-actions">
                      <button onClick={() => setOfficeUi({ step: 'poachPlayer' })}>返回</button>
                    </div>
                  </>
                )}
              </>
            )}
            {state.pendingLocation.spaceKind === 'manage' && (
              <>
                <h3>经营区</h3>
                <p>花 0.2 万升级/加码你的店铺。</p>
                <div className="modal-actions">
                  <button className="primary" onClick={() => dispatch({ type: 'LOCATION_MANAGE' })}>
                    经营升级
                  </button>
                  <button onClick={() => dispatch({ type: 'LOCATION_SKIP' })}>下次再说</button>
                </div>
              </>
            )}
            {state.pendingLocation.spaceKind === 'casino' && (
              <>
                <h3>赌场</h3>
                <p>约 45% 概率赢回双倍（净赚一注），否则输掉赌注。</p>
                <div className="shop-list">
                  {[0.2, 0.5, 1.0].map((bet) => (
                    <button
                      key={bet}
                      className="shop-item"
                      onClick={() => dispatch({ type: 'LOCATION_GAMBLE', bet })}
                    >
                      <strong>押 {bet} 万</strong>
                      <span>搏一把</span>
                      <em>赢则 +{bet} 万，输则 -{bet} 万</em>
                    </button>
                  ))}
                </div>
                <button onClick={() => dispatch({ type: 'LOCATION_SKIP' })}>不赌了</button>
              </>
            )}
          </div>
        </div>
      )}

      {friendPanel && (
        <div className="modal">
          <div className="modal-card panel location-card">
            {friendPanel.step === 'list' && (
              <>
                <h3>好友与关系</h3>
                <p className="muted">点选查看人物详情（只读）。</p>
                {human.relations.length === 0 ? (
                  <p className="muted">暂无关系。可通过事件结识或约会·交友推进。</p>
                ) : (
                  <div className="shop-list">
                    {[...human.relations]
                      .sort((a, b) => {
                        if (a.status === 'broken' && b.status !== 'broken') return 1
                        if (b.status === 'broken' && a.status !== 'broken') return -1
                        return b.score - a.score
                      })
                      .map((r) => (
                        <button
                          key={r.id}
                          className="shop-item"
                          onClick={() => setFriendPanel({ step: 'detail', relationId: r.id })}
                        >
                          <strong>{r.name}</strong>
                          <span>
                            {relationKindLabel(r.kind)} · {relationStatusLabel(r.status)} · 好感{' '}
                            {r.score}
                          </span>
                          {r.locked ? <em>已锁定</em> : null}
                        </button>
                      ))}
                  </div>
                )}
                <div className="modal-actions">
                  <button onClick={() => setFriendPanel(null)}>关闭</button>
                </div>
              </>
            )}
            {friendPanel.step === 'detail' &&
              (() => {
                const rel = human.relations.find((r) => r.id === friendPanel.relationId)
                if (!rel) {
                  return (
                    <>
                      <h3>人物不存在</h3>
                      <div className="modal-actions">
                        <button onClick={() => setFriendPanel({ step: 'list' })}>返回列表</button>
                      </div>
                    </>
                  )
                }
                const operated = human.shops.filter((s) => s.operatorRelationId === rel.id)
                return (
                  <>
                    <h3>{rel.name}</h3>
                    <ul className="shop-detail-list">
                      <li>类型：{relationKindLabel(rel.kind)}</li>
                      <li>状态：{relationStatusLabel(rel.status)}</li>
                      <li>好感：{rel.score}</li>
                      <li>锁定：{rel.locked ? '是（较难被挖走）' : '否'}</li>
                      <li>
                        经营店铺：
                        {operated.length
                          ? operated.map((s) => `${s.name}（Lv.${s.level}）`).join('、')
                          : '无'}
                      </li>
                    </ul>
                    <div className="modal-actions">
                      <button className="primary" onClick={() => setFriendPanel({ step: 'list' })}>
                        返回列表
                      </button>
                      <button onClick={() => setFriendPanel(null)}>关闭</button>
                    </div>
                  </>
                )
              })()}
          </div>
        </div>
      )}

      {shopPanel && (
        <div className="modal">
          <div className="modal-card panel location-card">
            {shopPanel.step === 'list' && (
              <>
                <h3>我的店铺</h3>
                <p className="muted">点选查看详情（只读，不消耗行动点）。</p>
                {human.shops.length === 0 ? (
                  <p className="muted">暂无店铺。可通过事件开店或购置空地。</p>
                ) : (
                  <div className="shop-list">
                    {human.shops.map((shop) => {
                      const op = human.relations.find((r) => r.id === shop.operatorRelationId)
                      const cf = shopCashflow(shop, human.relations)
                      return (
                        <button
                          key={shop.id}
                          className="shop-item"
                          onClick={() => setShopPanel({ step: 'detail', shopId: shop.id })}
                        >
                          <strong>{shop.name}</strong>
                          <span>
                            Lv.{shop.level} · 现金流 {cf.toFixed(2)} 万
                          </span>
                          <em>经营者：{op?.name ?? '（缺失）'}</em>
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="modal-actions">
                  <button onClick={() => setShopPanel(null)}>关闭</button>
                </div>
              </>
            )}
            {shopPanel.step === 'detail' &&
              (() => {
                const shop = human.shops.find((s) => s.id === shopPanel.shopId)
                if (!shop) {
                  return (
                    <>
                      <h3>店铺不存在</h3>
                      <div className="modal-actions">
                        <button onClick={() => setShopPanel({ step: 'list' })}>返回列表</button>
                      </div>
                    </>
                  )
                }
                const op = human.relations.find((r) => r.id === shop.operatorRelationId)
                const cf = shopCashflow(shop, human.relations)
                return (
                  <>
                    <h3>{shop.name}</h3>
                    <ul className="shop-detail-list">
                      <li>等级：Lv.{shop.level}</li>
                      <li>基础现金流：{shop.baseCashflow.toFixed(2)} 万</li>
                      <li>实际现金流：{cf.toFixed(2)} 万（受经营者好感影响）</li>
                      <li>账面估值：约 {shopBookValue(shop).toFixed(2)} 万</li>
                      <li>
                        经营者：
                        {op
                          ? `${op.name}（好感 ${op.score} · ${relationStatusLabel(op.status)}）`
                          : '无（店铺停业）'}
                      </li>
                    </ul>
                    <div className="modal-actions">
                      <button className="primary" onClick={() => setShopPanel({ step: 'list' })}>
                        返回列表
                      </button>
                      <button onClick={() => setShopPanel(null)}>关闭</button>
                    </div>
                  </>
                )
              })()}
          </div>
        </div>
      )}

      {state.pendingDate && (() => {
        const dater = state.players.find((p) => p.id === state.pendingDate!.playerId) ?? human
        const partners = dateableRelations(dater)
        const picked = partners.find((r) => r.id === state.pendingDate!.relationId)
        return (
          <div className="modal">
            <div className="modal-card panel location-card">
              {state.pendingDate!.step === 'pickPartner' && (
                <>
                  <h3>约会·交友：约谁？</h3>
                  <p className="muted">可选恋人或人脉，再选见面方式。</p>
                  <div className="shop-list">
                    {partners.map((r) => (
                      <button
                        key={r.id}
                        className="shop-item"
                        onClick={() => dispatch({ type: 'DATE_PICK_PARTNER', relationId: r.id })}
                      >
                        <strong>{r.name}</strong>
                        <span>
                          {relationKindLabel(r.kind)} · {relationStatusLabel(r.status)} · 好感{' '}
                          {r.score}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="modal-actions">
                    <button onClick={() => dispatch({ type: 'DATE_CANCEL' })}>算了</button>
                  </div>
                </>
              )}
              {state.pendingDate!.step === 'pickVenue' && picked && (
                <>
                  <h3>
                    和「{picked.name}」
                    {picked.kind === 'romance' ? '约会' : '见面'}去哪儿？
                  </h3>
                  <p className="muted">确认后消耗 1 行动点与对应现金。</p>
                  <div className="shop-list">
                    {DATE_VENUES.map((v) => {
                      const broke = dater.cash + 1e-9 < v.cost
                      const boost = dateBoostFor(dater, v, picked)
                      return (
                        <button
                          key={v.id}
                          className="shop-item"
                          disabled={broke}
                          title={broke ? '现金不足' : undefined}
                          onClick={() => dispatch({ type: 'DATE_CONFIRM_VENUE', venueId: v.id })}
                        >
                          <strong>{v.name}</strong>
                          <span>
                            {v.cost} 万 · 好感 +{boost}
                            {broke ? '（现金不足）' : ''}
                          </span>
                          <em>{v.blurb}</em>
                        </button>
                      )
                    })}
                  </div>
                  <div className="modal-actions">
                    <button onClick={() => dispatch({ type: 'DATE_CANCEL' })}>算了</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {state.pendingDecision && (
        <div className="modal">
          <div className="modal-card panel">
            {state.pendingDecision.type === 'promote' && (
              <>
                <h3>可以晋级投资人圈</h3>
                <p>被动收入已超过总支出。是否进入外圈？</p>
                <div className="modal-actions">
                  <button className="primary" onClick={() => dispatch({ type: 'PROMOTE_TO_INVESTOR' })}>
                    晋级
                  </button>
                  <button onClick={() => dispatch({ type: 'SKIP_PROMOTE' })}>暂留打工人圈</button>
                </div>
              </>
            )}
            {state.pendingDecision.type === 'marriage' && (
              <>
                <h3>谈婚论嫁</h3>
                <p>要结婚吗？会花 0.5 万，并让其他恋情降温。</p>
                <div className="modal-actions">
                  <button className="primary" onClick={() => dispatch({ type: 'CONFIRM_MARRIAGE', accept: true })}>
                    结婚
                  </button>
                  <button onClick={() => dispatch({ type: 'CONFIRM_MARRIAGE', accept: false })}>再等等</button>
                </div>
              </>
            )}
            {state.pendingDecision.type === 'bigSpend' && (
              <>
                <h3>大额决策：{state.pendingDecision.name}</h3>
                <p>
                  花费 {state.pendingDecision.cost} 万，预期现金流 +{state.pendingDecision.cashflow}
                </p>
                <div className="modal-actions">
                  <button className="primary" onClick={() => dispatch({ type: 'CONFIRM_BIG_SPEND', accept: true })}>
                    买入
                  </button>
                  <button onClick={() => dispatch({ type: 'CONFIRM_BIG_SPEND', accept: false })}>放弃</button>
                </div>
              </>
            )}
            {state.pendingDecision.type === 'poach' && (
              <>
                <h3>挖角警告</h3>
                <p>有人想挖走你的关系。花 0.15 万挽留，还是放人？</p>
                <div className="modal-actions">
                  <button className="primary" onClick={() => dispatch({ type: 'CONFIRM_POACH', accept: false })}>
                    挽留
                  </button>
                  <button onClick={() => dispatch({ type: 'CONFIRM_POACH', accept: true })}>放人</button>
                </div>
              </>
            )}
            {state.pendingDecision.type === 'bankrupt' && (
              <>
                <h3>现金流断裂</h3>
                <p>需要记账负债 {state.pendingDecision.amount} 万并可能变卖投资。</p>
                <button className="primary" onClick={() => dispatch({ type: 'RESOLVE_BANKRUPT' })}>
                  处理
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="log panel">
        <h3>本季日志</h3>
        <ul>
          {[...state.logs].reverse().slice(0, 12).map((l) => (
            <li key={l.id}>{l.text}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
