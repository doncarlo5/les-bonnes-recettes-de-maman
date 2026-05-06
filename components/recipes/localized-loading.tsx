"use client";

import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";

export function LocalizedLoading() {
  const { dict } = useLocaleDictionary();

  return (
    <main className="px-6 py-20">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md items-center justify-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-soft-peach-700">
          {dict.loading.recipes}
        </p>
      </div>
    </main>
  );
}
