import type { Id } from "@/convex/_generated/dataModel";

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
