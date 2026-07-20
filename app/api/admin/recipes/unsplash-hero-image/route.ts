import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { recipeMutationErrorResponse } from "@/lib/recipe-admin-route-errors";
import {
  imageMutationSuccessSchema,
  unsplashImageRequestSchema,
} from "@/lib/recipe-admin-contracts";
import { parseJsonRequest } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return adminUnauthorizedResponse(adminAccess);
  }

  const parsed = await parseJsonRequest(request, unsplashImageRequestSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const result = await fetchMutation(api.recipes.setUnsplashHeroImage, {
      ...body,
      adminPassword: adminAccess.adminPassword,
    });

    return Response.json(
      imageMutationSuccessSchema.parse({ type: "success", ...result }),
    );
  } catch (error) {
    return recipeMutationErrorResponse(
      error,
      "Impossible d'associer cette image Unsplash.",
    );
  }
}
