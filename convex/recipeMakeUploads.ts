"use node";

import { v } from "convex/values";
import decodeHeic from "heic-decode";
import sharp from "sharp";
import {
  RECIPE_MAKE_FULL_SIZE,
  RECIPE_MAKE_MAX_DIMENSION,
  RECIPE_MAKE_MAX_PIXELS,
  RECIPE_MAKE_MAX_PHOTO_BYTES,
  RECIPE_MAKE_PHOTO_MIME_TYPES,
  RECIPE_MAKE_THUMBNAIL_HEIGHT,
  RECIPE_MAKE_THUMBNAIL_WIDTH,
} from "../lib/recipe-makes-policy";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const allowedMimeTypes = new Set<string>(RECIPE_MAKE_PHOTO_MIME_TYPES);

export const process = internalAction({
  args: {
    slug: v.string(),
    participantDigest: v.string(),
    ticketDigest: v.string(),
    sourceStorageId: v.id("_storage"),
    mimeType: v.string(),
    authorName: v.optional(v.string()),
    caption: v.optional(v.string()),
    altText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let fullPhotoStorageId;
    let thumbnailStorageId;

    try {
      if (!allowedMimeTypes.has(args.mimeType)) {
        throw new Error("RECIPE_MAKE_MIME_INVALID");
      }

      const sourceBlob = await ctx.storage.get(args.sourceStorageId);
      if (!sourceBlob || sourceBlob.size > RECIPE_MAKE_MAX_PHOTO_BYTES) {
        throw new Error("RECIPE_MAKE_INVALID_UPLOAD");
      }

      const bytes = new Uint8Array(await sourceBlob.arrayBuffer());
      const source = await decodeImage(bytes, args.mimeType);
      const [fullBuffer, thumbnailBuffer] = await Promise.all([
        makeFullPhoto(source),
        makeThumbnail(source),
      ]);

      [fullPhotoStorageId, thumbnailStorageId] = await Promise.all([
        ctx.storage.store(new Blob([fullBuffer], { type: "image/webp" })),
        ctx.storage.store(new Blob([thumbnailBuffer], { type: "image/webp" })),
      ]);

      await ctx.runMutation(internal.recipeMakes.finalizeUpload, {
        slug: args.slug,
        participantDigest: args.participantDigest,
        ticketDigest: args.ticketDigest,
        fullPhotoStorageId,
        thumbnailStorageId,
        authorName: args.authorName,
        caption: args.caption,
        altText: args.altText,
      });
    } catch (error) {
      await Promise.all([
        fullPhotoStorageId
          ? ctx.storage.delete(fullPhotoStorageId)
          : Promise.resolve(),
        thumbnailStorageId
          ? ctx.storage.delete(thumbnailStorageId)
          : Promise.resolve(),
      ]);
      throw error;
    } finally {
      await ctx.storage.delete(args.sourceStorageId).catch(() => undefined);
    }
  },
});

async function decodeImage(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    const decoded = await decodeHeic({ buffer: Buffer.from(bytes) });
    assertValidDimensions(decoded.width, decoded.height);
    return sharp(Buffer.from(decoded.data), {
      raw: {
        width: decoded.width,
        height: decoded.height,
        channels: 4,
      },
      failOn: "error",
      limitInputPixels: RECIPE_MAKE_MAX_PIXELS,
    });
  }

  const image = sharp(bytes, {
    failOn: "error",
    limitInputPixels: RECIPE_MAKE_MAX_PIXELS,
  });
  const metadata = await image.metadata();
  assertValidDimensions(metadata.width, metadata.height);
  return image;
}

function assertValidDimensions(width?: number, height?: number) {
  if (
    !width ||
    !height ||
    width > RECIPE_MAKE_MAX_DIMENSION ||
    height > RECIPE_MAKE_MAX_DIMENSION ||
    width * height > RECIPE_MAKE_MAX_PIXELS
  ) {
    throw new Error("RECIPE_MAKE_DIMENSIONS_INVALID");
  }
}

function makeFullPhoto(source: ReturnType<typeof sharp>) {
  return source
    .clone()
    .rotate()
    .resize({
      width: RECIPE_MAKE_FULL_SIZE,
      height: RECIPE_MAKE_FULL_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toColorspace("srgb")
    .webp({ quality: 82 })
    .toBuffer();
}

function makeThumbnail(source: ReturnType<typeof sharp>) {
  return source
    .clone()
    .rotate()
    .resize({
      width: RECIPE_MAKE_THUMBNAIL_WIDTH,
      height: RECIPE_MAKE_THUMBNAIL_HEIGHT,
      fit: "cover",
      position: "attention",
      withoutEnlargement: true,
    })
    .toColorspace("srgb")
    .webp({ quality: 80 })
    .toBuffer();
}
