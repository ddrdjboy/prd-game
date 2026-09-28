import { portraitUrl } from '../../game/portraits'
import './Portrait.css'

type Size = 'sm' | 'md' | 'lg'

type Props = {
  name: string
  portraitId?: string
  size?: Size
  className?: string
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

export function Portrait({ name, portraitId, size = 'md', className }: Props) {
  const src = portraitUrl(portraitId)
  const cls = ['portrait', `portrait-${size}`, className].filter(Boolean).join(' ')

  if (src) {
    return (
      <span className={cls} title={name}>
        <img src={src} alt={name} draggable={false} />
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
    </span>
  )
}
