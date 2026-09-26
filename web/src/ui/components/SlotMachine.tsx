import { useEffect, useState } from 'react'
import type { SlotSpin } from '../../game/types'
import './SlotMachine.css'

type Props = {
  spin: SlotSpin | null
  lastReels: [number, number, number] | null
  trackLabel: string
  spinning: boolean
  comboLabel?: string | null
  comboFlash?: boolean
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function Reel({
  value,
  spinning,
  delayMs,
  emphasis,
}: {
  value: number
  spinning: boolean
  delayMs: number
  emphasis?: boolean
}) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (!spinning) {
      setDisplay(value)
      return
    }
    let n = 0
    const id = window.setInterval(() => {
      setDisplay(DIGITS[n % 10])
      n++
    }, 50 + delayMs / 20)
    const stop = window.setTimeout(() => {
      window.clearInterval(id)
      setDisplay(value)
    }, 700 + delayMs)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [spinning, value, delayMs])

  return (
    <div className={`slot-reel${emphasis ? ' emphasis' : ''}${spinning ? ' spinning' : ''}`}>
      <span>{display}</span>
    </div>
  )
}

export function SlotMachine({
  spin,
  lastReels,
  trackLabel,
  spinning,
  comboLabel,
  comboFlash,
}: Props) {
  const reels = spin?.reels ?? lastReels ?? ([7, 7, 7] as [number, number, number])
  const is777 = comboLabel?.includes('777')
  const winClass = comboFlash
    ? is777
      ? ' combo-win combo-777'
      : ' combo-win'
    : ''

  return (
    <div className={`slot-machine${spinning ? ' is-spinning' : ''}${winClass}`}>
      <div className="slot-badge">777</div>
      {comboFlash && comboLabel ? <div className="slot-combo-tag">{comboLabel}</div> : null}
      <div className="slot-window">
        <Reel value={reels[0]} spinning={spinning} delayMs={0} emphasis />
        <Reel value={reels[1]} spinning={spinning} delayMs={220} />
        <Reel value={reels[2]} spinning={spinning} delayMs={420} />
      </div>
      <div className="slot-caption">
        <strong>①步数 · ②事件 · ③细则</strong>
        <span>{trackLabel}</span>
      </div>
    </div>
  )
}
