"use client";

import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const { dict } = useLocaleDictionary();

  return (
    <main className="px-6 py-20">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-5 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-soft-peach-700">
          {dict.error.eyebrow}
        </p>
        <h1 className="font-heading text-5xl font-black leading-[0.95] tracking-tight text-stone-950 lg:text-6xl">
          {dict.error.title}
        </h1>
        <div aria-hidden className="h-px w-12 bg-soft-peach-500" />
        <p className="text-balance font-heading text-xl italic leading-relaxed text-stone-600">
          {error.message || dict.error.description}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex items-center rounded-full bg-soft-peach-600 px-6 py-2.5 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-soft-peach-700"
        >
          {dict.error.retry}
        </button>
      </div>
    </main>
  );
}
