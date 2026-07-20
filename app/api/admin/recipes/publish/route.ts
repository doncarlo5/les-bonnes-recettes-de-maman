import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { revalidateRecipePaths } from "@/lib/recipe-admin-revalidate";
import {
  recipeMutationErrorResponse,
  validationResponse,
} from "@/lib/recipe-admin-route-errors";
import {
  revisionedRecipeRequestSchema,
  revisionMutationSuccessSchema,
} from "@/lib/recipe-admin-contracts";
import { parseJsonRequest } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);

  const parsed = await parseJsonRequest(request, revisionedRecipeRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { slug, expectedRevision } = parsed.data;

  try {
    const result = await fetchMutation(api.recipes.publishDraft, {
      slug,
      expectedRevision,
      adminPassword: access.adminPassword,
    });
    revalidateRecipePaths(slug);
    return Response.json(
      revisionMutationSuccessSchema.parse({ type: "success", ...result }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("RECIPE_NOT_READY")) {
      return validationResponse(
        {},
        "La recette française n'est pas encore prête à publier.",
      );
    }
    return recipeMutationErrorResponse(
      error,
      "Impossible de publier cette recette.",
    );
  }
}
