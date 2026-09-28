import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Evita inconsistência entre SSR e cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full shrink-0"
        disabled
        aria-label="Alternar entre tema claro e escuro"
      >
        <Sun className="size-5 text-muted-foreground opacity-50" />
        <span className="hidden sm:inline">Tema</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full shrink-0 px-3"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
      aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="hidden sm:inline">{theme === "dark" ? "Claro" : "Escuro"}</span>
    </Button>
  );
}
