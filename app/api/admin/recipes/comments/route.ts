import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { getConvexSiteUrl } from "@/lib/convex-site-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim();
  const cursor = url.searchParams.get("cursor") || null;
  if (!slug) return Response.json({ error: "Recette introuvable." }, { status: 400 });
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) return Response.json({ error: "Service de commentaires indisponible." }, { status: 503 });
  const params = new URLSearchParams({ slug });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`${convexSiteUrl}/internal/admin/recipe-comments?${params}`, {
    headers: { Authorization: `Bearer ${access.adminPassword}` },
    cache: "no-store",
  });
  return proxyJson(response);
}

export async function DELETE(request: Request) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const body: unknown = await request.json().catch(() => null);
  const commentId = isRecord(body) && typeof body.commentId === "string"
    ? body.commentId.trim()
    : "";
  if (!commentId) return Response.json({ error: "Commentaire introuvable." }, { status: 400 });
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) return Response.json({ error: "Service de commentaires indisponible." }, { status: 503 });
  const response = await fetch(`${convexSiteUrl}/internal/admin/recipe-comments`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${access.adminPassword}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ commentId }),
    cache: "no-store",
  });
  return proxyJson(response);
}

async function proxyJson(response: Response) {
  const body = await response.json().catch(() => ({ error: "Service de commentaires indisponible." }));
  return Response.json(body, { status: response.status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
