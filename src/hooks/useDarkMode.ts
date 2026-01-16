import { useState, useCallback } from 'react'

/**
 * Hook for managing dark mode state with localStorage persistence
 * @param initialValue - Initial dark mode value
 * @returns Tuple of [darkMode, setDarkMode]
 */
export function useDarkMode(initialValue = false): [boolean, (value: boolean) => void] {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem('isDarkMode')
      return item ? item === 'true' : initialValue
    } catch (error) {
      console.error('Failed to read dark mode from localStorage:', error)
      return initialValue
    }
  })

  const setDarkMode = useCallback((value: boolean) => {
    try {
      setDark(value)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('isDarkMode', String(value))
      }
    } catch (error) {
      console.error('Failed to save dark mode to localStorage:', error)
    }
  }, [])

  return [dark, setDarkMode]
}
