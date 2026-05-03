"use client";

import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";

export function LocalizedLoading() {
  const { dict } = useLocaleDictionary();

  return (
    <main className="min-h-screen bg-pale-amber-50 px-6 py-10 text-soft-peach-950">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-soft-peach-700">
          {dict.loading.recipes}
        </p>
      </div>
    </main>
  );
}
