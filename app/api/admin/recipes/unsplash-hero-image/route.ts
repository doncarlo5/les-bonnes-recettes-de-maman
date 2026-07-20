import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { recipeMutationErrorResponse } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

type UnsplashHeroImageBody = {
  slug?: string;
  imageUrl?: string;
  alt?: string;
  photographerName?: string;
  photographerUrl?: string;
  photoUrl?: string;
  expectedRevision?: number;
};

export async function POST(request: NextRequest) {
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return adminUnauthorizedResponse(adminAccess);
  }

  const body = (await request.json()) as UnsplashHeroImageBody;
  const slug = body.slug?.trim();
  const imageUrl = body.imageUrl?.trim();
  const photographerName = body.photographerName?.trim();
  const photographerUrl = body.photographerUrl?.trim();
  const photoUrl = body.photoUrl?.trim();

  if (!slug || !imageUrl || !photographerName || !photographerUrl || !photoUrl || !Number.isFinite(body.expectedRevision)) {
    return Response.json(
      { error: "Missing Unsplash image payload" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchMutation(api.recipes.setUnsplashHeroImage, {
      slug,
      imageUrl,
      alt: body.alt ?? "",
      photographerName,
      photographerUrl,
      photoUrl,
      expectedRevision: body.expectedRevision!,
      adminPassword: adminAccess.adminPassword,
    });

    return Response.json({ type: "success", slug: result.slug, heroImageUrl: result.heroImageUrl, revision: result.revision, savedAt: result.savedAt });
  } catch (error) {
    return recipeMutationErrorResponse(error, "Impossible d'associer cette image Unsplash.");
  }
}
