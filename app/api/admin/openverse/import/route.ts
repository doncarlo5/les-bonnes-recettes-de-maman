import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import {
  openverseImportRequestSchema,
  storageImportSuccessSchema,
  storageUploadResponseSchema,
} from "@/lib/recipe-admin-contracts";
import {
  errorResponse,
  parseJsonRequest,
  recipeMutationErrorResponse,
  validationResponse,
} from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return adminUnauthorizedResponse(adminAccess);
  }

  try {
    const parsed = await parseJsonRequest(
      request,
      openverseImportRequestSchema,
    );
    if (!parsed.ok) return parsed.response;
    const { imageUrl } = parsed.data;

    let url: URL;

    try {
      url = new URL(imageUrl);
    } catch {
      return validationResponse({
        imageUrl: "Adresse d’image Openverse invalide.",
      });
    }

    if (url.protocol !== "https:") {
      return validationResponse({
        imageUrl: "L’image Openverse doit utiliser HTTPS.",
      });
    }

    const imageResponse = await fetch(url, { cache: "no-store" });

    if (!imageResponse.ok) {
      return errorResponse("Impossible de télécharger l’image Openverse.", 502);
    }

    const contentType =
      imageResponse.headers.get("content-type") ?? "application/octet-stream";

    if (!contentType.startsWith("image/")) {
      return validationResponse({
        imageUrl: "Le lien ne pointe pas vers une image.",
      });
    }

    const uploadUrl = await fetchMutation(api.recipes.generateUploadUrl, {
      adminPassword: adminAccess.adminPassword,
    });
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body: await imageResponse.blob(),
    });

    if (!uploadResponse.ok) {
      return errorResponse(
        "Impossible d’importer l’image dans le stockage.",
        502,
      );
    }

    const uploadResult = storageUploadResponseSchema.safeParse(
      await uploadResponse.json(),
    );
    if (!uploadResult.success) {
      return errorResponse("Le stockage a renvoyé une réponse invalide.", 502);
    }
    const storageId = uploadResult.data.storageId as Id<"_storage">;

    return Response.json(
      storageImportSuccessSchema.parse({
        type: "success",
        storageId,
      }),
    );
  } catch (error) {
    console.error("Openverse import failed", error);
    return recipeMutationErrorResponse(error, "Openverse import failed");
  }
}
