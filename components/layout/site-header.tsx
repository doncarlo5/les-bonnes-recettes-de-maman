"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./locale-switcher";

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
        "sticky z-40 border-b border-stone-200/60 backdrop-blur transition-all duration-200",
        isHeaderHidden ? "-top-24" : "top-0",
        isHeaderScrolled
          ? "bg-background/85 supports-[backdrop-filter]:bg-background/70"
          : "bg-background"
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
        <Link
          href={`/${locale}`}
          className="font-heading text-xl font-black leading-none tracking-tight text-stone-950 sm:text-2xl"
        >
          {dict.site.wordmark}
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-bold uppercase tracking-[0.18em] text-stone-600 md:flex">
          <Link
            href={`/${locale}`}
            className="transition hover:text-soft-peach-700"
          >
            {dict.nav.recipes}
          </Link>
          <span
            aria-disabled
            className="cursor-default text-stone-300"
            title="—"
          >
            {dict.nav.about}
          </span>
        </nav>

        <LocaleSwitcher current={locale} />
      </div>
    </header>
  );
}
