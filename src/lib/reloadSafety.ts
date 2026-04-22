type Listener = () => void

const locks = new Set<string>()
const listeners = new Set<Listener>()

export function acquireReloadLock(id: string) {
  locks.add(id)
  listeners.forEach((l) => l())
}

export function releaseReloadLock(id: string) {
  locks.delete(id)
  listeners.forEach((l) => l())
}

export function isReloadSafe() {
  return locks.size === 0
}

export function subscribeReloadSafety(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
