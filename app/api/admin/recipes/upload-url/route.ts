import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return adminUnauthorizedResponse(adminAccess);
  }

  const uploadUrl = await fetchMutation(api.recipes.generateUploadUrl, {
    adminPassword: adminAccess.adminPassword,
  });

  return Response.json({ uploadUrl });
}
