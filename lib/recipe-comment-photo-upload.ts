import type { Id } from "@/convex/_generated/dataModel";
import { getConvexSiteUrl } from "./convex-site-url";

export async function uploadRecipeCommentPhoto({
  file,
  slug,
  participantKey,
  honeypot,
}: {
  file: File;
  slug: string;
  participantKey: string;
  honeypot: string;
}) {
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) throw new Error("CONVEX_SITE_URL_MISSING");
  const formData = new FormData();
  formData.set("slug", slug);
  formData.set("participantKey", participantKey);
  formData.set("website", honeypot);
  formData.set("photo", file);
  const uploadResponse = await fetch(`${convexSiteUrl}/comment-photo-upload`, {
    method: "POST",
    body: formData,
  });
  if (!uploadResponse.ok) {
    throw new Error(uploadResponse.status === 429 ? "COMMENT_RATE_LIMITED" : "COMMENT_PHOTO_UPLOAD_FAILED");
  }
  const { storageId } = (await uploadResponse.json()) as { storageId: Id<"_storage"> };
  const verificationResponse = await fetch("/api/recipes/comments/photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storageId, participantKey }),
  });
  if (!verificationResponse.ok) throw new Error("COMMENT_PHOTO_UPLOAD_FAILED");
  return storageId;
}
