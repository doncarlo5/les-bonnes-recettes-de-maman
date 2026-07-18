import { fetchMutation } from "convex/nextjs";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { editableRecipeDraftSchema } from "@/components/recipes/recipe-form-schema";
import { api } from "@/convex/_generated/api";
import { hasLocale, locales } from "@/i18n/config";
import {
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";

export const dynamic = "force-dynamic";

type SaveRecipeBody = {
  locale?: string;
  mode?: string;
  slug?: string;
  recipePayload?: string;
  expectedRevision?: number;
  force?: boolean;
};

const initialErrorMessage = "Impossible d'enregistrer cette recette.";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SaveRecipeBody;
  const locale = body.locale ?? "";
  const mode = body.mode ?? "";
  const slug = body.slug?.trim() ?? "";
  const payload = body.recipePayload ?? "";

  if (!hasLocale(locale)) {
    return Response.json(
      {
        type: "error",
        message: "Locale invalide.",
      },
      { status: 400 },
    );
  }

  if (mode !== "create" && mode !== "update") {
    return Response.json(
      {
        type: "error",
        message: "Mode d'enregistrement invalide.",
      },
      { status: 400 },
    );
  }

  if (mode === "update" && !slug) {
    return Response.json(
      {
        type: "error",
        message: "Recette introuvable.",
      },
      { status: 400 },
    );
  }

  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return Response.json(
      {
        type: "error",
        message: adminAccess.message,
      },
      { status: adminAccess.status },
    );
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(payload);
  } catch {
    return Response.json(
      {
        type: "error",
        message: "Donnees du formulaire invalides.",
      },
      { status: 400 },
    );
  }

  const validation = editableRecipeDraftSchema.safeParse(parsedPayload);

  if (!validation.success) {
    return Response.json(
      {
        type: "error",
        message: "Corrige les champs indiques avant d'enregistrer.",
        fieldErrors: flattenIssues(validation.error.issues),
      },
      { status: 400 },
    );
  }

  try {
    const result =
      mode === "create"
        ? await fetchMutation(api.recipes.create, {
            recipe: {
              ...validation.data,
              status: "draft",
            },
            adminPassword: adminAccess.adminPassword,
          })
        : await fetchMutation(api.recipes.saveDraft, {
            slug,
            recipe: validation.data,
            expectedRevision: body.expectedRevision ?? 0,
            force: body.force,
            adminPassword: adminAccess.adminPassword,
          });

    revalidateRecipePaths(result.slug);

    return Response.json({
      type: "success",
      message: `Recette enregistree: ${result.title}`,
      slug: result.slug,
      revision: result.revision,
      updatedAt: result.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("RECIPE_NOT_FOUND")) {
      return Response.json(
        {
          type: "error",
          message: "Recette introuvable.",
        },
        { status: 404 },
      );
    }

    if (message.includes("RECIPE_DRAFT_CONFLICT")) {
      const latestRevision = Number(message.split(":").at(-1));
      return Response.json(
        {
          type: "conflict",
          message: "Ce brouillon a ete modifie ailleurs.",
          latestRevision: Number.isFinite(latestRevision)
            ? latestRevision
            : undefined,
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        type: "error",
        message: initialErrorMessage,
      },
      { status: 500 },
    );
  }
}

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
