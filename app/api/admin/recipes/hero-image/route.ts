import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { recipeMutationErrorResponse } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

type HeroImageBody = {
  slug?: string;
  storageId?: string;
  expectedRevision?: number;
};

export async function POST(request: NextRequest) {
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return adminUnauthorizedResponse(adminAccess);
  }

  const body = (await request.json()) as HeroImageBody;
  const slug = body.slug?.trim();
  const storageId = body.storageId?.trim() as Id<"_storage"> | undefined;

  if (!slug || !storageId || !Number.isFinite(body.expectedRevision)) {
    return Response.json(
      { error: "Missing slug or storageId" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchMutation(api.recipes.setHeroImage, {
      slug,
      storageId,
      expectedRevision: body.expectedRevision!,
      adminPassword: adminAccess.adminPassword,
    });
    return Response.json({ ok: true, slug: result.slug, storageId, revision: result.revision, savedAt: result.savedAt });
  } catch (error) {
    return recipeMutationErrorResponse(error, "Impossible d'associer cette image.");
  }
}
