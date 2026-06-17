import { fetchQuery } from "convex/nextjs";
import { AdminRecipeEditor } from "@/components/recipes/admin-recipe-editor";
import { api } from "@/convex/_generated/api";
import type { Locale } from "@/i18n/config";
import { updateRecipeAction } from "./actions";

type PageProps = {
  params: Promise<{
    locale: Locale;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  const recipes = await fetchQuery(api.recipes.listForEditing, { locale });

  return (
    <AdminRecipeEditor
      locale={locale}
      recipes={recipes}
      action={updateRecipeAction}
    />
  );
}
