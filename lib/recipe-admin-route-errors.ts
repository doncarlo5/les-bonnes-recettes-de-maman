import "server-only";

import type { z } from "zod";
import { mutationErrorSchema } from "@/lib/recipe-admin-contracts";

export async function parseJsonRequest<T>(
  request: Request,
  schema: z.ZodType<T>,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false as const,
      response: validationResponse([], "Le corps JSON est vide ou malformé."),
    };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const { fieldErrors, formError } = splitIssues(result.error.issues);
    return {
      ok: false as const,
      response: validationResponse(
        fieldErrors,
        formError ?? "Requête invalide.",
      ),
    };
  }
  return { ok: true as const, data: result.data };
}

export function validationResponse(
  fieldErrors: Record<string, string> | Array<never>,
  formError?: string,
) {
  return Response.json(
    mutationErrorSchema.parse({
      type: "validation",
      message: formError ?? "Corrige les champs indiqués.",
      fieldErrors: Array.isArray(fieldErrors) ? {} : fieldErrors,
      ...(formError ? { formError } : {}),
    }),
    { status: 400 },
  );
}

export function splitIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
) {
  const fieldErrors: Record<string, string> = {};
  let formError: string | undefined;
  for (const issue of issues) {
    const key = issue.path
      .filter((part) => typeof part === "string" || typeof part === "number")
      .join(".");
    if (key) fieldErrors[key] ??= issue.message;
    else formError ??= issue.message;
  }
  return { fieldErrors, formError };
}

export function errorResponse(message: string, status = 500) {
  return Response.json(mutationErrorSchema.parse({ type: "error", message }), {
    status,
  });
}

export function recipeMutationErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("RECIPE_DRAFT_CONFLICT")) {
    const latestRevision = Number(message.split(":").at(-1));
    return Response.json(
      mutationErrorSchema.parse({
        type: "conflict",
        message: "Ce brouillon a été modifié ailleurs.",
        latestRevision: Number.isFinite(latestRevision)
          ? latestRevision
          : undefined,
      }),
      { status: 409 },
    );
  }
  if (
    message.includes("RECIPE_LIMIT_EXCEEDED") ||
    message.includes("RECIPE_DRAFT_TOO_LARGE")
  ) {
    return Response.json(
      mutationErrorSchema.parse({
        type: "error",
        message: "Le brouillon dépasse les limites autorisées.",
      }),
      { status: 400 },
    );
  }
  if (message.includes("RECIPE_HAS_NO_PUBLISHED_VERSION")) {
    return Response.json(
      mutationErrorSchema.parse({
        type: "error",
        message: "Cette recette n’a pas encore de version publiée.",
      }),
      { status: 400 },
    );
  }
  if (message.includes("RECIPE_NOT_FOUND")) {
    return Response.json(
      mutationErrorSchema.parse({
        type: "error",
        message: "Recette introuvable.",
      }),
      { status: 404 },
    );
  }
  return errorResponse(fallback);
}
