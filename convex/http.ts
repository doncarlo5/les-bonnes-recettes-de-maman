import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  RECIPE_COMMENT_MAX_PHOTO_BYTES,
  RECIPE_COMMENT_MAX_PHOTO_DIMENSION,
  RECIPE_COMMENT_MAX_PHOTO_PIXELS,
  RECIPE_COMMENT_PHOTO_MIME_TYPES,
} from "../lib/recipe-comment-policy";

declare const process: { env: { RECIPE_ADMIN_PASSWORD?: string } };

const http = httpRouter();
const allowedPhotoTypes = new Set<string>(RECIPE_COMMENT_PHOTO_MIME_TYPES);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

http.route({
  path: "/comment-photo-upload",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
});

http.route({
  path: "/internal/admin/recipe-comments",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!hasAdminAuthorization(request)) return adminJson({ error: "RECIPE_ADMIN_REQUIRED" }, 401);
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug")?.trim();
    const cursor = url.searchParams.get("cursor") || null;
    if (!slug) return adminJson({ error: "RECIPE_NOT_FOUND" }, 400);
    const result = await ctx.runQuery(internal.commentAdmin.list, {
      slug,
      paginationOpts: { numItems: 10, cursor },
    });
    return adminJson(result, 200);
  }),
});

http.route({
  path: "/internal/admin/recipe-ideas",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!hasAdminAuthorization(request)) return adminJson({ error: "RECIPE_ADMIN_REQUIRED" }, 401);
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const locale = url.searchParams.get("locale");
    const cursor = url.searchParams.get("cursor") || null;
    if (state !== "outstanding" && state !== "completed") {
      return adminJson({ error: "RECIPE_IDEA_STATE_INVALID" }, 400);
    }
    if (locale !== "fr" && locale !== "en") {
      return adminJson({ error: "RECIPE_IDEA_LOCALE_INVALID" }, 400);
    }
    try {
      const result = await ctx.runQuery(internal.recipeIdeaAdmin.list, {
        state,
        locale,
        paginationOpts: { numItems: 20, cursor },
      });
      return adminJson(result, 200);
    } catch {
      return adminJson({ error: "RECIPE_IDEA_LIST_FAILED" }, 400);
    }
  }),
});

http.route({
  path: "/internal/admin/recipe-ideas/item",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!hasAdminAuthorization(request)) return adminJson({ error: "RECIPE_ADMIN_REQUIRED" }, 401);
    const url = new URL(request.url);
    const ideaId = url.searchParams.get("ideaId")?.trim();
    const locale = url.searchParams.get("locale");
    if (!ideaId || (locale !== "fr" && locale !== "en")) {
      return adminJson({ error: "RECIPE_IDEA_NOT_FOUND" }, 400);
    }
    const idea = await ctx.runQuery(internal.recipeIdeaAdmin.get, { ideaId, locale });
    return adminJson(idea, 200);
  }),
});

http.route({
  path: "/internal/admin/recipe-ideas/count",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!hasAdminAuthorization(request)) return adminJson({ error: "RECIPE_ADMIN_REQUIRED" }, 401);
    const count = await ctx.runQuery(internal.recipeIdeaAdmin.getOutstandingCount, {});
    return adminJson({ count }, 200);
  }),
});

http.route({
  path: "/internal/admin/recipe-ideas",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!hasAdminAuthorization(request)) return adminJson({ error: "RECIPE_ADMIN_REQUIRED" }, 401);
    const body: unknown = await request.json().catch(() => null);
    if (
      !isRecord(body) ||
      typeof body.text !== "string" ||
      (body.authorName !== undefined && typeof body.authorName !== "string")
    ) {
      return adminJson({ error: "RECIPE_IDEA_CONTENT_INVALID" }, 400);
    }
    try {
      const result = await ctx.runMutation(internal.recipeIdeaAdmin.create, {
        text: body.text,
        ...(typeof body.authorName === "string" ? { authorName: body.authorName } : {}),
      });
      return adminJson(result, 200);
    } catch {
      return adminJson({ error: "RECIPE_IDEA_CONTENT_INVALID" }, 400);
    }
  }),
});

http.route({
  path: "/internal/admin/recipe-ideas",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    if (!hasAdminAuthorization(request)) return adminJson({ error: "RECIPE_ADMIN_REQUIRED" }, 401);
    const body: unknown = await request.json().catch(() => null);
    const ideaId = isRecord(body) && typeof body.ideaId === "string"
      ? body.ideaId.trim()
      : "";
    if (!ideaId) return adminJson({ error: "RECIPE_IDEA_NOT_FOUND" }, 400);
    try {
      const result = await ctx.runMutation(internal.recipeIdeaAdmin.remove, { ideaId });
      return adminJson(result, 200);
    } catch {
      return adminJson({ error: "RECIPE_IDEA_NOT_FOUND" }, 404);
    }
  }),
});

http.route({
  path: "/internal/admin/recipe-comments",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    if (!hasAdminAuthorization(request)) return adminJson({ error: "RECIPE_ADMIN_REQUIRED" }, 401);
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body) || typeof body.commentId !== "string" || !body.commentId.trim()) {
      return adminJson({ error: "COMMENT_NOT_FOUND" }, 400);
    }
    const commentId = body.commentId.trim() as Id<"recipeComments">;
    await ctx.runMutation(internal.commentAdmin.remove, { commentId });
    return adminJson({ type: "success", commentId }, 200);
  }),
});

http.route({
  path: "/comment-photo-upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let storageId;
    try {
      const formData = await request.formData();
      const slug = formData.get("slug");
      const participantKey = formData.get("participantKey");
      const honeypot = formData.get("website");
      const photo = formData.get("photo");
      if (typeof slug !== "string" || typeof participantKey !== "string" || typeof honeypot !== "string" || !(photo instanceof File)) {
        return json({ error: "COMMENT_PHOTO_INVALID" }, 400);
      }
      if (!allowedPhotoTypes.has(photo.type) || photo.size > RECIPE_COMMENT_MAX_PHOTO_BYTES) {
        return json({ error: "COMMENT_PHOTO_INVALID" }, 400);
      }
      const bytes = new Uint8Array(await photo.arrayBuffer());
      if (!hasSupportedImageStructure(bytes, photo.type)) {
        return json({ error: "COMMENT_PHOTO_INVALID" }, 400);
      }
      const participantDigest: string = await ctx.runMutation(internal.comments.authorizePhotoUpload, {
        slug,
        participantKey,
        honeypot,
      });
      storageId = await ctx.storage.store(photo);
      await ctx.runMutation(internal.comments.recordPhotoClaim, { storageId, participantDigest });
      return json({ storageId }, 200);
    } catch (error) {
      if (storageId) await ctx.storage.delete(storageId);
      const status = String(error).includes("COMMENT_RATE_LIMITED") ? 429 : 400;
      return json({ error: String(error) }, status);
    }
  }),
});

function json(value: unknown, status: number) {
  return Response.json(value, { status, headers: corsHeaders });
}

function adminJson(value: unknown, status: number) {
  return Response.json(value, { status });
}

function hasAdminAuthorization(request: Request) {
  const password = process.env.RECIPE_ADMIN_PASSWORD;
  return Boolean(password && request.headers.get("Authorization") === `Bearer ${password}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSupportedImageStructure(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") return isValidPng(bytes);
  if (mimeType === "image/jpeg") return isValidJpeg(bytes);
  if (mimeType === "image/webp") return isValidWebp(bytes);
  return false;
}

function isValidPng(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 45) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return false;
  }
  if (readAscii(bytes, 12, 16) !== "IHDR" || readUint32(bytes, 8) !== 13) return false;
  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  return hasSafeDimensions(width, height) && readAscii(bytes, bytes.length - 8, bytes.length - 4) === "IEND";
}

function isValidJpeg(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return false;
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return false;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return false;
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) return false;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return hasSafeDimensions(width, height);
    }
    offset += segmentLength;
  }
  return false;
}

function isValidWebp(bytes: Uint8Array) {
  if (bytes.length < 30 || readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 12) !== "WEBP") return false;
  if (readUint32LittleEndian(bytes, 4) + 8 !== bytes.length) return false;
  const chunk = readAscii(bytes, 12, 16);
  if (chunk === "VP8X") {
    const width = 1 + readUint24LittleEndian(bytes, 24);
    const height = 1 + readUint24LittleEndian(bytes, 27);
    return hasSafeDimensions(width, height);
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return false;
    const width = 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]);
    const height = 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | (bytes[22] >> 6));
    return hasSafeDimensions(width, height);
  }
  if (chunk === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return false;
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return hasSafeDimensions(width, height);
  }
  return false;
}

function readAscii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function hasSafeDimensions(width: number, height: number) {
  return width > 0 && height > 0 && width <= RECIPE_COMMENT_MAX_PHOTO_DIMENSION && height <= RECIPE_COMMENT_MAX_PHOTO_DIMENSION && width * height <= RECIPE_COMMENT_MAX_PHOTO_PIXELS;
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number) {
  return (bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + ((bytes[offset + 3] << 24) >>> 0)) >>> 0;
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16);
}

export default http;
