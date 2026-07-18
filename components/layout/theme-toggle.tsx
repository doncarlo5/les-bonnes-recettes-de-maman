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
      className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-[scale,background-color,color] duration-150 hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] md:size-10"
    >
      <span className="relative size-5">
        <Sun className="absolute inset-0 size-5 scale-[0.25] opacity-0 blur-[4px] transition-[scale,opacity,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] dark:scale-100 dark:opacity-100 dark:blur-0" />
        <Moon className="absolute inset-0 size-5 scale-100 opacity-100 blur-0 transition-[scale,opacity,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] dark:scale-[0.25] dark:opacity-0 dark:blur-[4px]" />
      </span>
    </button>
  );
}
