export const RECIPE_MAKE_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const RECIPE_MAKE_PHOTO_FORMATS = [
  "jpeg",
  "png",
  "webp",
  "heic",
] as const;

export const RECIPE_MAKE_MAX_PHOTO_BYTES = 12 * 1024 * 1024;
export const RECIPE_MAKE_MAX_DIMENSION = 8192;
export const RECIPE_MAKE_MAX_PIXELS = 50_000_000;
export const RECIPE_MAKE_FULL_SIZE = 2048;
export const RECIPE_MAKE_THUMBNAIL_WIDTH = 640;
export const RECIPE_MAKE_THUMBNAIL_HEIGHT = 480;
