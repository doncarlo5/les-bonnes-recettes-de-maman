import "server-only";

import type { RecipeIdea } from "@/components/recipes/types";
import type { Locale } from "@/i18n/config";
import { getConvexSiteUrl } from "@/lib/convex-site-url";

export type AdminRecipeIdeaPage = {
  page: RecipeIdea[];
  isDone: boolean;
  continueCursor: string;
};

export async function listAdminRecipeIdeas(
  adminPassword: string,
  state: "outstanding" | "completed",
  locale: Locale,
  cursor: string | null,
) {
  const params = new URLSearchParams({ state, locale });
  if (cursor) params.set("cursor", cursor);
  return adminRecipeIdeaRequest<AdminRecipeIdeaPage>(
    `/internal/admin/recipe-ideas?${params}`,
    adminPassword,
  );
}

export async function getAdminRecipeIdea(
  adminPassword: string,
  ideaId: string,
  locale: Locale,
) {
  const params = new URLSearchParams({ ideaId, locale });
  return adminRecipeIdeaRequest<RecipeIdea | null>(
    `/internal/admin/recipe-ideas/item?${params}`,
    adminPassword,
  );
}

export async function getAdminRecipeIdeaCount(adminPassword: string) {
  const result = await adminRecipeIdeaRequest<{ count: number }>(
    "/internal/admin/recipe-ideas/count",
    adminPassword,
  );
  return result.count;
}

export function createAdminRecipeIdea(
  adminPassword: string,
  input: { authorName?: string; text: string },
) {
  return adminRecipeIdeaRequest<{ ideaId: string }>(
    "/internal/admin/recipe-ideas",
    adminPassword,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function removeAdminRecipeIdea(adminPassword: string, ideaId: string) {
  return adminRecipeIdeaRequest<{ ideaId: string }>(
    "/internal/admin/recipe-ideas",
    adminPassword,
    { method: "DELETE", body: JSON.stringify({ ideaId }) },
  );
}

async function adminRecipeIdeaRequest<T>(
  path: string,
  adminPassword: string,
  init: RequestInit = {},
) {
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) throw new Error("CONVEX_SITE_URL_MISSING");
  const response = await fetch(`${convexSiteUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${adminPassword}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`RECIPE_IDEA_ADMIN_REQUEST_FAILED:${response.status}`);
  return body as T;
}
