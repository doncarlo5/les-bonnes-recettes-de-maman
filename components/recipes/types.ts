import type { Doc } from "@/convex/_generated/dataModel";

export type Recipe = Doc<"recipes">;

export type Ingredient = Recipe["ingredients"][number];
