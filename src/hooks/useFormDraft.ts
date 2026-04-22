import { useState } from 'react'
import { useReloadLock } from './useReloadLock'

interface UseFormDraftOptions {
  lockReload?: boolean
}

export function useFormDraft<T>(
  key: string,
  defaultValue: T,
  options: UseFormDraftOptions = {},
): [T, (val: T) => void, () => void] {
  const { lockReload = true } = options
  const storageKey = `draft__${key}`

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) return JSON.parse(stored) as T
    } catch { /* parse error — fall back to default */ }
    return defaultValue
  })

  function set(val: T) {
    setValue(val)
    try { localStorage.setItem(storageKey, JSON.stringify(val)) } catch { /* quota exceeded */ }
  }

  function clear() {
    setValue(defaultValue)
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
  }

  const isDirty = JSON.stringify(value) !== JSON.stringify(defaultValue)
  useReloadLock(lockReload && isDirty)

  return [value, set, clear]
}
