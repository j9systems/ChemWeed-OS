import { useEffect, useId } from 'react'
import { acquireReloadLock, releaseReloadLock } from '@/lib/reloadSafety'

export function useReloadLock(active: boolean) {
  const id = useId()
  useEffect(() => {
    if (!active) return
    acquireReloadLock(id)
    return () => releaseReloadLock(id)
  }, [active, id])
}
