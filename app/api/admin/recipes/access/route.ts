import { NextRequest } from "next/server";
import {
  getRecipeAdminPassword,
  grantRecipeAdminAccess,
  verifyRecipeAdminPassword,
} from "@/lib/recipe-admin-auth";
import { adminAccessRequestSchema } from "@/lib/recipe-admin-contracts";
import { parseJsonRequest } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const parsed = await parseJsonRequest(request, adminAccessRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { locale, password } = parsed.data;
  const redirectTo = getSafeAdminRedirect(locale, parsed.data.redirectTo);

  if (!getRecipeAdminPassword()) {
    return Response.json(
      {
        type: "error",
        message: "Mot de passe admin non configure.",
      },
      { status: 500 },
    );
  }

  if (!verifyRecipeAdminPassword(password)) {
    return Response.json(
      {
        type: "error",
        message: "Mot de passe invalide.",
      },
      { status: 401 },
    );
  }

  await grantRecipeAdminAccess();

  return Response.json({
    type: "success",
    message: "Acces admin ouvert.",
    redirectTo,
  });
}

function getSafeAdminRedirect(locale: string, redirectTo?: string) {
  const fallback = `/${locale}/admin/recettes`;
  if (!redirectTo) return fallback;
  try {
    const url = new URL(redirectTo, "https://admin.local");
    if (url.origin !== "https://admin.local" || url.pathname !== fallback) {
      return fallback;
    }
    const allowed = new Set([
      "new",
      "idea",
      "view",
      "newIdea",
      "slug",
      "section",
      "lang",
      "field",
      "mode",
    ]);
    if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
      return fallback;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
