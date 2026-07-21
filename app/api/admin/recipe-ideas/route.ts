import type { NextRequest } from "next/server";
import {
  adminRecipeIdeaCreateRequestSchema,
  adminRecipeIdeaDeleteRequestSchema,
} from "@/lib/recipe-admin-contracts";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import {
  createAdminRecipeIdea,
  listAdminRecipeIdeas,
  removeAdminRecipeIdea,
} from "@/lib/recipe-idea-admin-client";
import { parseJsonRequest } from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  const state = request.nextUrl.searchParams.get("state");
  const locale = request.nextUrl.searchParams.get("locale");
  const cursor = request.nextUrl.searchParams.get("cursor");
  if (state !== "outstanding" && state !== "completed") {
    return Response.json({ error: "État d'idée invalide." }, { status: 400 });
  }
  if (locale !== "fr" && locale !== "en") {
    return Response.json({ error: "Langue invalide." }, { status: 400 });
  }
  try {
    return Response.json(
      await listAdminRecipeIdeas(access.adminPassword, state, locale, cursor),
    );
  } catch {
    return Response.json({ error: "Impossible de charger les idées." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonRequest(
    request,
    adminRecipeIdeaCreateRequestSchema,
  );
  if (!parsed.ok) return parsed.response;
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  try {
    const result = await createAdminRecipeIdea(access.adminPassword, parsed.data);
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Impossible d'ajouter cette idée." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const parsed = await parseJsonRequest(
    request,
    adminRecipeIdeaDeleteRequestSchema,
  );
  if (!parsed.ok) return parsed.response;
  const access = await getRecipeAdminAccess();
  if (!access.ok) return adminUnauthorizedResponse(access);
  try {
    const result = await removeAdminRecipeIdea(
      access.adminPassword,
      parsed.data.ideaId,
    );
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Impossible de supprimer cette idée." },
      { status: 400 },
    );
  }
}
