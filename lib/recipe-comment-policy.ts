export const RECIPE_COMMENT_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const RECIPE_COMMENT_PHOTO_FORMATS = ["jpeg", "png", "webp"] as const;
export const RECIPE_COMMENT_MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const RECIPE_COMMENT_MAX_PHOTO_DIMENSION = 8192;
export const RECIPE_COMMENT_MAX_PHOTO_PIXELS = 40_000_000;
