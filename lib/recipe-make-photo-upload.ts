import { getConvexSiteUrl } from "./convex-site-url";

type UploadRecipeMakePhotoArgs = {
  file: File;
  slug: string;
  ticketDigest: string;
  authorName?: string;
  caption?: string;
  altText?: string;
};

export async function uploadRecipeMakePhoto({
  file,
  slug,
  ticketDigest,
  authorName,
  caption,
  altText,
}: UploadRecipeMakePhotoArgs) {
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) throw new Error("CONVEX_SITE_URL_MISSING");

  const formData = new FormData();
  formData.set("slug", slug);
  formData.set("ticketDigest", ticketDigest);
  if (authorName) formData.set("authorName", authorName);
  if (caption) formData.set("caption", caption);
  if (altText) formData.set("altText", altText);
  formData.set("photo", file);

  const uploadResponse = await fetch(`${convexSiteUrl}/recipe-make-upload`, {
    method: "POST",
    body: formData,
  });
  const body = (await uploadResponse.json().catch(() => ({}))) as { error?: string };
  if (!uploadResponse.ok || body.error) {
    if (body.error === "RECIPE_MAKE_ORIGIN_BLOCKED") {
      throw new Error("RECIPE_MAKE_ORIGIN_BLOCKED");
    }
    throw new Error("RECIPE_MAKE_UPLOAD_FAILED");
  }

  return body as { success: true };
}
