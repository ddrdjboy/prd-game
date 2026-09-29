import { useState } from 'react'
import './SceneBanner.css'

type Props = {
  src: string | undefined
  className?: string
}

/** 弹窗顶部场景头图：出血到卡片边缘，底部渐隐进面板底色 */
export function SceneBanner({ src, className }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  if (!src || failed === src) return null
  return (
    <div className={['scene-banner', className].filter(Boolean).join(' ')} aria-hidden="true">
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(src)}
      />
    </div>
  )
}
