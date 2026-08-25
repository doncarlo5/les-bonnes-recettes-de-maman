import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import {
  parseJsonRequest,
  recipeMutationErrorResponse,
} from "@/lib/recipe-admin-route-errors";
import {
  recipeVisibilityRequestSchema,
  visibilityMutationSuccessSchema,
} from "@/lib/recipe-admin-contracts";
import { revalidateRecipePaths } from "@/lib/recipe-admin-revalidate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const parsed = await parseJsonRequest(request, recipeVisibilityRequestSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await fetchMutation(api.recipes.setVisibility, {
      ...parsed.data,
      adminPassword: access.adminPassword,
    });
    revalidateRecipePaths(parsed.data.slug);
    return Response.json(
      visibilityMutationSuccessSchema.parse({ type: "success", ...result }),
    );
  } catch (error) {
    return recipeMutationErrorResponse(
      error,
      "Impossible de modifier la visibilité de cette recette.",
    );
  }
}
