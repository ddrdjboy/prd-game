import { useState } from 'react'
import { CHARACTERS } from '../../game/portraits'
import { HOME_ART } from '../art'
import { Portrait } from '../components/Portrait'
import { TUTORIAL_LINES } from '../tutorial'
import './HomeScreen.css'

const DEFAULT_NAME = '阿文'

type Props = {
  onStart: (seats: number, humanName: string) => void
  onContinue: (() => void) | null
}

export function HomeScreen({ onStart, onContinue }: Props) {
  const [showHelp, setShowHelp] = useState(false)
  const [playerName, setPlayerName] = useState(DEFAULT_NAME)

  const startWithName = (seats: number) => {
    const name = playerName.trim() || DEFAULT_NAME
    onStart(seats, name)
  }

  return (
    <div className="home">
      <div
        className="screen-art home-art"
        style={{ backgroundImage: `url(${HOME_ART})` }}
        aria-hidden="true"
      />
      <div className="home-hero">
        <p className="eyebrow">网页人生财务竞技</p>
        <h1>45岁财富自由</h1>
        <p className="lede">
          18 岁入职，四季推进。打工人圈攒被动收入，晋级投资人圈；45 岁用资产与统一关系好感交卷。
        </p>
        <label className="name-field">
          <span>你的名字</span>
          <input
            type="text"
            value={playerName}
            maxLength={12}
            placeholder={DEFAULT_NAME}
            onChange={(e) => setPlayerName(e.target.value)}
            autoComplete="nickname"
          />
        </label>
        <div className="seat-row">
          {[2, 3, 4].map((n) => (
            <button key={n} className="primary" onClick={() => startWithName(n)}>
              {n} 人开局
            </button>
          ))}
        </div>
        {onContinue && (
          <button className="ghost" onClick={onContinue}>
            继续上次
          </button>
        )}
        <button className="ghost" type="button" onClick={() => setShowHelp(true)}>
          玩法说明
        </button>
        <section className="home-cast" aria-label="登场角色">
          <p className="home-cast-title">登场角色 · {CHARACTERS.length} 位</p>
          <div className="home-cast-strip">
            {CHARACTERS.map((c) => (
              <figure key={c.portraitId} className="home-cast-item">
                <Portrait name={c.name} portraitId={c.portraitId} size="md" />
                <figcaption>
                  <strong>{c.name}</strong>
                  <span>{c.title}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
        <p className="hint muted">
          提示：地址加 <code>?fast=1</code> 可在 21 岁快速结算（调试）
        </p>
      </div>
      {showHelp && (
        <div className="modal">
          <div className="modal-card panel">
            <h3>玩法说明</h3>
            <ol className="tutorial-list">
              {TUTORIAL_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={() => setShowHelp(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
