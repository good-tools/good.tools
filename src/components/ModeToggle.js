import { createContext, useContext, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";

export function useDarkMode(initialValue = false) {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem("isDarkMode");
      return item ? item === 'true' : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setDarkMode = (value) => {
    try {
      setDark(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("isDarkMode", value);
      }
    } catch (error) {

    }
  };

  return [dark, setDarkMode];
}

export const DarkModeContext = createContext({
  darkMode: false,
  setDarkMode: (dark) => {}
})

export function DarkModeProvider({ children }) {
  const [ darkMode, setDarkMode ] = useDarkMode(false)
  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  )
}

export function ModeToggle() {
  const { setDarkMode } = useContext(DarkModeContext)

  function disableTransitionsTemporarily() {
    document.documentElement.classList.add('[&_*]:!transition-none')
    window.setTimeout(() => {
      document.documentElement.classList.remove('[&_*]:!transition-none')
    }, 0)
  }

  function toggleMode() {
    disableTransitionsTemporarily()

    let darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    let isSystemDarkMode = darkModeMediaQuery.matches
    let isDarkMode = document.documentElement.classList.toggle('dark')

    if (isDarkMode === isSystemDarkMode) {
      setDarkMode(false)
    } else {
      setDarkMode(isDarkMode)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMode}
      aria-label="Toggle dark mode"
      className="rounded-lg"
    >
      <Sun className="h-5 w-5 rotate-90 scale-0 transition-all dark:-rotate-90 dark:scale-100" />
      <Moon className="absolute h-5 w-5 rotate-0 scale-100 transition-all dark:rotate-0 dark:scale-0" />
    </Button>
  )
}

