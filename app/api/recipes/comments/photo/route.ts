import "server-only";

import sharp from "sharp";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedFormats = new Set(["jpeg", "png", "webp"]);
const maxPhotoBytes = 8 * 1024 * 1024;
const maxPhotoDimension = 8192;
const maxPhotoPixels = 40_000_000;

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
    const body = await request.json() as { storageId?: string; participantKey?: string };
    storageId = body.storageId?.trim() as Id<"_storage"> | undefined;
    participantKey = body.participantKey?.trim();
    if (!storageId || !participantKey) {
      return Response.json({ error: "COMMENT_PHOTO_INVALID" }, { status: 400 });
    }
    const { url } = await fetchMutation(api.comments.beginPhotoVerification, { storageId, participantKey, leaseId });
    verificationStarted = true;
    const photoResponse = await fetch(url, { cache: "no-store" });
    if (!photoResponse.ok) throw new Error("COMMENT_PHOTO_NOT_FOUND");
    const source = Buffer.from(await photoResponse.arrayBuffer());
    if (source.byteLength > maxPhotoBytes) throw new Error("COMMENT_PHOTO_INVALID");
    const image = sharp(source, { failOn: "error", limitInputPixels: maxPhotoPixels });
    const metadata = await image.metadata();
    if (
      !metadata.format
      || !allowedFormats.has(metadata.format)
      || !metadata.width
      || !metadata.height
      || metadata.width > maxPhotoDimension
      || metadata.height > maxPhotoDimension
      || metadata.width * metadata.height > maxPhotoPixels
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
