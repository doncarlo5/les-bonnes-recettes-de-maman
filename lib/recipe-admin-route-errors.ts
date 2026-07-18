import "server-only";

export function recipeMutationErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("RECIPE_DRAFT_CONFLICT")) {
    const latestRevision = Number(message.split(":").at(-1));
    return Response.json(
      {
        type: "conflict",
        message: "Ce brouillon a été modifié ailleurs.",
        latestRevision: Number.isFinite(latestRevision) ? latestRevision : undefined,
      },
      { status: 409 },
    );
  }
  if (message.includes("RECIPE_LIMIT_EXCEEDED") || message.includes("RECIPE_DRAFT_TOO_LARGE")) {
    return Response.json(
      { type: "error", message: "Le brouillon dépasse les limites autorisées." },
      { status: 400 },
    );
  }
  if (message.includes("RECIPE_HAS_NO_PUBLISHED_VERSION")) {
    return Response.json(
      { type: "error", message: "Cette recette n’a pas encore de version publiée." },
      { status: 400 },
    );
  }
  if (message.includes("RECIPE_NOT_FOUND")) {
    return Response.json({ type: "error", message: "Recette introuvable." }, { status: 404 });
  }
  return Response.json({ type: "error", message: fallback }, { status: 500 });
}
