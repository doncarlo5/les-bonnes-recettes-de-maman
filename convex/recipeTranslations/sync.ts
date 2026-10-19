import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import {
  applyRecipeTranslation,
  storedTranslationKey,
  translatedLocales,
  type RecipeTranslationFile,
} from "../recipeLocales";
import { recipeTranslationFiles } from "./index";

// Publishes the Brazilian Portuguese and Belgian Dutch recipe translations.
// Every file is validated against the published French recipe first; any
// mismatch aborts the whole run so production never mixes stale structures.
export const apply = internalMutation({
  args: { slug: v.optional(v.string()) },
  handler: async (ctx, { slug }) => {
    const files: RecipeTranslationFile[] = slug
      ? [recipeTranslationFiles[slug]].filter(Boolean)
      : Object.values(recipeTranslationFiles);
    if (slug && files.length === 0) throw new Error(`No translation file for ${slug}`);

    const errors: string[] = [];
    const skipped: string[] = [];
    const patches = [];
    for (const file of files) {
      const recipe = await ctx.db
        .query("recipes")
        .withIndex("by_slug", (q) => q.eq("slug", file.slug))
        .unique();
      if (!recipe || recipe.status !== "published") {
        skipped.push(file.slug);
        continue;
      }
      try {
        const extraTranslations = Object.fromEntries(
          translatedLocales.map((locale) => [
            storedTranslationKey[locale],
            applyRecipeTranslation(
              recipe.translations.fr,
              file.translations[locale],
              `${file.slug}.${locale}`,
            ),
          ]),
        );
        if (JSON.stringify(recipe.extraTranslations) !== JSON.stringify(extraTranslations)) {
          patches.push({ id: recipe._id, extraTranslations });
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (errors.length) throw new Error(`Translations not applied:\n${errors.join("\n")}`);

    for (const patch of patches) {
      await ctx.db.patch(patch.id, { extraTranslations: patch.extraTranslations });
    }
    return { updated: patches.length, unchanged: files.length - patches.length - skipped.length, skipped };
  },
});
