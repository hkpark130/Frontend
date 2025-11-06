import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

export default function Tooltip({
  content,
  children,
  maxWidth = 420,
  maxHeight = 280,
  align = 'left', // 'left' | 'right' | 'center'
}) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)
  const wrapperRef = useRef(null)
  const tooltipRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [placed, setPlaced] = useState(false)

  const clearTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const openNow = () => {
    clearTimer()
    setOpen(true)
  }

  const scheduleClose = () => {
    clearTimer()
    closeTimer.current = setTimeout(() => setOpen(false), 50)
  }

  const computePosition = useCallback(() => {
    const trigger = wrapperRef.current
    const tip = tooltipRef.current
    if (!trigger || !tip) return

    const rect = trigger.getBoundingClientRect()
    const tipRect = tip.getBoundingClientRect()

    // 기본 아래쪽 배치
    const gap = 6
    let top = window.scrollY + rect.bottom + gap
    let left

    if (align === 'right') {
      left = window.scrollX + rect.right - tipRect.width
    } else if (align === 'center') {
      left = window.scrollX + rect.left + rect.width / 2 - tipRect.width / 2
    } else {
      left = window.scrollX + rect.left
    }

    // 뷰포트 하단 공간이 부족하면 위로 배치
    const availableBelow = window.innerHeight - rect.bottom
    if (availableBelow < tipRect.height + gap) {
      top = window.scrollY + rect.top - gap - tipRect.height
    }

    // 좌우 화면 가장자리 클램프
    const minLeft = window.scrollX + 8
    const maxLeft = window.scrollX + window.innerWidth - tipRect.width - 8
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft))

    setPosition({ top, left })
    setPlaced(true)
  }, [align])

  useLayoutEffect(() => {
    if (!open) {
      setPlaced(false)
      return
    }
    const handler = () => computePosition()
    // 최초 오픈 시 한 번 계산
    computePosition()
    // 스크롤/리사이즈에도 재계산 (캡처 단계 포함)
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
    // content, align 변화에도 재계산
  }, [open, content, computePosition])

  return (
    <span
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onFocus={openNow}
      onBlur={scheduleClose}
    >
      {children}
      {open &&
        ReactDOM.createPortal(
          <span
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'absolute',
              top: position.top,
              left: position.left,
              zIndex: 9999,
              background: '#222',
              color: '#fff',
              borderRadius: 6,
              padding: '8px 10px',
              boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
              maxWidth,
              maxHeight,
              overflowY: 'auto',
              overflowX: 'hidden',
              whiteSpace: 'normal',
              fontSize: 12,
              opacity: placed ? 1 : 0,
            }}
            onMouseEnter={openNow}
            onMouseLeave={scheduleClose}
          >
            {typeof content === 'string' ? (
              <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
            ) : (
              content
            )}
          </span>,
          document.body
        )}
    </span>
  )
}
