import { type SetStateAction, useCallback, useState } from 'react'

// In-memory only: survives navigating between tools, never written to storage
// (inputs are often certificates, tokens or keys).
const cache = new Map<string, unknown>()

/**
 * `useState` that keeps its value for the rest of the session, keyed by `key`
 * (use `toolname:field`). Navigating away and back restores the last value.
 */
export function useToolState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() =>
    cache.has(key) ? (cache.get(key) as T) : initial instanceof Function ? initial() : initial,
  )
  const set = useCallback(
    (action: SetStateAction<T>) =>
      setValue((prev) => {
        const next = action instanceof Function ? action(prev) : action
        cache.set(key, next)
        return next
      }),
    [key],
  )
  return [value, set] as const
}

/** Test helper */
export function clearToolState() {
  cache.clear()
}
