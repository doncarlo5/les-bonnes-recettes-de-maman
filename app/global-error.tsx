"use client";

import "./globals.css";
import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const { dict } = useLocaleDictionary();

  return (
    <html lang="fr">
      <body className="bg-background text-foreground">
        <main className="px-6 py-20">
          <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-5 text-center">
            <p className="eyebrow">{dict.error.globalEyebrow}</p>
            <h1 className="font-heading text-5xl font-black leading-[0.95] tracking-tight text-foreground lg:text-6xl">
              {dict.error.globalTitle}
            </h1>
            <div aria-hidden className="h-px w-12 bg-primary" />
            <p className="text-balance font-heading text-xl italic leading-relaxed text-muted-foreground">
              {error.message || dict.error.description}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm font-bold uppercase tracking-[0.2em] text-primary-foreground transition hover:bg-primary/90"
            >
              {dict.error.retry}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
