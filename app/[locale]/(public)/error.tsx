"use client";

import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const { dict } = useLocaleDictionary();

  return (
    <main className="min-h-screen bg-pale-amber-50 px-6 py-10 text-soft-peach-950">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-4 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-soft-peach-600">
          {dict.error.eyebrow}
        </p>
        <h1 className="font-heading text-4xl font-bold leading-tight text-stone-950">
          {dict.error.title}
        </h1>
        <p className="text-balance text-base leading-7 text-stone-500">
          {error.message || dict.error.description}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-full bg-soft-peach-500 px-5 py-2 text-sm font-extrabold text-white transition hover:bg-soft-peach-600"
        >
          {dict.error.retry}
        </button>
      </div>
    </main>
  );
}
