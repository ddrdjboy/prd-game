import type { Career } from '../../game/types'
import { careerArt } from '../art'
import './CareerPickScreen.css'

type Props = {
  choices: Career[]
  onPick: (id: string) => void
}

export function CareerPickScreen({ choices, onPick }: Props) {
  return (
    <div className="career-pick">
      <h2>开局：职业卡 3 选 1</h2>
      <p className="muted">18 岁春天，你的第一份工作决定起跑线。</p>
      <div className="career-grid">
        {choices.map((c) => (
          <button key={c.id} className="career-card" onClick={() => onPick(c.id)}>
            {careerArt(c.id) ? (
              <span className="career-art" aria-hidden="true">
                <img src={careerArt(c.id)} alt="" decoding="async" draggable={false} />
              </span>
            ) : null}
            <h3>{c.name}</h3>
            <ul>
              <li>月薪 {c.salary} 万</li>
              <li>固定支出 {c.fixedExpense} 万</li>
              <li>起始现金 {c.startingCash} 万</li>
              <li className="trait">{c.traitLabel}</li>
            </ul>
          </button>
        ))}
      </div>
    </div>
  )
}
