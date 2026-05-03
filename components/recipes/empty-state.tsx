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
    <main className="min-h-screen bg-pale-amber-50 px-6 py-10 text-soft-peach-950">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-4 text-center">
        <Utensils className="size-8 text-soft-peach-500" />
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-soft-peach-600">
          {eyebrow}
        </p>
        <h1 className="font-heading text-4xl font-bold leading-tight text-stone-950">
          {title}
        </h1>
        <p className="text-balance text-base leading-7 text-stone-500">
          {description}
        </p>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="mt-2 rounded-full bg-soft-peach-500 px-5 py-2 text-sm font-extrabold text-white transition hover:bg-soft-peach-600"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </main>
  );
}
