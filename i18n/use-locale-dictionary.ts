"use client";

import { usePathname } from "next/navigation";
import { defaultLocale, hasLocale } from "./config";
import { clientDictionaries } from "./client-dictionaries";

export function useLocaleDictionary() {
  const pathname = usePathname();
  const firstSegment = pathname.split("/")[1];
  const locale = hasLocale(firstSegment) ? firstSegment : defaultLocale;

  return {
    locale,
    dict: clientDictionaries[locale],
  };
}
