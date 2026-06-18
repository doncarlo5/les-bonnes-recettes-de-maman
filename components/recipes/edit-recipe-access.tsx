import Link from "next/link";
import { Pencil } from "lucide-react";
import type { Locale } from "@/i18n/config";

type EditRecipeAccessProps = {
  locale: Locale;
  slug: string;
};

export function EditRecipeAccess({
  locale,
  slug,
}: EditRecipeAccessProps) {
  const adminHref = `/${locale}/admin/recettes?slug=${encodeURIComponent(slug)}`;

  return (
    <Link
      href={adminHref}
      className="absolute left-16 top-4 z-10 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white/15 px-4 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:left-24 lg:top-8 lg:h-11"
    >
      <Pencil className="size-4 stroke-[1.8]" />
      Éditer
    </Link>
  );
}
