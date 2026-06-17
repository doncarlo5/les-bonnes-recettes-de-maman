"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Changer de thème"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Icons toggle via CSS to avoid a hydration mismatch. */}
      <Sun className="hidden size-[1.15rem] stroke-[1.8] dark:block" />
      <Moon className="size-[1.15rem] stroke-[1.8] dark:hidden" />
    </button>
  );
}
