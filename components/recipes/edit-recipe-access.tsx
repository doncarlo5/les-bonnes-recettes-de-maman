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
      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-[scale,background-color,color] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] md:min-h-10"
    >
      <Pencil className="size-4 stroke-[1.8]" />
      Éditer
    </Link>
  );
}
