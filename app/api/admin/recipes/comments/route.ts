import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim();
  const cursor = url.searchParams.get("cursor") || null;
  if (!slug) return Response.json({ error: "Recette introuvable." }, { status: 400 });
  const result = await fetchQuery(api.comments.listForModeration, {
    slug,
    adminPassword: access.adminPassword,
    paginationOpts: { numItems: 10, cursor },
  });
  return Response.json(result);
}

export async function DELETE(request: Request) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const body = (await request.json()) as { commentId?: string };
  const commentId = body.commentId?.trim() as Id<"recipeComments"> | undefined;
  if (!commentId) return Response.json({ error: "Commentaire introuvable." }, { status: 400 });
  await fetchMutation(api.comments.removeAsAdmin, {
    commentId,
    adminPassword: access.adminPassword,
  });
  return Response.json({ type: "success", commentId });
}
