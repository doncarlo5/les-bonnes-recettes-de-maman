// TEMPORARY verification page — delete before commit.
import { RecipeShelf } from "@/components/recipes/recipe-shelf";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { RecipeSummary } from "@/components/recipes/types";

const titles = ["Amandin au citron", "Tiramisu", "Coulant au chocolat", "Gratin dauphinois", "Blanquette de veau", "Tarte tatin", "Quiche lorraine", "Crêpes de la Chandeleur", "Bœuf bourguignon", "Clafoutis aux cerises", "Ratatouille", "Mousse au chocolat", "Pot-au-feu", "Far breton"];
const cats = [["dessert","sucre"],["plat","sale"],["dessert"],["sale"]] as const;

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const recipes: RecipeSummary[] = titles.map((title, i) => ({
    _id: `demo${i}` as RecipeSummary["_id"], _creationTime: i, slug: title.toLowerCase().replace(/[^a-z]+/g, "-"),
    heroImageUrl: "", categories: [...cats[i % 4]], title, author: "Maman", description: "",
    prepTime: "20 min", cookTime: i % 3 ? "35 min" : "", timeLabel: "55 min", commentCount: 0,
    ingredients: [], yieldLabel: "6 personnes", stepCount: (i * 7) % 15,
  }));
  return <main className="mx-auto max-w-6xl px-4 py-10"><RecipeShelf locale={locale} dict={dict} recipes={recipes} /></main>;
}
