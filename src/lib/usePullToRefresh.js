/**
 * usePullToRefresh — adds pull-to-refresh on mobile PWA.
 *
 * Native pull-to-refresh is disabled in standalone PWA mode.
 * This hook re-enables it: pull down 80px from the very top → reload.
 */
import { useEffect } from 'react'

export function usePullToRefresh() {
  useEffect(() => {
    let startY = 0
    let pulling = false
    let indicator = null

    function onTouchStart(e) {
      // Only trigger when already scrolled to the very top
      if (window.scrollY !== 0) return
      startY = e.touches[0].clientY
      pulling = true
    }

    function onTouchMove(e) {
      if (!pulling) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) { pulling = false; removeIndicator(); return }

      // Show a small visual indicator below the notch / Dynamic Island
      if (dy > 10) {
        if (!indicator) {
          indicator = document.createElement('div')
          indicator.id = 'ptr-indicator'
          indicator.style.cssText = `
            position: fixed;
            top: env(safe-area-inset-top, 44px);
            left: 50%; transform: translateX(-50%);
            background: var(--accent, #22c55e); color: #fff;
            padding: 6px 18px; border-radius: 0 0 12px 12px;
            font-size: 13px; font-weight: 600; z-index: 9999;
            transition: opacity 0.2s;
            white-space: nowrap;
          `
          document.body.appendChild(indicator)
        }
        indicator.textContent = dy > 70 ? '↑ Release to refresh' : '↓ Pull down to refresh'
        indicator.style.opacity = Math.min(dy / 70, 1)
      }
    }

    function onTouchEnd(e) {
      if (!pulling) return
      pulling = false
      const dy = e.changedTouches[0].clientY - startY
      if (dy > 70) {
        // Keep indicator visible with a "Refreshing" message until the page reloads
        if (indicator) {
          indicator.textContent = '🔄 Refreshing…'
          indicator.style.opacity = '1'
        }
        setTimeout(() => window.location.reload(), 300)
      } else {
        removeIndicator()
      }
    }

    function removeIndicator() {
      if (indicator) {
        indicator.remove()
        indicator = null
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
      removeIndicator()
    }
  }, [])
}
