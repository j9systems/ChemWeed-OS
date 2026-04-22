import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { isReloadSafe, subscribeReloadSafety } from '@/lib/reloadSafety'

const DEBOUNCE_MS = 2000
const PASSIVE_INDICATOR_AFTER_MS = 10 * 60 * 1000

export function UpdateController() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  const [showPassive, setShowPassive] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const firstPendingAt = useRef<number | null>(null)
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const passiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearPendingTimer() {
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current)
      pendingTimer.current = null
    }
  }

  useEffect(() => {
    if (!needRefresh) {
      firstPendingAt.current = null
      setShowPassive(false)
      clearPendingTimer()
      if (passiveTimer.current) {
        clearTimeout(passiveTimer.current)
        passiveTimer.current = null
      }
      return
    }

    if (firstPendingAt.current === null) {
      firstPendingAt.current = Date.now()
    }

    function tryApply() {
      clearPendingTimer()
      if (!isReloadSafe()) return
      pendingTimer.current = setTimeout(() => {
        pendingTimer.current = null
        if (isReloadSafe()) {
          updateServiceWorker(true)
        }
      }, DEBOUNCE_MS)
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') tryApply()
    }

    const unsubscribe = subscribeReloadSafety(tryApply)
    document.addEventListener('visibilitychange', onVisibility)
    tryApply()

    const elapsed = firstPendingAt.current ? Date.now() - firstPendingAt.current : 0
    const remaining = Math.max(0, PASSIVE_INDICATOR_AFTER_MS - elapsed)
    passiveTimer.current = setTimeout(() => setShowPassive(true), remaining)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      clearPendingTimer()
      if (passiveTimer.current) {
        clearTimeout(passiveTimer.current)
        passiveTimer.current = null
      }
    }
  }, [needRefresh, updateServiceWorker])

  if (!needRefresh || !showPassive) return null

  return (
    <div className="fixed bottom-4 left-4 z-[60]">
      {expanded ? (
        <div className="rounded-lg bg-white shadow-lg border border-surface-border px-3 py-2 flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-muted)]">New version waiting.</span>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => updateServiceWorker(true)}
                className="rounded-md px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: '#2a6b2a' }}
              >
                Confirm update
              </button>
              <button
                type="button"
                onClick={() => { setConfirming(false); setExpanded(false) }}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: '#2a6b2a' }}
            >
              Update now
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onMouseEnter={() => setExpanded(true)}
          onClick={() => setExpanded(true)}
          title="New version waiting — will update when you close this form"
          aria-label="New version waiting"
          className="h-8 w-8 rounded-full shadow-md border border-surface-border bg-white/80 hover:bg-white flex items-center justify-center"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#2a6b2a' }} />
        </button>
      )}
    </div>
  )
}
