"use client";

import "./globals.css";
import { fontVariables } from "@/app/fonts";
import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const { dict } = useLocaleDictionary();

  return (
    <html lang="fr" className={`${fontVariables} antialiased`}>
      <body className="bg-background text-foreground">
        <main className="px-6 py-20">
          <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-5 text-center">
            <p className="type-label text-primary">{dict.error.globalEyebrow}</p>
            <h1 className="type-page-title text-foreground">
              {dict.error.globalTitle}
            </h1>
            <div aria-hidden className="h-px w-12 bg-primary" />
            <p className="type-editorial-lead text-muted-foreground">
              {error.message || dict.error.description}
            </p>
            <button
              type="button"
              onClick={reset}
              className="type-label mt-4 inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-primary-foreground transition hover:bg-primary/90"
            >
              {dict.error.retry}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
