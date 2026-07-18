import { fetchMutation } from "convex/nextjs";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import { locales } from "@/i18n/config";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";

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
    revalidateRecipe(slug);
    return Response.json({ type: "success", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("RECIPE_DRAFT_CONFLICT")) {
      return Response.json({ type: "conflict", message: "Le brouillon a change ailleurs." }, { status: 409 });
    }
    if (message.includes("RECIPE_NOT_READY")) {
      return Response.json({ type: "error", message: "La recette francaise n'est pas encore prete a publier." }, { status: 400 });
    }
    return Response.json({ type: "error", message: "Impossible de publier cette recette." }, { status: 500 });
  }
}

function revalidateRecipe(slug: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/recettes`);
    revalidatePath(`/${locale}/recettes/${slug}`);
    revalidatePath(`/${locale}/admin/recettes`);
  }
}
