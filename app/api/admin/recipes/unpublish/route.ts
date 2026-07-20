import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { revalidateRecipePaths } from "@/lib/recipe-admin-revalidate";
import {
  slugMutationSuccessSchema,
  unpublishRecipeRequestSchema,
} from "@/lib/recipe-admin-contracts";
import {
  parseJsonRequest,
  recipeMutationErrorResponse,
} from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const parsed = await parseJsonRequest(request, unpublishRecipeRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { slug } = parsed.data;

  try {
    await fetchMutation(api.recipes.unpublish, {
      slug,
      adminPassword: access.adminPassword,
    });
    revalidateRecipePaths(slug);
    return Response.json(
      slugMutationSuccessSchema.parse({ type: "success", slug }),
    );
  } catch (error) {
    return recipeMutationErrorResponse(
      error,
      "Impossible de retirer cette recette du site.",
    );
  }
}
