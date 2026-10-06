import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

const DRAG_THRESHOLD_PX = 8
/** 相对 cover 尺寸略放大，方便竖屏拖动浏览 */
const PAN_OVERSCAN = 1.12
/** 世界图 / 分区图默认比例 */
const DEFAULT_ASPECT = 3 / 4

type Props = {
  children: ReactNode
  className?: string
  /** 宽/高，默认 3/4 */
  aspectRatio?: number
  /** 为 true 时忽略本轮 pointerup 上的点击（拖拽后） */
  suppressClickRef?: React.MutableRefObject<boolean>
}

function coverSize(vpW: number, vpH: number, aspect: number, overscan: number) {
  let w = vpW
  let h = w / aspect
  if (h < vpH) {
    h = vpH
    w = h * aspect
  }
  return { w: w * overscan, h: h * overscan }
}

function clampOffset(x: number, y: number, vpW: number, vpH: number, stageW: number, stageH: number) {
  const minX = Math.min(0, vpW - stageW)
  const minY = Math.min(0, vpH - stageH)
  return {
    x: Math.min(0, Math.max(minX, x)),
    y: Math.min(0, Math.max(minY, y)),
  }
}

export function MapPanViewport({
  children,
  className,
  aspectRatio = DEFAULT_ASPECT,
  suppressClickRef,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origX: number
    origY: number
    moved: boolean
  } | null>(null)

  const measure = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const { clientWidth: vpW, clientHeight: vpH } = vp
    if (vpW <= 0 || vpH <= 0) return
    const next = coverSize(vpW, vpH, aspectRatio, PAN_OVERSCAN)
    setStage(next)
    setOffset((prev) => clampOffset(prev.x, prev.y, vpW, vpH, next.w, next.h))
  }, [aspectRatio])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(vp)
    return () => ro.disconnect()
  }, [measure])

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    const vp = viewportRef.current
    if (!vp) return
    vp.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
      moved: false,
    }
    if (suppressClickRef) suppressClickRef.current = false
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    const vp = viewportRef.current
    if (!drag || drag.pointerId !== e.pointerId || !vp) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      drag.moved = true
      if (suppressClickRef) suppressClickRef.current = true
    }
    if (!drag.moved) return
    setOffset(
      clampOffset(
        drag.origX + dx,
        drag.origY + dy,
        vp.clientWidth,
        vp.clientHeight,
        stage.w,
        stage.h,
      ),
    )
  }

  const endDrag = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    dragRef.current = null
    try {
      viewportRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  const stageStyle: CSSProperties = {
    width: stage.w || '100%',
    height: stage.h || '100%',
    transform: `translate(${offset.x}px, ${offset.y}px) scale(1)`,
  }

  return (
    <div
      ref={viewportRef}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="map-pan-stage" style={stageStyle}>
        {children}
      </div>
    </div>
  )
}
