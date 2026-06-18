import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";

export const dynamic = "force-dynamic";

type OpenverseImportBody = {
  slug?: string;
  imageUrl?: string;
  title?: string;
  creator?: string;
  creatorUrl?: string;
  landingUrl?: string;
  license?: string;
  licenseVersion?: string;
  licenseUrl?: string;
  source?: string;
  attribution?: string;
  alt?: string;
};

export async function POST(request: NextRequest) {
  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return adminUnauthorizedResponse(adminAccess);
  }

  try {
    const body = (await request.json()) as OpenverseImportBody;
    const slug = body.slug?.trim();
    const imageUrl = body.imageUrl?.trim();

    if (!slug || !imageUrl) {
      return Response.json(
        { error: "Missing slug or imageUrl" },
        { status: 400 },
      );
    }

    let url: URL;

    try {
      url = new URL(imageUrl);
    } catch {
      return Response.json({ error: "Invalid imageUrl" }, { status: 400 });
    }

    if (url.protocol !== "https:") {
      return Response.json({ error: "Invalid imageUrl" }, { status: 400 });
    }

    const imageResponse = await fetch(url, { cache: "no-store" });

    if (!imageResponse.ok) {
      return Response.json(
        { error: "Openverse image download failed" },
        { status: imageResponse.status },
      );
    }

    const contentType =
      imageResponse.headers.get("content-type") ?? "application/octet-stream";

    if (!contentType.startsWith("image/")) {
      return Response.json(
        { error: "Openverse URL did not return an image" },
        { status: 400 },
      );
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
      return Response.json(
        { error: "Convex Storage upload failed" },
        { status: uploadResponse.status },
      );
    }

    const { storageId } = (await uploadResponse.json()) as {
      storageId: Id<"_storage">;
    };

    const result = await fetchMutation(api.recipes.setOpenverseHeroImage, {
      slug,
      storageId,
      adminPassword: adminAccess.adminPassword,
      imageCredit: {
        title: body.title ?? "Image Openverse",
        creator: body.creator ?? "Createur inconnu",
        creatorUrl: body.creatorUrl ?? body.landingUrl ?? imageUrl,
        imageUrl,
        landingUrl: body.landingUrl ?? imageUrl,
        license: body.license ?? "",
        licenseVersion: body.licenseVersion ?? "",
        licenseUrl: body.licenseUrl ?? body.landingUrl ?? imageUrl,
        source: body.source ?? "openverse",
        attribution: body.attribution ?? "",
        alt: body.alt ?? body.title ?? "",
      },
    });

    return Response.json({
      ok: true,
      slug: result.slug,
      storageId,
    });
  } catch (error) {
    console.error("Openverse import failed", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Openverse import failed",
      },
      { status: 500 },
    );
  }
}
