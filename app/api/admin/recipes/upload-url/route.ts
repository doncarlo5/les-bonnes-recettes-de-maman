import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { uploadUrlSuccessSchema } from "@/lib/recipe-admin-contracts";
import { recipeMutationErrorResponse } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function POST() {
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return adminUnauthorizedResponse(adminAccess);
  }

  try {
    const uploadUrl = await fetchMutation(api.recipes.generateUploadUrl, {
      adminPassword: adminAccess.adminPassword,
    });

    return Response.json(
      uploadUrlSuccessSchema.parse({ type: "success", uploadUrl }),
    );
  } catch (error) {
    return recipeMutationErrorResponse(
      error,
      "Impossible de préparer l’import de l’image.",
    );
  }
}
