import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";

export const dynamic = "force-dynamic";

type HeroImageBody = {
  slug?: string;
  storageId?: string;
};

export async function POST(request: NextRequest) {
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return adminUnauthorizedResponse(adminAccess);
  }

  const body = (await request.json()) as HeroImageBody;
  const slug = body.slug?.trim();
  const storageId = body.storageId?.trim() as Id<"_storage"> | undefined;

  if (!slug || !storageId) {
    return Response.json(
      { error: "Missing slug or storageId" },
      { status: 400 },
    );
  }

  const result = await fetchMutation(api.recipes.setHeroImage, {
    slug,
    storageId,
    adminPassword: adminAccess.adminPassword,
  });

  return Response.json({ ok: true, slug: result.slug, storageId });
}
