import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 8 * 1024 * 1024;
const maxPhotoDimension = 8192;
const maxPhotoPixels = 40_000_000;
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
      if (!allowedPhotoTypes.has(photo.type) || photo.size > maxPhotoBytes) {
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

function hasSupportedImageStructure(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") return isValidPng(bytes);
  if (mimeType === "image/jpeg") return isValidJpeg(bytes);
  if (mimeType === "image/webp") return isValidWebp(bytes);
  return false;
}

function isValidPng(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 45 || !signature.every((byte, index) => bytes[index] === byte)) return false;
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
  return width > 0 && height > 0 && width <= maxPhotoDimension && height <= maxPhotoDimension && width * height <= maxPhotoPixels;
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
