import type { ReactNode } from 'react'
import { portraitUrl } from '../../game/portraits'
import './Portrait.css'

type Size = 'sm' | 'md' | 'lg' | 'xl' | 'card'

type Props = {
  name: string
  portraitId?: string
  size?: Size
  className?: string
  /** 叠在立绘底部渐隐区的文字（xl / card） */
  caption?: ReactNode
  /** 关系破裂：灰阶 + 角标 */
  estranged?: boolean
}

function initialOf(name: string): string {
  const t = name.trim()
  return t ? t[0]! : '?'
}

function hueFor(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export function Portrait({ name, portraitId, size = 'md', className, caption, estranged }: Props) {
  const src = portraitUrl(portraitId)
  const cls = [
    'portrait',
    `portrait-${size}`,
    estranged ? 'is-estranged' : '',
    caption ? 'has-caption' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const overlay = (
    <>
      {estranged ? <span className="portrait-badge">已疏远</span> : null}
      {caption ? <span className="portrait-caption">{caption}</span> : null}
    </>
  )

  if (src) {
    return (
      <span className={cls} title={name}>
        <img src={src} alt={name} draggable={false} loading="lazy" decoding="async" />
        {overlay}
      </span>
    )
  }

  const hue = hueFor(name)
  return (
    <span
      className={`${cls} portrait-ph`}
      title={name}
      style={{ background: `linear-gradient(145deg, hsl(${hue} 32% 38%), hsl(${(hue + 40) % 360} 28% 22%))` }}
      aria-label={name}
    >
      <span className="portrait-initial">{initialOf(name)}</span>
      {overlay}
    </span>
  )
}
