import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './PosterModal.css'

type Variant = 'default' | 'location' | 'immersive' | 'tall' | 'meet'

type PosterModalProps = {
  badge?: string
  scene?: string
  /** 破框立绘（事件/结果） */
  stickerSrc?: string | null
  stickerAlt?: string
  /** 结识：全幅立绘 */
  meetSrc?: string | null
  meetAlt?: string
  floatText?: string
  onLeave?: () => void
  leaveDisabled?: boolean
  variant?: Variant
  className?: string
  ariaLabel?: string
  children: ReactNode
}

function CloseGlyph() {
  return (
    <svg className="poster-close-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
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

export function PosterModal({
  badge,
  scene,
  stickerSrc,
  stickerAlt = '',
  meetSrc,
  meetAlt = '',
  floatText,
  onLeave,
  leaveDisabled,
  variant = 'default',
  className,
  ariaLabel,
  children,
}: PosterModalProps) {
  const hasSticker = Boolean(stickerSrc)
  const isMeet = variant === 'meet' || Boolean(meetSrc)
  const cls = [
    'poster-modal',
    `is-${variant}`,
    hasSticker ? 'has-sticker' : '',
    isMeet ? 'is-meet' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={cls} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      {isMeet ? (
        <div className="poster-meet-hero">
          {meetSrc ? (
            <img className="poster-meet-portrait" src={meetSrc} alt={meetAlt} draggable={false} />
          ) : null}
          {badge ? <span className="poster-badge">{badge}</span> : null}
          {onLeave ? (
            <button
              type="button"
              className="poster-close poster-close-leave"
              aria-label="离开"
              disabled={leaveDisabled}
              onClick={onLeave}
            >
              <span>离开</span>
              <CloseGlyph />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="poster-hero">
          {scene ? <img src={scene} alt="" draggable={false} /> : null}
          {badge ? <span className="poster-badge">{badge}</span> : null}
          {onLeave ? (
            <button
              type="button"
              className="poster-close poster-close-leave"
              aria-label="离开"
              disabled={leaveDisabled}
              onClick={onLeave}
            >
              <span>离开</span>
              <CloseGlyph />
            </button>
          ) : null}
          {stickerSrc ? (
            <img className="poster-sticker" src={stickerSrc} alt={stickerAlt} draggable={false} />
          ) : null}
          {floatText ? <span className="poster-float">{floatText}</span> : null}
        </div>
      )}
      <div className={['poster-body', hasSticker ? 'after-sticker' : ''].filter(Boolean).join(' ')}>
        {children}
      </div>
    </article>
  )
}

type AppBarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  iconSrc?: string | null
  iconPlaceholder?: string
  title: string
  meta?: string
  action?: string
}

/** 落点列表行：左缩略图 + 名称/副标题 + 右操作文案 */
export function AppBarButton({
  iconSrc,
  iconPlaceholder = '+',
  title,
  meta,
  action,
  className,
  ...rest
}: AppBarButtonProps) {
  return (
    <button type="button" className={['poster-appbar', className].filter(Boolean).join(' ')} {...rest}>
      {iconSrc ? (
        <img className="poster-appbar-icon" src={iconSrc} alt="" draggable={false} />
      ) : (
        <span className="poster-appbar-icon poster-appbar-icon-ph" aria-hidden="true">
          {iconPlaceholder}
        </span>
      )}
      <span className="poster-appbar-text">
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
      {action ? <span className="poster-appbar-action">{action}</span> : null}
    </button>
  )
}
