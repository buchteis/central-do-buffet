import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

/**
 * Tema claro é o padrão no primeiro acesso (não segue o tema do aparelho).
 * Depois que o usuário escolhe, a escolha fica salva neste navegador.
 */
export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "app-ui-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  // Lê a escolha salva só após montar (evita divergência SSR/cliente)
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "dark" || saved === "light") setThemeState(saved);
    else localStorage.removeItem(storageKey); // valores antigos como "system"
  }, [storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (next: Theme) => {
      localStorage.setItem(storageKey, next);
      setThemeState(next);
    },
  };

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (!context) {
    throw new Error("useTheme deve ser usado dentro de um ThemeProvider");
  }
  return context;
};
