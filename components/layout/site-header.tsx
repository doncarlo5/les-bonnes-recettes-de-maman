"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderProps = {
  locale: Locale;
  dict: Dictionary;
};

export function SiteHeader({ locale, dict }: SiteHeaderProps) {
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const isScrollingDown = currentScrollY > lastScrollY;
        const hasEnoughScroll = currentScrollY > 100;

        setIsHeaderHidden(isScrollingDown && hasEnoughScroll);
        setIsHeaderScrolled(hasEnoughScroll);
        lastScrollY = currentScrollY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky z-40 border-b border-border/60 backdrop-blur transition-[top,background-color] duration-200",
        isHeaderHidden ? "-top-24" : "top-0",
        isHeaderScrolled
          ? "bg-background/85 supports-[backdrop-filter]:bg-background/70"
          : "bg-background"
      )}
    >
      <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-4 px-5 lg:px-10">
        <Link
          href={`/${locale}`}
          className="type-wordmark text-foreground"
        >
          {dict.site.wordmark}
        </Link>

        <nav className="type-label hidden items-center gap-8 text-muted-foreground md:flex">
          <Link
            href={`/${locale}#recettes`}
            className="transition-colors duration-150 hover:text-primary"
          >
            {dict.nav.recipes}
          </Link>
          <Link
            href={`/${locale}/admin/recettes?new=1`}
            className="transition-colors duration-150 hover:text-primary"
          >
            {dict.nav.newRecipe}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher current={locale} />
          <span aria-hidden className="h-4 w-px bg-border" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
