"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";

type LocaleSwitcherProps = {
  current: Locale;
};

export function LocaleSwitcher({ current }: LocaleSwitcherProps) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.18em]">
      {locales.map((locale, index) => {
        const isActive = locale === current;
        const segments = pathname.split("/");
        if (segments[1] && (locales as readonly string[]).includes(segments[1])) {
          segments[1] = locale;
        } else {
          segments.splice(1, 0, locale);
        }
        const href = segments.join("/") || `/${locale}`;

        return (
          <span key={locale} className="flex items-center gap-1">
            {index > 0 ? (
              <span className="text-muted-foreground/40" aria-hidden>
                /
              </span>
            ) : null}
            <Link
              href={href}
              aria-current={isActive ? "true" : undefined}
              className={
                isActive
                  ? "text-primary"
                  : "text-muted-foreground transition hover:text-primary"
              }
            >
              {locale}
            </Link>
          </span>
        );
      })}
    </div>
  );
}
