"use server";

import { revalidatePath } from "next/cache";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { hasLocale, type Locale } from "@/i18n/config";
import type { EditableRecipeContent } from "@/components/recipes/types";

export type UpdateRecipeState = {
  type: "idle" | "success" | "error";
  message: string;
};

const initialErrorMessage = "Impossible d'enregistrer cette recette.";

export async function updateRecipeAction(
  _previousState: UpdateRecipeState,
  formData: FormData,
): Promise<UpdateRecipeState> {
  const locale = String(formData.get("locale") ?? "");
  const slug = String(formData.get("slug") ?? "").trim();
  const adminPassword = String(formData.get("adminPassword") ?? "");
  const recipeJson = String(formData.get("recipeJson") ?? "");

  if (!hasLocale(locale)) {
    return {
      type: "error",
      message: "Locale invalide.",
    };
  }

  if (!slug) {
    return {
      type: "error",
      message: "Recette introuvable.",
    };
  }

  if (!adminPassword) {
    return {
      type: "error",
      message: "Ajoute le mot de passe admin.",
    };
  }

  let recipe: EditableRecipeContent;

  try {
    recipe = JSON.parse(recipeJson) as EditableRecipeContent;
  } catch {
    return {
      type: "error",
      message: "JSON invalide.",
    };
  }

  try {
    const result = await fetchMutation(api.recipes.updateWithPassword, {
      slug,
      adminPassword,
      recipe,
    });

    revalidateRecipePaths(locale, result.slug);

    return {
      type: "success",
      message: `Recette enregistrée: ${result.title}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("INVALID_ADMIN_PASSWORD")) {
      return {
        type: "error",
        message: "Mot de passe invalide.",
      };
    }

    if (message.includes("RECIPE_NOT_FOUND")) {
      return {
        type: "error",
        message: "Recette introuvable.",
      };
    }

    if (message.includes("ADMIN_PASSWORD_NOT_CONFIGURED")) {
      return {
        type: "error",
        message: "Mot de passe admin non configure dans Convex.",
      };
    }

    return {
      type: "error",
      message: initialErrorMessage,
    };
  }
}

function revalidateRecipePaths(locale: Locale, slug: string) {
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/recettes/${slug}`);
  revalidatePath(`/${locale}/admin/recettes`);
}
