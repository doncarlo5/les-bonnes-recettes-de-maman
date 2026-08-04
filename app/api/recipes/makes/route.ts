import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ensureRecipeMakeSession,
  getCallerIpDigest,
  readRecipeMakeSessionDigest,
} from "@/lib/recipe-make-session";

export const dynamic = "force-dynamic";

type RecipeMakeAction =
  | {
    action: "requestTicket";
    slug: string;
    makeIdToReplace?: string;
  }
  | {
    action: "update";
    makeId: string;
    authorName?: string;
    caption?: string;
    altText?: string;
  }
  | {
    action: "delete";
    makeId: string;
  }
  | {
    action: "toggleBravo";
    makeId: string;
  }
  | {
    action: "report";
    makeId: string;
    reason: "spam" | "inappropriate" | "privacy" | "copyright" | "other";
    details?: string;
  };

type ReportReason = "spam" | "inappropriate" | "privacy" | "copyright" | "other";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim();
  const cursor = url.searchParams.get("cursor") || null;
  const scope = url.searchParams.get("scope") || "gallery";

  if (!slug || (scope !== "preview" && scope !== "gallery")) {
    return Response.json({ error: "RECIPE_NOT_FOUND" }, { status: 400 });
  }

  await ensureRecipeMakeSession();
  const session = await readRecipeMakeSessionDigest();
  const participantDigest = session?.digest;

  const query = scope === "preview"
    ? api.recipeMakes.listPreview
    : api.recipeMakes.list;

  const result = await fetchQuery(query, {
    slug,
    ...(participantDigest ? { participantDigest } : {}),
    ...(scope === "gallery"
      ? { paginationOpts: { numItems: 12, cursor } }
      : {}),
  });

  return Response.json(result);
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  if (!isActionRequest(body)) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  await ensureRecipeMakeSession();
  const session = await readRecipeMakeSessionDigest();
  if (!session?.digest) {
    return Response.json({ error: "SESSION_UNAVAILABLE" }, { status: 500 });
  }
  const serverSecret = process.env.RECIPE_MAKE_SERVER_SECRET
    || process.env.RECIPE_ADMIN_PASSWORD;
  if (!serverSecret) {
    return Response.json({ error: "RECIPE_MAKE_SERVER_SECRET_MISSING" }, { status: 503 });
  }

  try {
    if (body.action === "requestTicket") {
      const result = await fetchMutation(api.recipeMakes.requestUploadTicket, {
        serverSecret,
        slug: body.slug,
        participantDigest: session.digest,
        requestedByIpDigest: getCallerIpDigest(request),
        ...(body.makeIdToReplace ? { makeIdToReplace: body.makeIdToReplace as Id<"recipeMakes"> } : {}),
      });
      return Response.json(result);
    }

    if (body.action === "update") {
      const result = await fetchMutation(api.recipeMakes.update, {
        serverSecret,
        makeId: body.makeId as Id<"recipeMakes">,
        participantDigest: session.digest,
        ...(body.authorName !== undefined ? { authorName: body.authorName } : {}),
        ...(body.caption !== undefined ? { caption: body.caption } : {}),
        ...(body.altText !== undefined ? { altText: body.altText } : {}),
      });
      return Response.json(result);
    }

    if (body.action === "delete") {
      const result = await fetchMutation(api.recipeMakes.removeOwn, {
        serverSecret,
        makeId: body.makeId as Id<"recipeMakes">,
        participantDigest: session.digest,
      });
      return Response.json(result);
    }

    if (body.action === "toggleBravo") {
      const result = await fetchMutation(api.recipeMakes.toggleBravo, {
        serverSecret,
        makeId: body.makeId as Id<"recipeMakes">,
        participantDigest: session.digest,
      });
      return Response.json(result);
    }

    const result = await fetchMutation(api.recipeMakes.report, {
      serverSecret,
      makeId: body.makeId as Id<"recipeMakes">,
      participantDigest: session.digest,
      reason: body.reason,
      ...(body.details ? { details: body.details } : {}),
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (
      message.includes("RECIPE_MAKE_RATE_LIMITED") ||
      message.includes("RECIPE_MAKE_UPLOAD_DISABLED") ||
      message.includes("RECIPE_MAKE_PARTICIPANT_BLOCKED") ||
      message.includes("RECIPE_MAKE_OWNER_REQUIRED") ||
      message.includes("RECIPE_MAKE_NOT_EDITABLE") ||
      message.includes("RECIPE_MAKE_NOT_FOUND")
    ) {
      return Response.json({ error: message }, { status: 400 });
    }

    return Response.json({ error: message }, { status: 500 });
  }
}

function isActionRequest(value: unknown): value is RecipeMakeAction {
  if (!isRecord(value) || typeof value.action !== "string") return false;

  if (value.action === "requestTicket") {
    return (
      typeof value.slug === "string" &&
      (value.makeIdToReplace === undefined || isRecordLikeId(value.makeIdToReplace))
    );
  }

  if (value.action === "update") {
    return (
      isRecordLikeId(value.makeId) &&
      (value.authorName === undefined || typeof value.authorName === "string") &&
      (value.caption === undefined || typeof value.caption === "string") &&
      (value.altText === undefined || typeof value.altText === "string")
    );
  }

  if (value.action === "delete" || value.action === "toggleBravo") {
    return isRecordLikeId(value.makeId);
  }

  if (value.action === "report") {
    return isRecordLikeId(value.makeId) && isReportReason(value.reason);
  }

  return false;
}

function isRecordLikeId(value: unknown) {
  return typeof value === "string" && value.length > 0;
}

function isReportReason(value: unknown): value is ReportReason {
  return value === "spam" ||
    value === "inappropriate" ||
    value === "privacy" ||
    value === "copyright" ||
    value === "other";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
