import { useEffect } from 'react'

/**
 * Warns the user via the browser's native beforeunload prompt when they
 * attempt to close/reload the tab while there are unsaved form changes.
 * Protects against Chrome's tab suspension behavior on Windows (the app
 * reloads when minimized for too long).
 *
 * Does NOT block React Router navigation — only full page unloads / tab close.
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Legacy browsers require returnValue to be set
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}
