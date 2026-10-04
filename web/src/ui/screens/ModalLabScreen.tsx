import { useState } from 'react'
import { portraitUrl } from '../../game/portraits'
import { PLAY_ART, SPACE_ART, VENUE_ART } from '../art'
import './ModalLabScreen.css'

type DemoKind =
  | 'event'
  | 'location'
  | 'result'
  | 'meet'
  | 'date'
  | 'space'

const DEMOS: { id: DemoKind; label: string }[] = [
  { id: 'event', label: '事件选项' },
  { id: 'location', label: '落点列表' },
  { id: 'result', label: '事件结果' },
  { id: 'meet', label: '结识遇见' },
  { id: 'date', label: '约会结果' },
  { id: 'space', label: '格子详情' },
]

export function ModalLabScreen() {
  const [kind, setKind] = useState<DemoKind>('location')
  const [tick, setTick] = useState(0)
  const replay = () => setTick((n) => n + 1)

  return (
    <div className="modal-lab">
      <header className="modal-lab-bar">
        <div className="modal-lab-brand">
          <strong>弹框样稿 · A 海报卡</strong>
          <span className="muted">?modalLab=1 · 仅展示，不改玩法</span>
        </div>
        <div className="modal-lab-controls" role="group" aria-label="弹框类型">
          {DEMOS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={kind === d.id ? 'primary' : 'ghost'}
              aria-pressed={kind === d.id}
              onClick={() => {
                setKind(d.id)
                replay()
              }}
            >
              {d.label}
            </button>
          ))}
          <button type="button" className="ghost" onClick={replay}>
            重播入场
          </button>
        </div>
      </header>

      <div className="modal-lab-stage">
        <div className="modal-lab-phone" aria-label="手机预览">
          <div
            className="modal-lab-playbg"
            style={{ backgroundImage: `url(${PLAY_ART})` }}
            aria-hidden="true"
          />
          <div className="modal-lab-fakeui" aria-hidden="true">
            <div className="modal-lab-fake-top" />
            <div className="modal-lab-fake-board" />
            <div className="modal-lab-fake-dock" />
          </div>

          <div key={`${kind}-${tick}`} className="modal-lab-scrim variant-a" role="presentation">
            {kind === 'event' && <EventCard />}
            {kind === 'location' && <LocationCard />}
            {kind === 'result' && <ResultCard />}
            {kind === 'meet' && <MeetCard />}
            {kind === 'date' && <DateCard />}
            {kind === 'space' && <SpaceCard />}
          </div>
        </div>
      </div>
    </div>
  )
}

function CloseGlyph() {
  return (
    <svg className="mlab-close-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d="M2.2 2.2l7.6 7.6M9.8 2.2L2.2 9.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LeaveClose() {
  return (
    <button type="button" className="mlab-close mlab-close-leave" aria-label="离开">
      <span>离开</span>
      <CloseGlyph />
    </button>
  )
}

function IconClose() {
  return (
    <button type="button" className="mlab-close" aria-label="关闭">
      <CloseGlyph />
    </button>
  )
}

/** 事件选项：大图 + 破框立绘 + 胶囊按钮 */
function EventCard() {
  const portrait = portraitUrl('g01')!
  return (
    <article
      className="mlab-card mlab-poster has-sticker"
      role="dialog"
      aria-modal="true"
      aria-label="咖啡馆偶遇"
    >
      <div className="mlab-hero">
        <img src={VENUE_ART.cafe} alt="" draggable={false} />
        <span className="mlab-badge">特别事件</span>
        <IconClose />
        <img className="mlab-sticker" src={portrait} alt="蓝铃" draggable={false} />
      </div>
      <div className="mlab-body mlab-body-after-sticker">
        <p className="mlab-kicker">关系 · 偶遇</p>
        <h2>咖啡馆偶遇</h2>
        <p className="mlab-copy">周末路过老店，蓝铃正对着电脑发愁。要不要请她喝一杯，听听近况？</p>
        <div className="mlab-actions">
          <button type="button" className="mlab-pill primary">
            请她喝一杯
          </button>
          <button type="button" className="mlab-pill">
            随便聊聊
          </button>
          <button type="button" className="mlab-pill">
            装作没看见
          </button>
        </div>
      </div>
    </article>
  )
}

/** 落点列表：无大立绘；行内左缩略图 + 右名称（App Store 条） */
function LocationCard() {
  const rows = [
    { name: '星澜', meta: '好感 42 · 销售', action: '购置并任店长', portraitId: 'g02' },
    { name: '涟心', meta: '好感 28 · 设计', action: '购置并任店长', portraitId: 'g03' },
    { name: '雇临时店长', meta: '10 万', action: '自动结识一人', portraitId: null as string | null },
  ]
  return (
    <article
      className="mlab-card mlab-poster is-location"
      role="dialog"
      aria-modal="true"
      aria-label="空地待售"
    >
      <div className="mlab-hero">
        <img src={SPACE_ART.vacant} alt="" draggable={false} />
        <span className="mlab-badge">落点 · 空地</span>
        <LeaveClose />
      </div>
      <div className="mlab-body">
        <p className="mlab-kicker">落点互动</p>
        <h2>空地待售</h2>
        <p className="mlab-copy">花 8 万开店；没合适关系可加 2 万雇临时店长。</p>
        <ul className="mlab-rows">
          {rows.map((r) => {
            const thumb = r.portraitId ? portraitUrl(r.portraitId) : null
            return (
              <li key={r.name}>
                <button type="button" className="mlab-appbar">
                  {thumb ? (
                    <img className="mlab-appbar-icon" src={thumb} alt="" draggable={false} />
                  ) : (
                    <span className="mlab-appbar-icon mlab-appbar-icon-ph" aria-hidden="true">
                      +
                    </span>
                  )}
                  <span className="mlab-appbar-text">
                    <strong>{r.name}</strong>
                    <small>{r.meta}</small>
                  </span>
                  <span className="mlab-appbar-action">{r.action}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </article>
  )
}

/** 事件结果：数值变化列表 */
function ResultCard() {
  const portrait = portraitUrl('g01')!
  return (
    <article
      className="mlab-card mlab-poster is-location has-sticker is-tall"
      role="dialog"
      aria-modal="true"
      aria-label="结果"
    >
      <div className="mlab-hero">
        <img src={VENUE_ART.cafe} alt="" draggable={false} />
        <span className="mlab-badge">结果</span>
        <LeaveClose />
        <img className="mlab-sticker" src={portrait} alt="蓝铃" draggable={false} />
      </div>
      <div className="mlab-body mlab-body-after-sticker">
        <p className="mlab-kicker">事件结算</p>
        <h2>咖啡馆偶遇</h2>
        <ul className="mlab-taste">
          <li className="is-pos">
            <span>蓝铃 · 好感</span>
            <strong>+8</strong>
          </li>
          <li className="is-neg">
            <span>现金</span>
            <strong>-0.3 万</strong>
          </li>
          <li>
            <span>心情</span>
            <strong>+1</strong>
          </li>
        </ul>
        <p className="mlab-note">她笑着说下次还来这家店。</p>
      </div>
    </article>
  )
}

/** 结识遇见：大立绘为主 */
function MeetCard() {
  const portrait = portraitUrl('g04')!
  return (
    <article
      className="mlab-card mlab-poster is-location is-immersive"
      role="dialog"
      aria-modal="true"
      aria-label="结识樱奈"
    >
      <div className="mlab-meet-hero">
        <img className="mlab-meet-portrait" src={portrait} alt="樱奈" draggable={false} />
        <span className="mlab-badge">结识</span>
        <LeaveClose />
      </div>
      <div className="mlab-body">
        <p className="mlab-kicker">新的关系</p>
        <h2>樱奈</h2>
        <p className="mlab-copy">独立设计师，说话直接。看起来对联名小店挺感兴趣。</p>
        <div className="mlab-facts">
          <span>初始好感 12</span>
          <span>技能 · 设计</span>
        </div>
        <div className="mlab-actions">
          <button type="button" className="mlab-pill primary">
            打个招呼
          </button>
        </div>
      </div>
    </article>
  )
}

/** 约会结果：场所底 + 立绘升起 + 飘字 */
function DateCard() {
  const portrait = portraitUrl('g02')!
  return (
    <article
      className="mlab-card mlab-poster is-location is-immersive"
      role="dialog"
      aria-modal="true"
      aria-label="约会结果"
    >
      <div className="mlab-date-cg">
        <img src={VENUE_ART.dinner} alt="" draggable={false} />
        <span className="mlab-badge">约会</span>
        <LeaveClose />
        <img className="mlab-date-person" src={portrait} alt="星澜" draggable={false} />
        <span className="mlab-date-float">+12</span>
      </div>
      <div className="mlab-body">
        <p className="mlab-kicker">晚餐约会 · 星澜</p>
        <h2>气氛正好</h2>
        <p className="mlab-copy">烛光里她难得放松，聊到想一起开一家周末快闪店。</p>
        <ul className="mlab-taste">
          <li className="is-pos">
            <span>星澜 · 好感</span>
            <strong>+12</strong>
          </li>
          <li className="is-neg">
            <span>现金</span>
            <strong>-1.2 万</strong>
          </li>
        </ul>
      </div>
    </article>
  )
}

/** 格子详情：只读信息 + 离开 */
function SpaceCard() {
  return (
    <article
      className="mlab-card mlab-poster is-location"
      role="dialog"
      aria-modal="true"
      aria-label="格子详情"
    >
      <div className="mlab-hero mlab-hero-short">
        <img src={SPACE_ART.park} alt="" draggable={false} />
        <span className="mlab-badge">格子</span>
        <LeaveClose />
      </div>
      <div className="mlab-body">
        <p className="mlab-kicker">公园</p>
        <h2>城市公园</h2>
        <p className="mlab-copy">散步、小坐，偶尔遇见熟人。落在这里可选择休息或约人出来。</p>
        <div className="mlab-facts mlab-facts-block">
          <div>
            <small>类型</small>
            <strong>休息 / 社交</strong>
          </div>
          <div>
            <small>本季访客</small>
            <strong>2 人</strong>
          </div>
          <div>
            <small>提示</small>
            <strong>好感偏低会衰减</strong>
          </div>
        </div>
        <div className="mlab-actions">
          <button type="button" className="mlab-pill primary">
            知道了
          </button>
        </div>
      </div>
    </article>
  )
}
