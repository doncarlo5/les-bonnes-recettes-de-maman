import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { revalidateRecipePaths } from "@/lib/recipe-admin-revalidate";
import { recipeMutationErrorResponse } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);

  const body = (await request.json()) as {
    slug?: string;
    expectedRevision?: number;
  };
  const slug = body.slug?.trim();
  if (!slug || typeof body.expectedRevision !== "number") {
    return Response.json({ error: "Requete de publication invalide." }, { status: 400 });
  }

  try {
    const result = await fetchMutation(api.recipes.publishDraft, {
      slug,
      expectedRevision: body.expectedRevision,
      adminPassword: access.adminPassword,
    });
    revalidateRecipePaths(slug);
    return Response.json({ type: "success", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("RECIPE_NOT_READY")) {
      return Response.json({ type: "error", message: "La recette francaise n'est pas encore prete a publier." }, { status: 400 });
    }
    return recipeMutationErrorResponse(error, "Impossible de publier cette recette.");
  }
}
