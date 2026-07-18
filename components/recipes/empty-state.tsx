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
        <Utensils className="size-9 text-primary" strokeWidth={1.6} />
        <p className="type-label text-primary">{eyebrow}</p>
        <h1 className="type-page-title text-foreground">
          {title}
        </h1>
        <div aria-hidden className="h-px w-12 bg-primary" />
        <p className="type-editorial-lead text-muted-foreground">
          {description}
        </p>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="type-label mt-4 inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-primary-foreground transition hover:bg-primary/90"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </main>
  );
}
