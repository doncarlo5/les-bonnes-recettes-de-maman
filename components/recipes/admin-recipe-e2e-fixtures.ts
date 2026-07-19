import type { Id } from "@/convex/_generated/dataModel";
import { getPublicationState, getRecipeReadiness } from "@/lib/recipe-admin-domain";
import type { EditableRecipe, EditableRecipeSummary, Recipe } from "./types";

const localized = {
  title: "Tarte de démonstration",
  author: "Maman",
  description: "Une recette utilisée uniquement par les tests du studio mobile.",
  yieldLabel: "6 personnes",
  prepTime: "20 min",
  cookTime: "30 min",
  totalTime: "50 min",
  timeLabel: "50 min",
  temperature: "four moyen",
  ingredients: [
    { name: "Farine", quantity: "200", unit: "g", notes: "tamisée" },
    { name: "Œufs", quantity: "3", unit: "", notes: "" },
  ],
  sections: [{ title: "Préparation", steps: ["Mélanger les ingrédients.", "Cuire au four."] }],
  subRecipes: [{
    title: "Crème",
    ingredients: [
      { name: "Lait", quantity: "100", unit: "ml", notes: "" },
      { name: "Vanille", quantity: "un peu", unit: "", notes: "" },
    ],
  }],
  notes: ["Servir tiède."],
};

const content = {
  defaultLocale: "fr" as const,
  referenceServings: 6,
  translations: {
    fr: localized,
    en: { ...localized, title: "Demo tart", description: "A recipe used by mobile studio tests.", yieldLabel: "6 servings", prepTime: "" },
  },
  tags: ["dessert"],
  status: "published" as const,
};

export function getRecipeAdminE2EFixtures() {
  if (process.env.NODE_ENV === "production" || process.env.RECIPE_ADMIN_E2E !== "1") return null;
  const publication = getPublicationState("published", 3, 3);
  const readiness = getRecipeReadiness(content, false);
  const recipe: EditableRecipe = {
    _id: "e2e-recipe" as Id<"recipes">,
    _creationTime: 1,
    slug: "tarte-de-demonstration",
    title: localized.title,
    heroImageUrl: "",
    imageCredit: {
      provider: "unsplash",
      photographerName: "Photographe de démonstration",
      photographerUrl: "https://example.com/photographe",
      photoUrl: "https://example.com/photo",
      alt: "Tarte de démonstration décorée de fruits",
    },
    revision: 3,
    publishedRevision: 3,
    updatedAt: 1,
    readiness,
    ...publication,
    ...content,
  };
  const summary: EditableRecipeSummary = {
    _id: recipe._id,
    _creationTime: recipe._creationTime,
    slug: recipe.slug,
    title: recipe.title,
    heroImageUrl: recipe.heroImageUrl,
    tags: recipe.tags,
    status: recipe.status,
    revision: recipe.revision,
    publishedRevision: recipe.publishedRevision,
    updatedAt: recipe.updatedAt,
    readiness: recipe.readiness,
    isPublic: recipe.isPublic,
    hasPublishedVersion: recipe.hasPublishedVersion,
    hasUnpublishedChanges: recipe.hasUnpublishedChanges,
    canDiscard: recipe.canDiscard,
  };
  return { recipes: [summary], recipe };
}

export function getPublicRecipeE2EFixture(locale: "fr" | "en", slug?: string) {
  const fixtures = getRecipeAdminE2EFixtures();
  if (!fixtures) return null;
  const recipe = fixtures.recipe;
  const publicRecipe = {
    _id: recipe._id,
    _creationTime: recipe._creationTime,
    slug: recipe.slug,
    heroImageUrl: recipe.heroImageUrl,
    imageCredit: recipe.imageCredit,
    defaultLocale: recipe.defaultLocale,
    referenceServings: recipe.referenceServings,
    tags: recipe.tags,
    status: recipe.status,
    ...recipe.translations[locale],
  } satisfies Recipe;

  if (!slug || slug === recipe.slug) return publicRecipe;
  if (slug === "autre-recette-de-demonstration") {
    return {
      ...publicRecipe,
      slug,
      title: locale === "fr" ? "Autre recette de démonstration" : "Another demo recipe",
      referenceServings: 4,
      yieldLabel: locale === "fr" ? "4 personnes" : "4 servings",
    } satisfies Recipe;
  }
  if (slug === "ancienne-recette-sans-portions") {
    return {
      ...publicRecipe,
      slug,
      title: locale === "fr" ? "Ancienne recette sans portions" : "Legacy recipe without servings",
      referenceServings: undefined,
      yieldLabel: "2 cakes",
    } satisfies Recipe;
  }
  return null;
}
