import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";

export const dynamic = "force-dynamic";

type UnsplashHeroImageBody = {
  slug?: string;
  imageUrl?: string;
  alt?: string;
  photographerName?: string;
  photographerUrl?: string;
  photoUrl?: string;
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

  if (!slug || !imageUrl || !photographerName || !photographerUrl || !photoUrl) {
    return Response.json(
      { error: "Missing Unsplash image payload" },
      { status: 400 },
    );
  }

  const result = await fetchMutation(api.recipes.setUnsplashHeroImage, {
    slug,
    imageUrl,
    alt: body.alt ?? "",
    photographerName,
    photographerUrl,
    photoUrl,
    adminPassword: adminAccess.adminPassword,
  });

  return Response.json({
    ok: true,
    slug: result.slug,
    heroImageUrl: result.heroImageUrl,
  });
}
