import { createContext, useContext, ReactNode } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { useDarkMode } from "@/hooks/useDarkMode";

/**
 * Dark mode context type
 */
interface DarkModeContextType {
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

/**
 * Dark mode context
 */
export const DarkModeContext = createContext<DarkModeContextType>({
  darkMode: false,
  setDarkMode: () => {},
});

/**
 * Hook to access dark mode context
 */
export function useDarkModeContext(): DarkModeContextType {
  return useContext(DarkModeContext);
}

/**
 * Dark mode provider component
 */
interface DarkModeProviderProps {
  children: ReactNode;
}

export function DarkModeProvider({ children }: DarkModeProviderProps) {
  const [darkMode, setDarkMode] = useDarkMode(false);

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

/**
 * Mode toggle button component
 */
export function ModeToggle() {
  const { setDarkMode } = useDarkModeContext();

  function disableTransitionsTemporarily() {
    document.documentElement.classList.add("[&_*]:!transition-none");
    window.setTimeout(() => {
      document.documentElement.classList.remove("[&_*]:!transition-none");
    }, 0);
  }

  function toggleMode() {
    disableTransitionsTemporarily();

    const darkModeMediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );
    const isSystemDarkMode = darkModeMediaQuery.matches;
    const isDarkMode = document.documentElement.classList.toggle("dark");

    if (isDarkMode === isSystemDarkMode) {
      setDarkMode(false);
    } else {
      setDarkMode(isDarkMode);
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
  );
}
