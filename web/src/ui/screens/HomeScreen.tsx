import { useState } from 'react'
import { TUTORIAL_LINES } from '../tutorial'
import './HomeScreen.css'

type Props = {
  onStart: (seats: number) => void
  onContinue: (() => void) | null
}

export function HomeScreen({ onStart, onContinue }: Props) {
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="home">
      <div className="home-hero">
        <p className="eyebrow">网页人生财务竞技</p>
        <h1>45岁财富自由</h1>
        <p className="lede">
          18 岁入职，四季推进。打工人圈攒被动收入，晋级投资人圈；45 岁用资产、人脉与恋人关系交卷。
        </p>
        <div className="seat-row">
          {[2, 3, 4].map((n) => (
            <button key={n} className="primary" onClick={() => onStart(n)}>
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
