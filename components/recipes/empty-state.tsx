import Link from "next/link";
import { Utensils } from "lucide-react";

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({
  eyebrow,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <main className="px-6 py-20 lg:py-28">
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-5 text-center">
        <Utensils className="size-9 text-soft-peach-500" strokeWidth={1.6} />
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-soft-peach-700">
          {eyebrow}
        </p>
        <h1 className="font-heading text-5xl font-black leading-[0.95] tracking-tight text-stone-950 lg:text-6xl">
          {title}
        </h1>
        <div aria-hidden className="h-px w-12 bg-soft-peach-500" />
        <p className="text-balance font-heading text-xl italic leading-relaxed text-stone-600">
          {description}
        </p>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="mt-4 inline-flex items-center rounded-full bg-soft-peach-600 px-6 py-2.5 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-soft-peach-700"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </main>
  );
}
