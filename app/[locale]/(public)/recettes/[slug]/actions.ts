"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "@/i18n/config";

export type RecipeAdminAccessState = {
  type: "idle" | "error";
  message: string;
};

const adminAccessCookieName = "recipe-admin-access";
const adminAccessCookieValue = "granted";
const oneYearInSeconds = 60 * 60 * 24 * 365;

export async function hasRecipeAdminAccess() {
  const cookieStore = await cookies();
  return cookieStore.get(adminAccessCookieName)?.value === adminAccessCookieValue;
}

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

  const expectedPassword = process.env.RECIPE_ADMIN_PASSWORD;

  if (!expectedPassword) {
    return {
      type: "error",
      message: "Mot de passe admin non configuré.",
    };
  }

  if (password !== expectedPassword) {
    return {
      type: "error",
      message: "Mot de passe invalide.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: adminAccessCookieName,
    value: adminAccessCookieValue,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: oneYearInSeconds,
    secure: process.env.NODE_ENV === "production",
  });

  redirect(`/${locale}/admin/recettes?slug=${encodeURIComponent(slug)}`);
}
