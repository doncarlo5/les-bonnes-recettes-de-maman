import type { Id } from "@/convex/_generated/dataModel";
import type { RecipeReadiness } from "@/lib/recipe-admin-domain";

export type Ingredient = {
  name: string;
  quantity: string;
  unit: string;
  notes: string;
};

export type RecipeSection = {
  title: string;
  steps: string[];
};

export type SubRecipe = {
  title: string;
  ingredients: Ingredient[];
};

export type Recipe = {
  _id: Id<"recipes">;
  _creationTime: number;
  slug: string;
  heroImageUrl: string;
  imageCredit?:
    | {
        provider: "unsplash";
        photographerName: string;
        photographerUrl: string;
        photoUrl: string;
        alt: string;
      }
    | {
        provider: "openverse";
        title: string;
        creator: string;
        creatorUrl: string;
        imageUrl: string;
        landingUrl: string;
        license: string;
        licenseVersion: string;
        licenseUrl: string;
        source: string;
        attribution: string;
        alt: string;
      };
  defaultLocale: "fr" | "en";
  tags: string[];
  status: "draft" | "published";
  title: string;
  author: string;
  description: string;
  servings: { quantity: number; unit: string } | null;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  timeLabel: string;
  temperature: string;
  ingredients: Ingredient[];
  sections: RecipeSection[];
  subRecipes: SubRecipe[];
  notes: string[];
};

export type EditableRecipeContent = {
  defaultLocale: "fr" | "en";
  translations: {
    fr: Omit<
      Recipe,
      | "_id"
      | "_creationTime"
      | "slug"
      | "heroImageUrl"
      | "imageCredit"
      | "defaultLocale"
      | "tags"
      | "status"
    >;
    en: Omit<
      Recipe,
      | "_id"
      | "_creationTime"
      | "slug"
      | "heroImageUrl"
      | "imageCredit"
      | "defaultLocale"
      | "tags"
      | "status"
    >;
  };
  tags: string[];
  status: "draft" | "published";
};

export type EditableRecipeSummary = {
  _id: Id<"recipes">;
  _creationTime: number;
  slug: string;
  title: string;
  heroImageUrl: string;
  imageCredit?: Recipe["imageCredit"];
  tags: string[];
  status: "draft" | "published";
  revision: number;
  publishedRevision: number;
  updatedAt: number;
  isPublic: boolean;
  hasPublishedVersion: boolean;
  hasUnpublishedChanges: boolean;
  canDiscard: boolean;
  readiness: RecipeReadiness;
};

export type EditableRecipe = EditableRecipeSummary & EditableRecipeContent;
