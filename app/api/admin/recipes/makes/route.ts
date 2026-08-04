import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { adminUnauthorizedResponse, getRecipeAdminAccess } from "@/lib/recipe-admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const cursor = new URL(request.url).searchParams.get("cursor") || null;
  const result = await fetchQuery(api.recipeMakes.listModerationQueue, {
    adminPassword: access.adminPassword,
    paginationOpts: { numItems: 12, cursor },
  });
  return Response.json(result);
}

export async function POST(request: Request) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.action !== "string") {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    if (body.action === "dismiss" && isId(body.reportId)) {
      return Response.json(await fetchMutation(api.recipeMakes.adminDismissReport, {
        adminPassword: access.adminPassword,
        reportId: body.reportId as Id<"recipeMakeReports">,
      }));
    }

    if (
      (body.action === "remove" || body.action === "restore" || body.action === "block") &&
      isId(body.makeId)
    ) {
      const participantDigest = typeof body.participantDigest === "string" ? body.participantDigest : undefined;
      const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;
      return Response.json(await fetchMutation(api.recipeMakes.adminSetState, {
        adminPassword: access.adminPassword,
        makeId: body.makeId as Id<"recipeMakes">,
        state: body.action === "restore" ? "published" : body.action === "block" ? "blocked" : "removed",
        ...(participantDigest ? { participantDigest } : {}),
        ...(reason ? { reason } : {}),
      }));
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "UNKNOWN_ERROR" }, { status: 400 });
  }

  return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
