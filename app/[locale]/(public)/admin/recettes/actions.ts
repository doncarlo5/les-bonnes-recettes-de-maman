"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { hasLocale, locales } from "@/i18n/config";
import { editableRecipeContentSchema } from "@/components/recipes/recipe-form-schema";

export type SaveRecipeState = {
  type: "idle" | "success" | "error";
  message: string;
  slug?: string;
  fieldErrors?: Record<string, string>;
};

export type AdminAccessState = {
  type: "idle" | "error";
  message: string;
};

const adminAccessCookieName = "recipe-admin-access";
const adminAccessCookieValue = "granted";
const oneYearInSeconds = 60 * 60 * 24 * 365;

const initialErrorMessage = "Impossible d'enregistrer cette recette.";

export async function hasRecipeAdminAccess() {
  const cookieStore = await cookies();
  return cookieStore.get(adminAccessCookieName)?.value === adminAccessCookieValue;
}

export async function requestRecipesAdminAccessAction(
  _previousState: AdminAccessState,
  formData: FormData,
): Promise<AdminAccessState> {
  const locale = String(formData.get("locale") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!hasLocale(locale)) {
    return {
      type: "error",
      message: "Impossible d'ouvrir l'admin recettes.",
    };
  }

  const expectedPassword = process.env.RECIPE_ADMIN_PASSWORD;

  if (!expectedPassword) {
    return {
      type: "error",
      message: "Mot de passe admin non configure.",
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

  redirect(`/${locale}/admin/recettes`);
}

export async function saveRecipeAction(
  _previousState: SaveRecipeState,
  formData: FormData,
): Promise<SaveRecipeState> {
  const locale = String(formData.get("locale") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const slug = String(formData.get("slug") ?? "").trim();
  const payload = String(formData.get("recipePayload") ?? "");

  if (!hasLocale(locale)) {
    return {
      type: "error",
      message: "Locale invalide.",
    };
  }

  if (mode !== "create" && mode !== "update") {
    return {
      type: "error",
      message: "Mode d'enregistrement invalide.",
    };
  }

  if (mode === "update" && !slug) {
    return {
      type: "error",
      message: "Recette introuvable.",
    };
  }

  if (!(await hasRecipeAdminAccess())) {
    return {
      type: "error",
      message: "Acces admin requis.",
    };
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    return {
      type: "error",
      message: "Donnees du formulaire invalides.",
    };
  }

  const validation = editableRecipeContentSchema.safeParse(parsedPayload);

  if (!validation.success) {
    return {
      type: "error",
      message: "Corrige les champs indiques avant d'enregistrer.",
      fieldErrors: flattenIssues(validation.error.issues),
    };
  }

  try {
    const result =
      mode === "create"
        ? await fetchMutation(api.recipes.create, {
            recipe: {
              ...validation.data,
              status: "draft",
            },
          })
        : await fetchMutation(api.recipes.update, {
            slug,
            recipe: validation.data,
          });

    revalidateRecipePaths(result.slug);

    return {
      type: "success",
      message: `Recette enregistree: ${result.title}`,
      slug: result.slug,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("RECIPE_NOT_FOUND")) {
      return {
        type: "error",
        message: "Recette introuvable.",
      };
    }

    return {
      type: "error",
      message: initialErrorMessage,
    };
  }
}

export const updateRecipeAction = saveRecipeAction;

function revalidateRecipePaths(slug: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/recettes`);
    revalidatePath(`/${locale}/recettes/${slug}`);
    revalidatePath(`/${locale}/admin/recettes`);
  }
}

function flattenIssues(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.reduce<Record<string, string>>((accumulator, issue) => {
    const key = issue.path
      .filter((part) => typeof part === "string" || typeof part === "number")
      .join(".");
    if (key && !accumulator[key]) {
      accumulator[key] = issue.message;
    }
    return accumulator;
  }, {});
}
