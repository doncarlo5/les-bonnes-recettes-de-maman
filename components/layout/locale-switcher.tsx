"use client";

import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { localeDetails, locales, type Locale } from "@/i18n/config";

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

  const hrefFor = (locale: Locale) => {
    const segments = pathname.split("/");
    if (segments[1] && localeSet.has(segments[1])) {
      segments[1] = locale;
    } else {
      segments.splice(1, 0, locale);
    }
    const localizedPath = segments.join("/") || `/${locale}`;
    const query = searchParams.toString();
    return `${localizedPath}${query ? `?${query}` : ""}${hash}`;
  };

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Langue : ${localeDetails[current].name}`}
        className="type-label inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-primary transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted md:min-h-10"
      >
        {localeDetails[current].short}
        <ChevronDown
          aria-hidden
          className="size-4 text-muted-foreground transition-transform duration-200 [[data-popup-open]_&]:rotate-180"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="isolate z-50 outline-none" align="end" sideOffset={6}>
          <Menu.Popup className="min-w-48 origin-(--transform-origin) rounded-xl bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {locales.map((locale) => {
              const isActive = locale === current;
              return (
                <Menu.LinkItem
                  key={locale}
                  closeOnClick
                  render={
                    <Link
                      href={hrefFor(locale)}
                      hrefLang={localeDetails[locale].htmlLang}
                      lang={localeDetails[locale].htmlLang}
                      aria-current={isActive ? "true" : undefined}
                    />
                  }
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none select-none data-highlighted:bg-muted md:min-h-9"
                >
                  <span className="type-label w-6 text-muted-foreground">
                    {localeDetails[locale].short}
                  </span>
                  <span className={isActive ? "font-medium text-primary" : ""}>
                    {localeDetails[locale].name}
                  </span>
                  {isActive ? <Check aria-hidden className="ml-auto size-4 text-primary" /> : null}
                </Menu.LinkItem>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
