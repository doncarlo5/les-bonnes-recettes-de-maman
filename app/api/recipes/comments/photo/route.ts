import "server-only";

import sharp from "sharp";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  RECIPE_COMMENT_MAX_PHOTO_BYTES,
  RECIPE_COMMENT_MAX_PHOTO_DIMENSION,
  RECIPE_COMMENT_MAX_PHOTO_PIXELS,
  RECIPE_COMMENT_PHOTO_FORMATS,
} from "@/lib/recipe-comment-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedFormats = new Set<string>(RECIPE_COMMENT_PHOTO_FORMATS);

export async function POST(request: Request) {
  const adminPassword = process.env.RECIPE_ADMIN_PASSWORD;
  if (!adminPassword) {
    return Response.json({ error: "COMMENT_PHOTO_UPLOAD_UNAVAILABLE" }, { status: 503 });
  }
  let storageId: Id<"_storage"> | undefined;
  let participantKey: string | undefined;
  let verificationStarted = false;
  const leaseId = crypto.randomUUID();
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.storageId !== "string" || typeof body.participantKey !== "string") {
      return Response.json({ error: "COMMENT_PHOTO_INVALID" }, { status: 400 });
    }
    storageId = body.storageId.trim() as Id<"_storage">;
    participantKey = body.participantKey.trim();
    if (!storageId || !participantKey) {
      return Response.json({ error: "COMMENT_PHOTO_INVALID" }, { status: 400 });
    }
    const { url } = await fetchMutation(api.comments.beginPhotoVerification, { storageId, participantKey, leaseId });
    verificationStarted = true;
    const photoResponse = await fetch(url, { cache: "no-store" });
    if (!photoResponse.ok) throw new Error("COMMENT_PHOTO_NOT_FOUND");
    const source = Buffer.from(await photoResponse.arrayBuffer());
    if (source.byteLength > RECIPE_COMMENT_MAX_PHOTO_BYTES) throw new Error("COMMENT_PHOTO_INVALID");
    const image = sharp(source, { failOn: "error", limitInputPixels: RECIPE_COMMENT_MAX_PHOTO_PIXELS });
    const metadata = await image.metadata();
    if (
      !metadata.format
      || !allowedFormats.has(metadata.format)
      || !metadata.width
      || !metadata.height
      || metadata.width > RECIPE_COMMENT_MAX_PHOTO_DIMENSION
      || metadata.height > RECIPE_COMMENT_MAX_PHOTO_DIMENSION
      || metadata.width * metadata.height > RECIPE_COMMENT_MAX_PHOTO_PIXELS
    ) {
      throw new Error("COMMENT_PHOTO_INVALID");
    }
    await image.raw().toBuffer();
    await fetchMutation(api.comments.markPhotoVerified, { storageId, participantKey, leaseId, adminPassword });
    return Response.json({ storageId });
  } catch {
    if (verificationStarted && storageId && participantKey) {
      await fetchMutation(api.comments.discardPhotoVerification, { storageId, participantKey, leaseId, adminPassword }).catch(() => undefined);
    }
    return Response.json({ error: "COMMENT_PHOTO_INVALID" }, { status: 400 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
