import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { recipeMutationErrorResponse } from "@/lib/recipe-admin-route-errors";
import { revalidateRecipePaths } from "@/lib/recipe-admin-revalidate";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const body = (await request.json()) as {
    slug?: string;
    expectedRevision?: number;
  };
  const slug = body.slug?.trim();
  if (!slug || typeof body.expectedRevision !== "number") {
    return Response.json(
      { type: "error", message: "Requête invalide." },
      { status: 400 },
    );
  }

  try {
    const result = await fetchMutation(api.recipes.deleteRecipe, {
      slug,
      expectedRevision: body.expectedRevision,
      adminPassword: access.adminPassword,
    });
    revalidateRecipePaths(slug);
    return Response.json({ type: "success", ...result });
  } catch (error) {
    return recipeMutationErrorResponse(
      error,
      "Impossible de supprimer cette recette.",
    );
  }
}
