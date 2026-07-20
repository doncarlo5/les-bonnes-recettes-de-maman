import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import {
  imageMutationSuccessSchema,
  openverseImageRequestSchema,
} from "@/lib/recipe-admin-contracts";
import {
  parseJsonRequest,
  recipeMutationErrorResponse,
} from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const parsed = await parseJsonRequest(request, openverseImageRequestSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const result = await fetchMutation(api.recipes.setOpenverseHeroImage, {
      ...parsed.data,
      storageId: parsed.data.storageId as Id<"_storage">,
      adminPassword: access.adminPassword,
    });
    return Response.json(
      imageMutationSuccessSchema.parse({ type: "success", ...result }),
    );
  } catch (error) {
    return recipeMutationErrorResponse(
      error,
      "Impossible d’associer cette image Openverse.",
    );
  }
}
