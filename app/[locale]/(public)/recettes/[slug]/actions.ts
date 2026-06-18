"use server";

import { redirect } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import {
  getRecipeAdminPassword,
  grantRecipeAdminAccess,
  hasRecipeAdminAccess,
  verifyRecipeAdminPassword,
} from "@/lib/recipe-admin-auth";

export type RecipeAdminAccessState = {
  type: "idle" | "error";
  message: string;
};

export { hasRecipeAdminAccess };

export async function requestRecipeAdminAccessAction(
  _previousState: RecipeAdminAccessState,
  formData: FormData,
): Promise<RecipeAdminAccessState> {
  const locale = String(formData.get("locale") ?? "");
  const slug = String(formData.get("slug") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!hasLocale(locale) || !slug) {
    return {
      type: "error",
      message: "Impossible d'ouvrir l'admin pour cette recette.",
    };
  }

  if (!getRecipeAdminPassword()) {
    return {
      type: "error",
      message: "Mot de passe admin non configuré.",
    };
  }

  if (!verifyRecipeAdminPassword(password)) {
    return {
      type: "error",
      message: "Mot de passe invalide.",
    };
  }

  await grantRecipeAdminAccess();

  redirect(`/${locale}/admin/recettes?slug=${encodeURIComponent(slug)}`);
}
