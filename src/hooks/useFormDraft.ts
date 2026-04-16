import { useState } from 'react'

export function useFormDraft<T>(key: string, defaultValue: T): [T, (val: T) => void, () => void] {
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

  return [value, set, clear]
}
