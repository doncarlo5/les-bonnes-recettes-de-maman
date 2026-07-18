"use client";

import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";

export function LocalizedLoading() {
  const { dict } = useLocaleDictionary();

  return (
    <main className="px-6 py-20">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md items-center justify-center">
        <p className="type-label text-primary">{dict.loading.recipes}</p>
      </div>
    </main>
  );
}
