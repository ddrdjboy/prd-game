import { useEffect, useRef, useState } from 'react'
import {
  EVENT_TASTE_MS,
  INVESTOR_START_BONUS,
  MOMENT_BANNER_MS,
  MOVE_STEP_MS,
  SLOT_SPIN_MS,
  getComboHoldMs,
} from '../../game/config'
import {
  DATE_VENUES,
  dateBoostFor,
  dateableRelations,
  relationKindLabel,
  relationStatusLabel,
} from '../../game/dating'
import { canAffordChoice, choiceCashCost, getEvent } from '../../game/events'
import { diffPlayerTaste, type TasteLine } from '../../game/eventTaste'
import { calcFinance, shopBookValue, shopBreakdown } from '../../game/finance'
import { upgradeCostFor, shopTypeById } from '../../game/shopCatalog'
import { SHOP_ITEMS, VACANT_COST, VACANT_HIRE_EXTRA, investOffersFor, PARK_REST_CASH, PARK_CHAT_BOOST, INVEST_SELL_RATIO, CASINO_BETS } from '../../game/location'
import { formatHand, blackjackTotal, cardLabel } from '../../game/casino'
import { willBreakNextDecay } from '../../game/relations'
import { SKILLS, skillLabel, shopCapacity } from '../../game/skills'
import {
  canAssignToShop,
  canLearnSkill,
  occupationLabel,
  shopHasCapacity,
} from '../../game/shopStaff'
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
import {
  VISIT_GIFTS,
  VISIT_POACH_FEE,
} from '../../game/visitShop'
import {
  EXCHANGE_STAKES,
  symbolDefById,
  tradeEquity,
  type Leverage,
} from '../../game/exchange'
import { resolveSlotEvent } from '../../game/slotEvents'
import type { AutoSensitivity, GameAction, GameState, PlayerState, RelationKind } from '../../game/types'
import { Board } from '../components/Board'
import { FinancePanel } from '../components/FinancePanel'
import { TopBar } from '../components/TopBar'
import { TUTORIAL_LINES, hasSeenTutorial, markTutorialSeen } from '../tutorial'
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
  | { step: 'train'; relationId: string }

type OfficeUi =
  | { step: 'menu' }
  | { step: 'recommend' }
  | { step: 'adjustPick' }
  | { step: 'adjustDir'; ownerId: string; relationId: string; label: string }
  | { step: 'poachPlayer' }
  | { step: 'poachRel'; targetPlayerId: string; targetName: string }

type ManageUi =
  | { step: 'menu' }
  | { step: 'upgrade' }
  | { step: 'staffShop' }
  | { step: 'staffHub'; shopId: string; shopName: string }
  | { step: 'addStaff'; shopId: string; shopName: string }
  | { step: 'removeStaff'; shopId: string; shopName: string }
  | { step: 'setManager'; shopId: string; shopName: string }

export function PlayScreen({ state, dispatch, onAutoRun }: Props) {
  const human = state.players[0]
  const isHumanTurn = state.players[state.turnPlayerIndex]?.isHuman
  const spinning = Boolean(state.slotSpin)
  const moving = Boolean(state.moveAnimation)
  const [shopPanel, setShopPanel] = useState<ShopPanel | null>(null)
  const [friendPanel, setFriendPanel] = useState<FriendPanel | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [financeOpen, setFinanceOpen] = useState(false)
  const [officeUi, setOfficeUi] = useState<OfficeUi | null>(null)
  const [manageUi, setManageUi] = useState<ManageUi | null>(null)
  const [showTutorial, setShowTutorial] = useState(() => !hasSeenTutorial())
  const [comboFlash, setComboFlash] = useState<string | null>(null)
  const [momentBanner, setMomentBanner] = useState<string | null>(null)
  const [eventTaste, setEventTaste] = useState<{
    title: string
    lines: TasteLine[]
    note?: string
  } | null>(null)
  const seenLogId = useRef<string | null>(null)
  const tasteArmRef = useRef<{
    befores: PlayerState[]
    title: string
    waitFor: 'event' | 'location' | 'date' | 'decision'
    focusId: string
  } | null>(null)
  const recentLogs = [...state.logs].reverse().slice(0, 12)
  const latestLog = recentLogs[0]?.text

  const dispatchTaste = (
    title: string,
    waitFor: 'event' | 'location' | 'date' | 'decision',
    action: GameAction,
    focusId: string = human.id,
  ) => {
    tasteArmRef.current = {
      befores: state.players,
      title,
      waitFor,
      focusId,
    }
    dispatch(action)
  }

  const browseOpen = Boolean(shopPanel || friendPanel || logOpen || financeOpen)
  const busy = Boolean(
    state.pendingEvent ||
      state.pendingDecision ||
      state.pendingLocation ||
      state.pendingDate ||
      moving ||
      spinning ||
      comboFlash ||
      eventTaste,
  )

  useEffect(() => {
    if (state.pendingLocation?.spaceKind === 'office') setOfficeUi({ step: 'menu' })
    else setOfficeUi(null)
    if (state.pendingLocation?.spaceKind === 'manage') setManageUi({ step: 'menu' })
    else setManageUi(null)
    if (state.pendingLocation?.spaceKind === 'casino' && !state.pendingCasino) {
      dispatch({ type: 'CASINO_ENTER' })
    }
    if (state.pendingLocation?.spaceKind === 'invest' && !state.pendingExchange) {
      dispatch({ type: 'EXCHANGE_ENTER' })
    }
  }, [state.pendingLocation, state.pendingCasino, state.pendingExchange, dispatch])

  // 777 拉霸动画：有连爆时多停一拍再走棋
  useEffect(() => {
    if (!state.slotSpin) return
    if (state.autoEnabled) {
      dispatch({ type: 'FINISH_SLOT' })
      return
    }
    const spin = state.slotSpin
    const hold = getComboHoldMs()
    const combo = resolveSlotEvent(spin.reels, spin.track).comboLabel
    let cancelled = false
    let holdTimer: number | undefined
    const spinTimer = window.setTimeout(() => {
      if (cancelled) return
      if (combo && hold > 0) {
        setComboFlash(combo)
        holdTimer = window.setTimeout(() => {
          if (cancelled) return
          setComboFlash(null)
          dispatch({ type: 'FINISH_SLOT' })
        }, hold)
      } else {
        dispatch({ type: 'FINISH_SLOT' })
      }
    }, SLOT_SPIN_MS)
    return () => {
      cancelled = true
      window.clearTimeout(spinTimer)
      if (holdTimer != null) window.clearTimeout(holdTimer)
    }
  }, [state.slotSpin, state.autoEnabled, dispatch])

  // 发薪 / 晋级瞬间横幅
  useEffect(() => {
    const last = state.logs[state.logs.length - 1]
    if (!last || last.id === seenLogId.current) return
    seenLogId.current = last.id
    if (last.text.includes('结算现金流') || last.text.includes('身份转变')) {
      setMomentBanner(last.text.replace(/。$/, ''))
      const t = window.setTimeout(() => setMomentBanner(null), MOMENT_BANNER_MS)
      return () => window.clearTimeout(t)
    }
  }, [state.logs])

  // 事件 / 落点 / 约会 / 决策 结算后：展示数值变化 1.5s
  useEffect(() => {
    const arm = tasteArmRef.current
    if (!arm) return
    const waiting =
      (arm.waitFor === 'event' && state.pendingEvent) ||
      (arm.waitFor === 'location' && state.pendingLocation) ||
      (arm.waitFor === 'date' && state.pendingDate) ||
      (arm.waitFor === 'decision' && state.pendingDecision)
    if (waiting) return

    tasteArmRef.current = null
    if (state.autoEnabled) return

    const lines: TasteLine[] = []
    for (const after of state.players) {
      const before = arm.befores.find((p) => p.id === after.id)
      if (!before) continue
      const part = diffPlayerTaste(before, after)
      if (after.id === arm.focusId) {
        lines.push(...part)
      } else {
        for (const line of part) {
          const isRel =
            line.label.includes('「') ||
            line.label.includes('结识') ||
            line.label.includes('失去')
          if (isRel) {
            lines.push({ ...line, label: `${after.name} ${line.label}` })
          }
        }
      }
    }

    const note =
      arm.waitFor === 'event' && state.pendingDecision?.type === 'bigSpend'
        ? `待确认：${state.pendingDecision.name}（${state.pendingDecision.cost} 万）`
        : arm.waitFor === 'event' && state.pendingDecision?.type === 'marriage'
          ? '待确认：谈婚论嫁'
          : arm.waitFor === 'event' && state.pendingDecision?.type === 'promote'
            ? '可晋级投资人圈'
            : undefined

    setEventTaste({ title: arm.title, lines, note })
    const t = window.setTimeout(() => setEventTaste(null), EVENT_TASTE_MS)
    return () => window.clearTimeout(t)
    // 依赖 pending* 关闭瞬间；players 已在同一次 render 更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingEvent, state.pendingLocation, state.pendingDate, state.pendingDecision])

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
  const comboLabelLive =
    comboFlash ??
    (state.slotSpin
      ? resolveSlotEvent(state.slotSpin.reels, state.slotSpin.track).comboLabel
      : null)

  const cycleSensitivity = () => {
    const order: AutoSensitivity[] = ['low', 'standard', 'high']
    const i = order.indexOf(state.autoSensitivity)
    const next = order[(i + 1) % order.length]
    dispatch({ type: 'SET_SENSITIVITY', value: next })
  }

  const dismissTutorial = () => {
    markTutorialSeen()
    setShowTutorial(false)
  }

  return (
    <div className="play">
      <TopBar
        state={state}
        onToggleAuto={() => dispatch({ type: 'SET_AUTO', enabled: !state.autoEnabled })}
        onAutoRun={onAutoRun}
        onCycleSensitivity={cycleSensitivity}
      />
      {momentBanner && (
        <div className="moment-banner" role="status">
          {momentBanner}
        </div>
      )}
      {showTutorial && (
        <div className="modal">
          <div className="modal-card panel">
            <h3>90 秒上手</h3>
            <ol className="tutorial-list">
              {TUTORIAL_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={dismissTutorial}>
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="play-grid">
        <Board
          players={state.players}
          highlightPlayerId={highlightId}
          forcedTrack={forcedTrack}
          slotSpin={state.slotSpin}
          lastReels={state.lastReels}
          comboLabel={comboLabelLive}
          comboFlash={Boolean(comboFlash)}
        />
        <div className="info-split panel">
          <FinancePanel
            player={human}
            open={financeOpen}
            onOpenChange={setFinanceOpen}
            disabled={busy || Boolean(shopPanel || friendPanel || logOpen)}
          />
          <button
            type="button"
            className="log-trigger"
            disabled={busy || Boolean(shopPanel || friendPanel || financeOpen)}
            onClick={() => setLogOpen(true)}
          >
            <span className="log-trigger-main">
              <strong>本季日志</strong>
              {latestLog && <span className="log-preview muted">{latestLog}</span>}
            </span>
          </button>
        </div>
      </div>

      <div className="controls panel controls-actions">
        <div className="control-secondary">
          <button
            disabled={!isHumanTurn || busy || human.actionPoints <= 0}
            onClick={() => dispatch({ type: 'SPEND_ACTION', action: 'date' })}
          >
            <span className="btn-full">约会·交友</span>
            <span className="btn-short">约会</span>
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
        </div>
      </div>

      <div className="controls panel controls-spin">
        {(() => {
          const canRoll =
            isHumanTurn && !busy && !state.autoEnabled && !state.turnRolled
          const canEnd =
            isHumanTurn && !busy && !state.autoEnabled && state.turnRolled
          const pushAi = !isHumanTurn && !moving && !spinning && !busy

          if (pushAi) {
            return (
              <button className="primary control-spin" onClick={() => dispatch({ type: 'AUTO_STEP' })}>
                推进 AI
              </button>
            )
          }

          if (canEnd) {
            return (
              <button
                className="primary control-spin"
                onClick={() => dispatch({ type: 'END_TURN' })}
              >
                结束回合
              </button>
            )
          }

          return (
            <button
              className="primary control-spin"
              disabled={!canRoll}
              onClick={() => dispatch({ type: 'ROLL_AND_MOVE' })}
            >
              {spinning
                ? '拉霸中…'
                : moving
                  ? '行走中…'
                  : busy
                    ? '行动中…'
                    : `777 拉霸${state.lastDice && !state.turnRolled ? ` · ${state.lastReels?.join('-') ?? state.lastDice}` : ''}`}
            </button>
          )
        })()}
      </div>

      {state.pendingEvent && (() => {
        const ev = getEvent(state.pendingEvent!.eventId)
        const actorId = state.pendingEvent!.playerId
        const cash = state.players.find((p) => p.id === actorId)?.cash ?? 0
        const resolveChoice = (choiceId: string) => {
          dispatchTaste(state.pendingEvent!.title, 'event', {
            type: 'RESOLVE_EVENT_CHOICE',
            choiceId,
          }, actorId)
        }
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
                      onClick={() => resolveChoice(ch.id)}
                    >
                      {ch.label}
                      {broke ? '（现金不足）' : ''}
                    </button>
                  )
                })}
                {ev &&
                  ev.choices.every((ch) => !canAffordChoice(cash, ch.effects)) && (
                    <button type="button" onClick={() => resolveChoice('__skip__')}>
                      手头太紧，空手过关
                    </button>
                  )}
              </div>
            </div>
          </div>
        )
      })()}

      {eventTaste && (
        <div className="modal event-taste-modal">
          <div className="modal-card panel event-taste-card">
            <p className="slot-event-hint muted">结果</p>
            <h3>{eventTaste.title}</h3>
            {eventTaste.lines.length === 0 ? (
              <p className="muted">本事件没有直接数值变化。</p>
            ) : (
              <ul className="event-taste-list">
                {eventTaste.lines.map((line) => (
                  <li key={`${line.label}-${line.delta}`} className={`taste-${line.tone}`}>
                    <span>{line.label}</span>
                    <strong>{line.delta}</strong>
                  </li>
                ))}
              </ul>
            )}
            {eventTaste.note ? <p className="event-taste-note">{eventTaste.note}</p> : null}
          </div>
        </div>
      )}

      {state.pendingLocation && !state.pendingDecision && !eventTaste && (
        <div className="modal">
          <div className="modal-card panel location-card">
            <p className="slot-event-hint">落点 · {state.pendingLocation.label}</p>
            {state.pendingVisitShop && (
              <VisitPanel state={state} human={human} dispatch={dispatch} />
            )}
            {!state.pendingVisitShop && state.pendingLocation.spaceKind === 'vacant' && (
              <>
                <h3>空地待售</h3>
                <p>花 {VACANT_COST} 万开店；没人脉可加 {VACANT_HIRE_EXTRA} 万雇临时店长。</p>
                {human.relations.filter((r) => canAssignToShop(human, r.id)).length === 0 && (
                  <p className="muted">
                    暂无空闲人选。可雇临时店长，或先结识/等人进修完成后再来。
                  </p>
                )}
                <div className="shop-list">
                  {human.relations
                    .filter((r) => canAssignToShop(human, r.id))
                    .map((r) => (
                      <button
                        key={r.id}
                        className="shop-item"
                        disabled={human.cash + 1e-9 < VACANT_COST}
                        onClick={() =>
                          dispatchTaste('空地开店', 'location', {
                            type: 'LOCATION_BUY_VACANT',
                            relationId: r.id,
                          })
                        }
                      >
                        <strong>{r.name}</strong>
                        <span>
                          好感 {r.score}
                          {r.skills.length
                            ? ` · ${r.skills.map(skillLabel).join('、')}`
                            : ''}
                        </span>
                        <em>购置并由其任店长</em>
                      </button>
                    ))}
                  <button
                    className="shop-item"
                    disabled={human.cash + 1e-9 < VACANT_COST + VACANT_HIRE_EXTRA}
                    onClick={() =>
                      dispatchTaste('空地开店', 'location', {
                        type: 'LOCATION_BUY_VACANT',
                        relationId: '__hire__',
                      })
                    }
                  >
                    <strong>雇临时店长开店</strong>
                    <span>{(VACANT_COST + VACANT_HIRE_EXTRA).toFixed(2)} 万</span>
                    <em>自动结识一人当店长</em>
                  </button>
                </div>
                <button onClick={() => dispatch({ type: 'LOCATION_SKIP' })}>走开</button>
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
                      onClick={() =>
                        dispatchTaste(`买「${item.name}」`, 'location', {
                          type: 'LOCATION_BUY_ITEM',
                          itemId: item.id,
                        })
                      }
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
                          human.poachCooldown > 0 ||
                          poachableTargets(human.id, state.players).length === 0
                        }
                        onClick={() => setOfficeUi({ step: 'poachPlayer' })}
                      >
                        <strong>挖角抢人</strong>
                        <span>
                          {human.poachCooldown > 0
                            ? `冷却 ${human.poachCooldown}`
                            : `${OFFICE_POACH_COST} 万`}
                        </span>
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
                          onClick={() =>
                            dispatchTaste(
                              kind === 'network' ? '事务所推荐人脉' : '事务所推荐恋人',
                              'location',
                              { type: 'OFFICE_RECOMMEND', kind },
                            )
                          }
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
                          dispatchTaste('事务所升温', 'location', {
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
                          dispatchTaste('事务所降温', 'location', {
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
                              dispatchTaste(`挖角「${rel.name}」`, 'location', {
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
            {state.pendingLocation.spaceKind === 'manage' && manageUi && (
              <>
                {manageUi.step === 'menu' && (
                  <>
                    <h3>经营区</h3>
                    <p className="muted">升级店铺，或调整编制（加人 / 走人 / 换店长）。</p>
                    <div className="shop-list">
                      <button
                        className="shop-item"
                        disabled={!human.shops.length}
                        onClick={() => setManageUi({ step: 'upgrade' })}
                      >
                        <strong>升级店铺</strong>
                        <span>0.2 万</span>
                        <em>选一家加码</em>
                      </button>
                      <button
                        className="shop-item"
                        disabled={!human.shops.length}
                        onClick={() => setManageUi({ step: 'staffShop' })}
                      >
                        <strong>编制管理</strong>
                        <span>免费</span>
                        <em>加人 · 走人 · 换店长</em>
                      </button>
                    </div>
                    <button onClick={() => dispatch({ type: 'LOCATION_SKIP' })}>下次再说</button>
                  </>
                )}
                {manageUi.step === 'upgrade' && (
                  <>
                    <h3>升级哪家店？</h3>
                    <div className="shop-list">
                      {human.shops.map((shop) => {
                        const cost = upgradeCostFor(shop)
                        const def = shopTypeById(shop.typeId)
                        const bd = shopBreakdown(shop, human.relations)
                        return (
                          <button
                            key={shop.id}
                            className="shop-item"
                            disabled={human.cash + 1e-9 < cost}
                            onClick={() =>
                              dispatchTaste(`升级「${shop.name}」`, 'location', {
                                type: 'LOCATION_UPGRADE_SHOP',
                                shopId: shop.id,
                              })
                            }
                          >
                            <strong>{shop.name}</strong>
                            <span>
                              {def?.label ?? shop.typeId} · Lv.{shop.level} · 编制{' '}
                              {shop.staffIds.length}/{shopCapacity(shop.level)}
                            </span>
                            <em>
                              {cost} 万 · 净 {bd.net.toFixed(2)}
                            </em>
                          </button>
                        )
                      })}
                    </div>
                    <button onClick={() => setManageUi({ step: 'menu' })}>返回</button>
                  </>
                )}
                {manageUi.step === 'staffShop' && (
                  <>
                    <h3>选店铺调编制</h3>
                    <div className="shop-list">
                      {human.shops.map((shop) => {
                        const mgr = human.relations.find((r) => r.id === shop.managerId)
                        return (
                          <button
                            key={shop.id}
                            className="shop-item"
                            onClick={() =>
                              setManageUi({
                                step: 'staffHub',
                                shopId: shop.id,
                                shopName: shop.name,
                              })
                            }
                          >
                            <strong>{shop.name}</strong>
                            <span>
                              {shop.staffIds.length}/{shopCapacity(shop.level)} 人
                            </span>
                            <em>店长：{mgr?.name ?? '—'}</em>
                          </button>
                        )
                      })}
                    </div>
                    <button onClick={() => setManageUi({ step: 'menu' })}>返回</button>
                  </>
                )}
                {manageUi.step === 'staffHub' && (
                  <>
                    <h3>「{manageUi.shopName}」编制</h3>
                    <div className="shop-list">
                      <button
                        className="shop-item"
                        onClick={() =>
                          setManageUi({
                            step: 'addStaff',
                            shopId: manageUi.shopId,
                            shopName: manageUi.shopName,
                          })
                        }
                      >
                        <strong>加人</strong>
                        <span>空闲好友</span>
                        <em>进店当店员</em>
                      </button>
                      <button
                        className="shop-item"
                        onClick={() =>
                          setManageUi({
                            step: 'removeStaff',
                            shopId: manageUi.shopId,
                            shopName: manageUi.shopName,
                          })
                        }
                      >
                        <strong>走人</strong>
                        <span>离店</span>
                        <em>0 人将关店卖出</em>
                      </button>
                      <button
                        className="shop-item"
                        onClick={() =>
                          setManageUi({
                            step: 'setManager',
                            shopId: manageUi.shopId,
                            shopName: manageUi.shopName,
                          })
                        }
                      >
                        <strong>换店长</strong>
                        <span>店内人选</span>
                        <em>任命店长</em>
                      </button>
                    </div>
                    <button onClick={() => setManageUi({ step: 'staffShop' })}>返回</button>
                  </>
                )}
                {manageUi.step === 'addStaff' &&
                  (() => {
                    const shop = human.shops.find((s) => s.id === manageUi.shopId)
                    const free = human.relations.filter((r) => canAssignToShop(human, r.id))
                    return (
                      <>
                        <h3>「{manageUi.shopName}」加人</h3>
                        {!shopHasCapacity(shop!) && <p className="muted">编制已满。</p>}
                        <div className="shop-list">
                          {free.map((r) => (
                            <button
                              key={r.id}
                              className="shop-item"
                              disabled={!shop || !shopHasCapacity(shop)}
                              onClick={() =>
                                dispatchTaste(`「${r.name}」进店`, 'location', {
                                  type: 'SHOP_ADD_STAFF',
                                  shopId: manageUi.shopId,
                                  relationId: r.id,
                                })
                              }
                            >
                              <strong>{r.name}</strong>
                              <span>
                                好感 {r.score}
                                {r.skills.length
                                  ? ` · ${r.skills.map(skillLabel).join('、')}`
                                  : ''}
                              </span>
                              <em>{occupationLabel(human, r)}</em>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() =>
                            setManageUi({
                              step: 'staffHub',
                              shopId: manageUi.shopId,
                              shopName: manageUi.shopName,
                            })
                          }
                        >
                          返回
                        </button>
                      </>
                    )
                  })()}
                {manageUi.step === 'removeStaff' &&
                  (() => {
                    const shop = human.shops.find((s) => s.id === manageUi.shopId)
                    const staff = (shop?.staffIds ?? [])
                      .map((id) => human.relations.find((r) => r.id === id))
                      .filter((r): r is NonNullable<typeof r> => Boolean(r))
                    return (
                      <>
                        <h3>「{manageUi.shopName}」走人</h3>
                        <div className="shop-list">
                          {staff.map((r) => (
                            <button
                              key={r.id}
                              className="shop-item"
                              onClick={() =>
                                dispatchTaste(`「${r.name}」离店`, 'location', {
                                  type: 'SHOP_REMOVE_STAFF',
                                  shopId: manageUi.shopId,
                                  relationId: r.id,
                                })
                              }
                            >
                              <strong>{r.name}</strong>
                              <span>
                                {shop?.managerId === r.id ? '店长' : '店员'} · 好感 {r.score}
                              </span>
                              <em>{staff.length <= 1 ? '将关店卖出' : '离店'}</em>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() =>
                            setManageUi({
                              step: 'staffHub',
                              shopId: manageUi.shopId,
                              shopName: manageUi.shopName,
                            })
                          }
                        >
                          返回
                        </button>
                      </>
                    )
                  })()}
                {manageUi.step === 'setManager' &&
                  (() => {
                    const shop = human.shops.find((s) => s.id === manageUi.shopId)
                    const staff = (shop?.staffIds ?? [])
                      .map((id) => human.relations.find((r) => r.id === id))
                      .filter((r): r is NonNullable<typeof r> => Boolean(r))
                    return (
                      <>
                        <h3>「{manageUi.shopName}」换店长</h3>
                        <div className="shop-list">
                          {staff.map((r) => (
                            <button
                              key={r.id}
                              className="shop-item"
                              disabled={shop?.managerId === r.id}
                              onClick={() =>
                                dispatchTaste(`任命「${r.name}」店长`, 'location', {
                                  type: 'SHOP_SET_MANAGER',
                                  shopId: manageUi.shopId,
                                  relationId: r.id,
                                })
                              }
                            >
                              <strong>{r.name}</strong>
                              <span>好感 {r.score}</span>
                              <em>{shop?.managerId === r.id ? '现任店长' : '任命'}</em>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() =>
                            setManageUi({
                              step: 'staffHub',
                              shopId: manageUi.shopId,
                              shopName: manageUi.shopName,
                            })
                          }
                        >
                          返回
                        </button>
                      </>
                    )
                  })()}
              </>
            )}
            {state.pendingLocation.spaceKind === 'casino' && (
              <CasinoPanel
                state={state}
                human={human}
                dispatch={dispatch}
                dispatchTaste={dispatchTaste}
              />
            )}
            {state.pendingLocation.spaceKind === 'park' && (
              <>
                <h3>公园</h3>
                <p className="muted">休息回血，或与熟人免费小坐升温。</p>
                <div className="shop-list">
                  <button
                    className="shop-item"
                    onClick={() =>
                      dispatchTaste('公园休息', 'location', { type: 'LOCATION_PARK_REST' })
                    }
                  >
                    <strong>休息回血</strong>
                    <span>+{PARK_REST_CASH} 万</span>
                    <em>喘口气</em>
                  </button>
                  {human.relations
                    .filter((r) => r.status !== 'broken')
                    .map((r) => (
                      <button
                        key={r.id}
                        className="shop-item"
                        onClick={() =>
                          dispatchTaste(`公园小坐 · ${r.name}`, 'location', {
                            type: 'LOCATION_PARK_CHAT',
                            relationId: r.id,
                          })
                        }
                      >
                        <strong>与 {r.name} 小坐</strong>
                        <span>好感 +{PARK_CHAT_BOOST}</span>
                        <em>免费</em>
                      </button>
                    ))}
                </div>
                <button onClick={() => dispatch({ type: 'LOCATION_SKIP' })}>离开</button>
              </>
            )}
            {state.pendingLocation.spaceKind === 'invest' && (
              <ExchangePanel state={state} human={human} dispatch={dispatch} dispatchTaste={dispatchTaste} />
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
                            {occupationLabel(human, r)} · {relationKindLabel(r.kind)} · 好感{' '}
                            {r.score}
                            {willBreakNextDecay(r) ? ' · 下回合可能破裂' : ''}
                          </span>
                          {willBreakNextDecay(r) ? (
                            <em className="warn">预警</em>
                          ) : r.training ? (
                            <em>进修中</em>
                          ) : r.locked ? (
                            <em>已锁定</em>
                          ) : null}
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
                const staffed = human.shops.filter((s) => s.staffIds.includes(rel.id))
                return (
                  <>
                    <h3>{rel.name}</h3>
                    <ul className="shop-detail-list">
                      <li>职业：{occupationLabel(human, rel)}</li>
                      <li>类型：{relationKindLabel(rel.kind)}</li>
                      <li>状态：{relationStatusLabel(rel.status)}</li>
                      <li>好感：{rel.score}</li>
                      <li>锁定：{rel.locked ? '是（较难被挖走）' : '否'}</li>
                      <li>
                        技能：
                        {rel.skills.length
                          ? rel.skills.map(skillLabel).join('、')
                          : '无'}
                        （{rel.skills.length}/3）
                      </li>
                      {rel.training ? (
                        <li>
                          进修中：{skillLabel(rel.training.skillId)} · 剩余{' '}
                          {rel.training.turnsLeft} 回合 · 成功率{' '}
                          {Math.round(rel.training.successChance * 100)}%
                        </li>
                      ) : null}
                      {willBreakNextDecay(rel) ? (
                        <li className="warn">下回合若不维护，关系可能破裂。</li>
                      ) : null}
                      <li>
                        所属店铺：
                        {staffed.length
                          ? staffed
                              .map((s) =>
                                s.managerId === rel.id
                                  ? `${s.name}（店长）`
                                  : `${s.name}（店员）`,
                              )
                              .join('、')
                          : '无（自由人）'}
                      </li>
                    </ul>
                    <div className="modal-actions">
                      <button
                        className="primary"
                        disabled={Boolean(rel.training) || staffed.length > 0 || rel.status === 'broken'}
                        onClick={() =>
                          setFriendPanel({ step: 'train', relationId: rel.id })
                        }
                      >
                        去学习
                      </button>
                      <button onClick={() => setFriendPanel({ step: 'list' })}>返回列表</button>
                      <button onClick={() => setFriendPanel(null)}>关闭</button>
                    </div>
                    {staffed.length > 0 ? (
                      <p className="muted">在店上班时无法进修，请先在经营区走人。</p>
                    ) : null}
                  </>
                )
              })()}
            {friendPanel.step === 'train' &&
              (() => {
                const rel = human.relations.find((r) => r.id === friendPanel.relationId)
                if (!rel) {
                  return (
                    <>
                      <h3>人物不存在</h3>
                      <button onClick={() => setFriendPanel({ step: 'list' })}>返回</button>
                    </>
                  )
                }
                return (
                  <>
                    <h3>「{rel.name}」去学习</h3>
                    <p className="muted">扣现金，占用你自己的回合；成功才写入技能（最多 3 个）。</p>
                    <div className="shop-list">
                      {SKILLS.map((sk) => {
                        const err = canLearnSkill(rel, sk.id)
                        const cantCash = human.cash + 1e-9 < sk.cost
                        return (
                          <button
                            key={sk.id}
                            className="shop-item"
                            disabled={Boolean(err) || cantCash}
                            onClick={() => {
                              dispatchTaste(`进修「${sk.name}」`, 'decision', {
                                type: 'TRAIN_START',
                                relationId: rel.id,
                                skillId: sk.id,
                              })
                              setFriendPanel({ step: 'detail', relationId: rel.id })
                            }}
                          >
                            <strong>{sk.name}</strong>
                            <span>
                              {sk.cost} 万 · {sk.turns} 回合 · {Math.round(sk.successChance * 100)}%
                            </span>
                            <em>{err ?? (cantCash ? '现金不足' : '报名')}</em>
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => setFriendPanel({ step: 'detail', relationId: rel.id })}
                    >
                      返回
                    </button>
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
                      const mgr = human.relations.find((r) => r.id === shop.managerId)
                      const bd = shopBreakdown(shop, human.relations)
                      const def = shopTypeById(shop.typeId)
                      return (
                        <button
                          key={shop.id}
                          className="shop-item"
                          onClick={() => setShopPanel({ step: 'detail', shopId: shop.id })}
                        >
                          <strong>{shop.name}</strong>
                          <span>
                            {def?.label ?? ''} · Lv.{shop.level} · 净 {bd.net.toFixed(2)} 万 ·{' '}
                            {shop.staffIds.length}/{shopCapacity(shop.level)} 人
                          </span>
                          <em>店长：{mgr?.name ?? '（缺失）'}</em>
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
                const mgr = human.relations.find((r) => r.id === shop.managerId)
                const staffNames = shop.staffIds
                  .map((id) => human.relations.find((r) => r.id === id)?.name ?? '?')
                  .join('、')
                const bd = shopBreakdown(shop, human.relations)
                const def = shopTypeById(shop.typeId)
                return (
                  <>
                    <h3>{shop.name}</h3>
                    <ul className="shop-detail-list">
                      <li>类型：{def?.label ?? shop.typeId}</li>
                      <li>等级：Lv.{shop.level}</li>
                      <li>
                        编制：{shop.staffIds.length}/{shopCapacity(shop.level)}
                      </li>
                      <li>基准营收：{shop.baseRevenue.toFixed(2)} 万/季</li>
                      <li>经营成本：{shop.operatingCost.toFixed(2)} 万/季</li>
                      <li>
                        本期毛营收：{bd.gross.toFixed(2)} · 净额：{bd.net.toFixed(2)} 万
                        （行情 ×{bd.factor.toFixed(2)}）
                      </li>
                      <li>账面估值：约 {shopBookValue(shop).toFixed(2)} 万</li>
                      <li>
                        店长：
                        {mgr
                          ? `${mgr.name}（好感 ${mgr.score}）`
                          : '无（应已关店）'}
                      </li>
                      <li>员工：{staffNames || '无'}</li>
                      <li>
                        技能标签：
                        {shop.skillTags.map(skillLabel).join('、') || '无'}
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
                          onClick={() =>
                            dispatchTaste(`约会 · ${v.name}`, 'date', {
                              type: 'DATE_CONFIRM_VENUE',
                              venueId: v.id,
                            })
                          }
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

      {state.pendingDecision && !eventTaste && (
        <div className="modal">
          <div className="modal-card panel">
            {state.pendingDecision.type === 'promote' && (
              <>
                <h3>可以晋级投资人圈</h3>
                <p>
                  被动收入已超过总支出（
                  {(() => {
                    const f = calcFinance(human)
                    return `${f.passiveIncome} / ${f.totalExpense}`
                  })()}
                  ）。进入外圈将获得启动金 +{INVESTOR_START_BONUS} 万。
                </p>
                <div className="modal-actions">
                  <button
                    className="primary"
                    onClick={() =>
                      dispatchTaste('晋级投资人圈', 'decision', { type: 'PROMOTE_TO_INVESTOR' })
                    }
                  >
                    晋级（+{INVESTOR_START_BONUS} 万）
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
                  <button
                    className="primary"
                    onClick={() =>
                      dispatchTaste('结婚', 'decision', {
                        type: 'CONFIRM_MARRIAGE',
                        accept: true,
                      })
                    }
                  >
                    结婚
                  </button>
                  <button
                    onClick={() =>
                      dispatchTaste('暂缓婚事', 'decision', {
                        type: 'CONFIRM_MARRIAGE',
                        accept: false,
                      })
                    }
                  >
                    再等等
                  </button>
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
                  <button
                    className="primary"
                    onClick={() =>
                      dispatchTaste('确认大额买入', 'decision', {
                        type: 'CONFIRM_BIG_SPEND',
                        accept: true,
                      })
                    }
                  >
                    买入
                  </button>
                  <button
                    onClick={() =>
                      dispatchTaste('放弃大额购入', 'decision', {
                        type: 'CONFIRM_BIG_SPEND',
                        accept: false,
                      })
                    }
                  >
                    放弃
                  </button>
                </div>
              </>
            )}
            {state.pendingDecision.type === 'poach' && (
              <>
                <h3>挖角警告</h3>
                {(() => {
                  const d = state.pendingDecision
                  const thief = state.players.find((p) => p.id === d.fromPlayerId)
                  const victim = state.players.find((p) => p.id === d.playerId)
                  const rel = victim?.relations.find((r) => r.id === d.relationId)
                  return (
                    <p>
                      {thief?.name ?? '有人'}想挖走你的「{rel?.name ?? '关系人'}」。花 0.15 万挽留，还是放人？
                    </p>
                  )
                })()}
                <div className="modal-actions">
                  <button
                    className="primary"
                    onClick={() =>
                      dispatchTaste('挽留关系', 'decision', {
                        type: 'CONFIRM_POACH',
                        accept: false,
                      })
                    }
                  >
                    挽留
                  </button>
                  <button
                    onClick={() =>
                      dispatchTaste('放人', 'decision', {
                        type: 'CONFIRM_POACH',
                        accept: true,
                      })
                    }
                  >
                    放人
                  </button>
                </div>
              </>
            )}
            {state.pendingDecision.type === 'bankrupt' && (
              <>
                <h3>现金流断裂</h3>
                <p>需要记账负债 {state.pendingDecision.amount} 万并可能变卖投资。</p>
                <button
                  className="primary"
                  onClick={() =>
                    dispatchTaste('破产处理', 'decision', { type: 'RESOLVE_BANKRUPT' })
                  }
                >
                  处理
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {logOpen && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="本季日志">
          <div className="modal-card panel log-modal-card">
            <h3>本季日志</h3>
            <ul className="log-modal-list">
              {recentLogs.length === 0 && <li className="muted">暂无记录</li>}
              {recentLogs.map((l) => (
                <li key={l.id}>{l.text}</li>
              ))}
            </ul>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={() => setLogOpen(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CasinoPanel({
  state,
  human,
  dispatch,
  dispatchTaste,
}: {
  state: GameState
  human: PlayerState
  dispatch: (a: GameAction) => void
  dispatchTaste: (
    title: string,
    waitFor: 'event' | 'location' | 'date' | 'decision',
    action: GameAction,
  ) => void
}) {
  const c = state.pendingCasino
  const bets = [...CASINO_BETS]

  if (!c || c.screen === 'lobby') {
    return (
      <>
        <h3>赌场大厅</h3>
        <p className="muted">真规则桌台。可连玩，点离开才结束落点。</p>
        <div className="shop-list">
          <button className="shop-item" onClick={() => dispatch({ type: 'CASINO_OPEN', game: 'baccarat' })}>
            <strong>百家乐</strong>
            <span>庄抽水 5%</span>
            <em>闲 / 庄 / 和</em>
          </button>
          <button className="shop-item" onClick={() => dispatch({ type: 'CASINO_OPEN', game: 'dice' })}>
            <strong>骰子</strong>
            <span>Pass / Don't Pass</span>
            <em>可加 Field</em>
          </button>
          <button className="shop-item" onClick={() => dispatch({ type: 'CASINO_OPEN', game: 'blackjack' })}>
            <strong>21 点</strong>
            <span>BJ 赔 3:2 · S17</span>
            <em>可加倍 / 分牌 / 保险</em>
          </button>
        </div>
        <button
          onClick={() =>
            dispatchTaste('离开赌场', 'location', { type: 'CASINO_LEAVE' })
          }
        >
          离开赌场
        </button>
      </>
    )
  }

  if (c.screen === 'baccarat') {
    const r = c.baccarat
    const settled = r?.phase === 'settled'
    const betting = !r || r.phase === 'betting' || settled
    return (
      <>
        <h3>百家乐</h3>
        {r && r.phase !== 'betting' && (
          <ul className="shop-detail-list">
            <li>闲：{r.playerCards.map(cardLabel).join(' ')} → {r.playerPoint}</li>
            <li>庄：{r.bankerCards.map(cardLabel).join(' ')} → {r.bankerPoint}</li>
            <li>{r.message}</li>
          </ul>
        )}
        {betting && (
          <>
            <p className="muted">选边与注码（现金 {human.cash.toFixed(2)} 万）</p>
            {(['player', 'banker', 'tie'] as const).map((kind) => (
              <div key={kind} className="shop-list" style={{ marginBottom: 8 }}>
                {bets.map((amt) => (
                  <button
                    key={amt}
                    className="shop-item"
                    disabled={human.cash + 1e-9 < amt}
                    onClick={() =>
                      dispatch({ type: 'CASINO_BACARAT_BET', betKind: kind, amount: amt })
                    }
                  >
                    <strong>{kind === 'player' ? '闲' : kind === 'banker' ? '庄' : '和'}</strong>
                    <span>{amt} 万</span>
                    <em>{kind === 'banker' ? '0.95:1' : kind === 'tie' ? '8:1' : '1:1'}</em>
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
        <div className="modal-actions">
          <button onClick={() => dispatch({ type: 'CASINO_LOBBY' })}>回大厅</button>
          <button onClick={() => dispatchTaste('离开赌场', 'location', { type: 'CASINO_LEAVE' })}>
            离开
          </button>
        </div>
      </>
    )
  }

  if (c.screen === 'dice') {
    const d = c.dice
    const needRoll = d?.phase === 'point'
    const betting = !d || d.phase === 'betting' || d.phase === 'settled'
    return (
      <>
        <h3>骰子（Craps 精简）</h3>
        {d && d.phase !== 'betting' && (
          <ul className="shop-detail-list">
            {d.lastDice && <li>骰面：{d.lastDice[0]} + {d.lastDice[1]} = {d.lastTotal}</li>}
            {d.point != null && d.phase === 'point' && <li>Point：{d.point}</li>}
            <li>{d.message}</li>
          </ul>
        )}
        {needRoll && (
          <button
            className="primary"
            data-testid="dice-roll"
            onClick={() => dispatch({ type: 'CASINO_DICE_ROLL' })}
          >
            再掷
          </button>
        )}
        {betting && (
          <>
            <p className="muted">Pass / Don't Pass；可选同注 Field</p>
            {(['pass', 'dontPass'] as const).map((line) => (
              <div key={line} className="shop-list" style={{ marginBottom: 8 }}>
                {bets.map((amt) => (
                  <button
                    key={amt}
                    className="shop-item"
                    data-testid={`dice-${line}-${amt}`}
                    disabled={human.cash + 1e-9 < amt}
                    onClick={() =>
                      dispatch({ type: 'CASINO_DICE_BET', line, amount: amt, fieldAmount: 0 })
                    }
                  >
                    <strong>{line === 'pass' ? 'Pass' : "Don't Pass"}</strong>
                    <span>{amt} 万</span>
                    <em>无 Field</em>
                  </button>
                ))}
                {bets.map((amt) => (
                  <button
                    key={`${amt}-f`}
                    className="shop-item"
                    disabled={human.cash + 1e-9 < amt * 2}
                    onClick={() =>
                      dispatch({
                        type: 'CASINO_DICE_BET',
                        line,
                        amount: amt,
                        fieldAmount: amt,
                      })
                    }
                  >
                    <strong>{line === 'pass' ? 'Pass' : "Don't Pass"}+Field</strong>
                    <span>{amt}+{amt}</span>
                    <em>附加 Field</em>
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
        <div className="modal-actions">
          <button disabled={needRoll} onClick={() => dispatch({ type: 'CASINO_LOBBY' })}>
            回大厅
          </button>
          <button
            disabled={needRoll}
            onClick={() => dispatchTaste('离开赌场', 'location', { type: 'CASINO_LEAVE' })}
          >
            离开
          </button>
        </div>
      </>
    )
  }

  // blackjack
  const bj = c.blackjack
  const betting = !bj || bj.phase === 'betting' || bj.phase === 'settled'
  return (
    <>
      <h3>21 点</h3>
      <div data-testid="bj-phase" data-phase={bj?.phase ?? 'none'} hidden />
      {bj && bj.phase !== 'betting' && (
        <ul className="shop-detail-list">
          <li>
            庄：{formatHand(bj.dealerCards, bj.dealerHoleHidden)}
            {!bj.dealerHoleHidden
              ? ` → ${blackjackTotal(bj.dealerCards).total}`
              : ''}
          </li>
          {bj.playerHands.map((h, i) => (
            <li key={i}>
              你{bj.playerHands.length > 1 ? ` #${i + 1}` : ''}：
              {h.cards.map(cardLabel).join(' ')} → {blackjackTotal(h.cards).total}
              {i === bj.activeHand && bj.phase === 'player' ? ' ←' : ''}
              {h.busted ? ' 爆' : ''}
            </li>
          ))}
          <li>{bj.message}</li>
        </ul>
      )}
      {bj?.phase === 'insurance' && (
        <div className="modal-actions">
          <button
            data-testid="bj-ins-yes"
            className="primary"
            disabled={human.cash + 1e-9 < bj.stake / 2}
            onClick={() => dispatch({ type: 'CASINO_BJ_INSURANCE', take: true })}
          >
            买保险
          </button>
          <button
            data-testid="bj-ins-no"
            onClick={() => dispatch({ type: 'CASINO_BJ_INSURANCE', take: false })}
          >
            不买
          </button>
        </div>
      )}
      {bj?.phase === 'player' && (
        <div className="modal-actions">
          <button
            className="primary"
            data-testid="bj-hit"
            onClick={() => dispatch({ type: 'CASINO_BJ_HIT' })}
          >
            要牌
          </button>
          <button data-testid="bj-stand" onClick={() => dispatch({ type: 'CASINO_BJ_STAND' })}>
            停牌
          </button>
          <button data-testid="bj-double" onClick={() => dispatch({ type: 'CASINO_BJ_DOUBLE' })}>
            加倍
          </button>
          <button data-testid="bj-split" onClick={() => dispatch({ type: 'CASINO_BJ_SPLIT' })}>
            分牌
          </button>
        </div>
      )}
      {betting && (
        <div className="shop-list">
          {bj?.phase === 'settled' && (
            <button className="shop-item" onClick={() => dispatch({ type: 'CASINO_BJ_NEXT' })}>
              <strong>清除牌面</strong>
              <span>再选注</span>
            </button>
          )}
          {bets.map((amt) => (
            <button
              key={amt}
              className="shop-item"
              data-testid={`bj-bet-${amt}`}
              disabled={human.cash + 1e-9 < amt}
              onClick={() => dispatch({ type: 'CASINO_BJ_BET', amount: amt })}
            >
              <strong>下注 {amt} 万</strong>
              <span>发牌</span>
            </button>
          ))}
        </div>
      )}
      <div className="modal-actions">
        <button
          disabled={bj?.phase === 'player' || bj?.phase === 'insurance'}
          onClick={() => dispatch({ type: 'CASINO_LOBBY' })}
        >
          回大厅
        </button>
        <button
          data-testid="casino-leave"
          disabled={bj?.phase === 'player' || bj?.phase === 'insurance' || bj?.phase === 'dealer'}
          onClick={() => dispatchTaste('离开赌场', 'location', { type: 'CASINO_LEAVE' })}
        >
          离开
        </button>
      </div>
    </>
  )
}

function VisitPanel({
  state,
  human,
  dispatch,
}: {
  state: GameState
  human: PlayerState
  dispatch: (a: GameAction) => void
}) {
  const v = state.pendingVisitShop
  if (!v) return null
  const owner = state.players.find((p) => p.id === v.ownerId)
  const shop = owner?.shops.find((s) => s.id === v.shopId)
  const typeLabel = shop ? shopTypeById(shop.typeId)?.label : undefined
  const staff =
    shop?.staffIds
      .map((id) => owner?.relations.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => r != null && r.status !== 'broken') ?? []
  const manager = shop ? owner?.relations.find((r) => r.id === shop.managerId) : undefined
  const service = v.staffId ? owner?.relations.find((r) => r.id === v.staffId) : undefined

  return (
    <>
      <h3 data-testid="visit-title">探店 · {owner?.name ?? '对手'}的店</h3>
      <p className="muted">
        {shop?.name ?? '店铺'}
        {typeLabel ? `（${typeLabel}）` : ''}
        {v.rapport > 0 ? ` · 印象 ${v.rapport}` : ''}
      </p>

      {v.step === 'pay' && (
        <>
          <p>消费探店费后才能进店聊天、点服务。</p>
          <div className="shop-list">
            <button
              className="shop-item"
              data-testid="visit-pay"
              disabled={human.cash + 1e-9 < v.entryFee}
              onClick={() => dispatch({ type: 'VISIT_PAY' })}
            >
              <strong>付钱进店</strong>
              <span>{v.entryFee} 万</span>
              <em>费用归店主</em>
            </button>
          </div>
          <button data-testid="visit-leave" onClick={() => dispatch({ type: 'VISIT_LEAVE' })}>
            不消费离开
          </button>
        </>
      )}

      {v.step === 'talkManager' && (
        <>
          <p>店长「{manager?.name ?? '店长'}」在柜台招呼你。</p>
          <div className="shop-list">
            <button
              className="shop-item"
              data-testid="visit-talk"
              onClick={() => dispatch({ type: 'VISIT_TALK' })}
            >
              <strong>与店长闲聊</strong>
              <span>印象 +6</span>
              <em>免费</em>
            </button>
          </div>
        </>
      )}

      {v.step === 'pickStaff' && (
        <>
          <p>选一位店员为你服务（另付小费 {v.tipFee} 万）。</p>
          <div className="shop-list">
            {staff.map((r) => (
              <button
                key={r.id}
                className="shop-item"
                data-testid={`visit-staff-${r.id}`}
                disabled={human.cash + 1e-9 < v.tipFee}
                onClick={() => dispatch({ type: 'VISIT_PICK_STAFF', relationId: r.id })}
              >
                <strong>{r.name}</strong>
                <span>
                  好感 {r.score}
                  {shop?.managerId === r.id ? ' · 店长' : ' · 店员'}
                </span>
                <em>小费 {v.tipFee} 万</em>
              </button>
            ))}
          </div>
          {!staff.length && (
            <button data-testid="visit-leave" onClick={() => dispatch({ type: 'VISIT_LEAVE' })}>
              无人服务，离开
            </button>
          )}
        </>
      )}

      {v.step === 'gift' && (
        <>
          <p>可向「{service?.name ?? '店员'}」送礼加深印象，也可跳过。</p>
          <div className="shop-list">
            {VISIT_GIFTS.map((g) => (
              <button
                key={g.id}
                className="shop-item"
                data-testid={`visit-gift-${g.id}`}
                disabled={human.cash + 1e-9 < g.cost}
                onClick={() => dispatch({ type: 'VISIT_GIFT', giftId: g.id })}
              >
                <strong>{g.name}</strong>
                <span>{g.cost} 万</span>
                <em>印象 +{g.rapport}</em>
              </button>
            ))}
          </div>
          <button data-testid="visit-skip-gift" onClick={() => dispatch({ type: 'VISIT_SKIP_GIFT' })}>
            不送礼
          </button>
        </>
      )}

      {v.step === 'poach' && (
        <>
          <p>
            尝试挖角「{service?.name ?? '店员'}」？手续费 {VISIT_POACH_FEE} 万，成功率看忠诚度、印象与拉霸。
          </p>
          {v.lastReels && (
            <p className="muted">
              本局拉霸 [{v.lastReels.join('-')}]
              {v.lastPoachOk === true ? ' · 成功' : v.lastPoachOk === false ? ' · 失败' : ''}
            </p>
          )}
          <div className="shop-list">
            {v.lastPoachOk == null && (
              <button
                className="shop-item"
                data-testid="visit-poach"
                disabled={
                  human.poachCooldown > 0 ||
                  human.cash + 1e-9 < VISIT_POACH_FEE ||
                  !v.staffId
                }
                onClick={() => dispatch({ type: 'VISIT_POACH_SPIN' })}
              >
                <strong>拉霸挖角</strong>
                <span>{VISIT_POACH_FEE} 万</span>
                <em>
                  {service
                    ? `约 ${Math.round(poachSuccessChance(service.score) * 100)}%+印象`
                    : '发起挖角'}
                </em>
              </button>
            )}
          </div>
          <button
            data-testid="visit-leave"
            onClick={() =>
              dispatch({
                type: v.lastPoachOk == null ? 'VISIT_SKIP_POACH' : 'VISIT_LEAVE',
              })
            }
          >
            {v.lastPoachOk == null ? '不挖角，离开' : '离开'}
          </button>
        </>
      )}
    </>
  )
}


function ExchangePanel({
  state,
  human,
  dispatch,
  dispatchTaste,
}: {
  state: GameState
  human: PlayerState
  dispatch: (a: GameAction) => void
  dispatchTaste: (
    title: string,
    waitFor: 'event' | 'location' | 'date' | 'decision',
    action: GameAction,
  ) => void
}) {
  const ex = state.pendingExchange
  const screen = ex?.screen ?? 'lobby'
  const trade = ex?.trade
  const tradeDone = (ex?.tradeSessionsPlayed ?? 0) >= 1

  if (!ex || screen === 'lobby') {
    return (
      <>
        <h3 data-testid="exchange-title">交易所大厅</h3>
        <p className="muted">理财柜收息；交易盘进一次玩一局（股票现货 / 币圈杠杆）。</p>
        <div className="shop-list">
          <button
            className="shop-item"
            data-testid="exchange-open-funds"
            onClick={() => dispatch({ type: 'EXCHANGE_OPEN_FUNDS' })}
          >
            <strong>理财柜</strong>
            <span>债基 / ETF</span>
            <em>买完可回大厅</em>
          </button>
          <button
            className="shop-item"
            data-testid="exchange-open-trade"
            disabled={tradeDone || human.cash + 1e-9 < EXCHANGE_STAKES[0]}
            onClick={() => dispatch({ type: 'EXCHANGE_OPEN_TRADE', stake: EXCHANGE_STAKES[0] })}
          >
            <strong>交易盘 · {EXCHANGE_STAKES[0]} 万入场</strong>
            <span>{tradeDone ? '本落点已玩过' : '开局'}</span>
            <em>多棒行情</em>
          </button>
          {EXCHANGE_STAKES.filter((s) => s > EXCHANGE_STAKES[0]).map((stake) => (
            <button
              key={stake}
              className="shop-item"
              disabled={tradeDone || human.cash + 1e-9 < stake}
              onClick={() => dispatch({ type: 'EXCHANGE_OPEN_TRADE', stake })}
            >
              <strong>交易盘 · {stake} 万入场</strong>
              <span>更大本金</span>
              <em>风险自担</em>
            </button>
          ))}
        </div>
        <button
          data-testid="exchange-leave"
          onClick={() => dispatchTaste('离开交易所', 'location', { type: 'EXCHANGE_LEAVE' })}
        >
          离开交易所
        </button>
      </>
    )
  }

  if (screen === 'funds') {
    return (
      <>
        <h3 data-testid="exchange-funds-title">理财柜</h3>
        <p className="muted">买入标的或按成本 {Math.round(INVEST_SELL_RATIO * 100)}% 卖出。</p>
        <div className="shop-list">
          {investOffersFor(human.track).map((o) => {
            const cost =
              human.trait === 'investDiscount' ? Math.round(o.cost * 90) / 100 : o.cost
            return (
              <button
                key={o.id}
                className="shop-item"
                disabled={human.cash + 1e-9 < cost}
                onClick={() =>
                  dispatch({ type: 'LOCATION_BUY_INVEST', offerId: o.id })
                }
              >
                <strong>买 {o.name}</strong>
                <span>{cost} 万</span>
                <em>季现金流 +{o.cashflow}</em>
              </button>
            )
          })}
          {human.investments.map((inv) => (
            <button
              key={inv.id}
              className="shop-item"
              onClick={() =>
                dispatch({ type: 'LOCATION_SELL_INVEST', investmentId: inv.id })
              }
            >
              <strong>卖 {inv.name}</strong>
              <span>+{Math.round(inv.cost * INVEST_SELL_RATIO * 100) / 100} 万</span>
              <em>回笼</em>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={() => dispatch({ type: 'EXCHANGE_LOBBY' })}>回大厅</button>
          <button
            data-testid="exchange-leave"
            onClick={() => dispatchTaste('离开交易所', 'location', { type: 'EXCHANGE_LEAVE' })}
          >
            离开
          </button>
        </div>
      </>
    )
  }

  // trade screen
  if (!trade) {
    return (
      <>
        <h3>交易盘</h3>
        <p className="muted">会话已结束。</p>
        <button onClick={() => dispatch({ type: 'EXCHANGE_LOBBY' })}>回大厅</button>
      </>
    )
  }

  const eq = tradeEquity(trade)
  const amounts = [0.1, 0.2, 0.5].filter((a) => a <= trade.cash + 1e-9)

  return (
    <>
      <h3 data-testid="exchange-trade-title">交易盘</h3>
      <p className="muted">
        棒 {trade.tick}/{trade.maxTicks} · 局内现金 {trade.cash.toFixed(2)} · 权益约 {eq.toFixed(2)} ·
        币杠杆 {trade.cryptoLeverage}×
      </p>
      {trade.lastMessage ? <p className="muted">{trade.lastMessage}</p> : null}

      <p className="muted">币圈杠杆</p>
      <div className="shop-list">
        {([1, 2, 5] as Leverage[]).map((lev) => (
          <button
            key={lev}
            className="shop-item"
            data-testid={`exchange-lev-${lev}`}
            onClick={() => dispatch({ type: 'EXCHANGE_SET_LEVERAGE', leverage: lev })}
          >
            <strong>{lev}×</strong>
            <span>仅币圈</span>
            <em>{trade.cryptoLeverage === lev ? '当前' : '切换'}</em>
          </button>
        ))}
      </div>

      <p className="muted">行情</p>
      <div className="shop-list">
        {trade.symbols.map((sym) => {
          const def = symbolDefById(sym.id)
          const pos = trade.positions.find((p) => p.symbolId === sym.id)
          const ch = sym.lastChange
          return (
            <div key={sym.id} className="shop-item" style={{ display: 'block' }}>
              <strong>
                {def?.name ?? sym.id}{' '}
                <span className="muted">
                  {sym.price.toFixed(2)} ({ch >= 0 ? '+' : ''}
                  {(ch * 100).toFixed(1)}%)
                </span>
              </strong>
              {pos ? (
                <p className="muted">
                  持仓 {pos.qty.toFixed(2)} · {pos.leverage}× · 成本 {pos.entry.toFixed(2)}
                </p>
              ) : null}
              <div className="modal-actions">
                {amounts.map((amt) => (
                  <button
                    key={`${sym.id}-b-${amt}`}
                    data-testid={`exchange-buy-${sym.id}-${amt}`}
                    disabled={trade.cash + 1e-9 < amt}
                    onClick={() =>
                      dispatch({ type: 'EXCHANGE_BUY', symbolId: sym.id, amount: amt })
                    }
                  >
                    买 {amt}
                  </button>
                ))}
                {pos ? (
                  <button
                    data-testid={`exchange-sell-${sym.id}`}
                    onClick={() =>
                      dispatch({ type: 'EXCHANGE_SELL', symbolId: sym.id, qtyRatio: 1 })
                    }
                  >
                    全平
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="modal-actions">
        <button
          data-testid="exchange-tick"
          disabled={trade.ended != null}
          onClick={() => dispatch({ type: 'EXCHANGE_TICK' })}
        >
          下一棒行情
        </button>
        <button data-testid="exchange-close" onClick={() => dispatch({ type: 'EXCHANGE_CLOSE' })}>
          收盘离场
        </button>
      </div>
    </>
  )
}
