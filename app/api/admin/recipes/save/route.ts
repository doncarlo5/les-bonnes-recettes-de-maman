import { fetchMutation } from "convex/nextjs";
import { NextRequest } from "next/server";
import { api } from "@/convex/_generated/api";
import {
  parseRecipePayload,
  saveRecipeRequestSchema,
  saveRecipeSuccessSchema,
} from "@/lib/recipe-admin-contracts";
import {
  adminUnauthorizedResponse,
  getRecipeAdminAccess,
} from "@/lib/recipe-admin-auth";
import { revalidateRecipePaths } from "@/lib/recipe-admin-revalidate";
import {
  parseJsonRequest,
  recipeMutationErrorResponse,
  splitIssues,
  validationResponse,
} from "@/lib/recipe-admin-route-errors";

export const dynamic = "force-dynamic";

const initialErrorMessage = "Impossible d'enregistrer cette recette.";

export async function POST(request: NextRequest) {
  const parsedBody = await parseJsonRequest(request, saveRecipeRequestSchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  const adminAccess = await getRecipeAdminAccess();

  if (!adminAccess.ok) {
    return adminUnauthorizedResponse(adminAccess);
  }

  const validation = parseRecipePayload(body.recipePayload);
  if (!validation.success) {
    if ("issues" in validation && validation.issues) {
      const { fieldErrors, formError } = splitIssues(validation.issues);
      return validationResponse(fieldErrors, formError);
    }
    return validationResponse({}, validation.error);
  }

  try {
    const result =
      body.mode === "create"
        ? await fetchMutation(api.recipes.create, {
            recipe: validation.data,
            adminPassword: adminAccess.adminPassword,
          })
        : await fetchMutation(api.recipes.saveDraft, {
            slug: body.slug,
            recipe: validation.data,
            expectedRevision: body.expectedRevision,
            force: body.force,
            preserveStepIngredientUses: validation.isLegacyStepPayload,
            adminPassword: adminAccess.adminPassword,
          });

    revalidateRecipePaths(result.slug);

    return Response.json(
      saveRecipeSuccessSchema.parse({
        type: "success",
        message: `Recette enregistree: ${result.title}`,
        slug: result.slug,
        revision: result.revision,
        savedAt: result.savedAt,
      }),
    );
  } catch (error) {
    return recipeMutationErrorResponse(error, initialErrorMessage);
  }
}
