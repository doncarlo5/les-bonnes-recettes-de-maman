import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { recipeMutationErrorResponse } from "@/lib/recipe-admin-route-errors";
import { revalidateRecipePaths } from "@/lib/recipe-admin-revalidate";
import {
  revisionedRecipeRequestSchema,
  slugMutationSuccessSchema,
} from "@/lib/recipe-admin-contracts";
import { parseJsonRequest } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const parsed = await parseJsonRequest(request, revisionedRecipeRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { slug, expectedRevision } = parsed.data;

  try {
    const result = await fetchMutation(api.recipes.deleteRecipe, {
      slug,
      expectedRevision,
      adminPassword: access.adminPassword,
    });
    revalidateRecipePaths(slug);
    return Response.json(
      slugMutationSuccessSchema.parse({ type: "success", ...result }),
    );
  } catch (error) {
    return recipeMutationErrorResponse(
      error,
      "Impossible de supprimer cette recette.",
    );
  }
}
