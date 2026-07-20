"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";

const localeSet = new Set<string>(locales);

type LocaleSwitcherProps = {
  current: Locale;
};

export function LocaleSwitcher({ current }: LocaleSwitcherProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);

  return (
    <div className="type-label flex items-center gap-1">
      {locales.map((locale, index) => {
        const isActive = locale === current;
        const segments = pathname.split("/");
        if (segments[1] && localeSet.has(segments[1])) {
          segments[1] = locale;
        } else {
          segments.splice(1, 0, locale);
        }
        const localizedPath = segments.join("/") || `/${locale}`;
        const query = searchParams.toString();
        const href = `${localizedPath}${query ? `?${query}` : ""}${hash}`;

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
                  ? "inline-flex min-h-11 items-center px-1 text-primary md:min-h-10"
                  : "inline-flex min-h-11 items-center px-1 text-muted-foreground transition-colors duration-150 hover:text-primary md:min-h-10"
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
