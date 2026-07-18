import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { revalidateRecipePaths } from "@/lib/recipe-admin-revalidate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const body = (await request.json()) as { slug?: string };
  const slug = body.slug?.trim();
  if (!slug) return Response.json({ error: "Recette introuvable." }, { status: 400 });

  try {
    await fetchMutation(api.recipes.unpublish, { slug, adminPassword: access.adminPassword });
    revalidateRecipePaths(slug);
    return Response.json({ type: "success", slug });
  } catch {
    return Response.json({ type: "error", message: "Impossible de retirer cette recette du site." }, { status: 500 });
  }
}
