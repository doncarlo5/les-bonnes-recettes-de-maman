import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { recipeMutationErrorResponse } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const body = (await request.json()) as { slug?: string; expectedRevision?: number };
  const slug = body.slug?.trim();
  if (!slug || typeof body.expectedRevision !== "number") {
    return Response.json({ error: "Requete invalide." }, { status: 400 });
  }

  try {
    const result = await fetchMutation(api.recipes.discardDraft, {
      slug,
      expectedRevision: body.expectedRevision,
      adminPassword: access.adminPassword,
    });
    return Response.json({ type: "success", ...result });
  } catch (error) {
    return recipeMutationErrorResponse(error, "Impossible d'abandonner ces modifications.");
  }
}
