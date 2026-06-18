import { NextRequest } from "next/server";
import { hasLocale } from "@/i18n/config";
import {
  getRecipeAdminPassword,
  grantRecipeAdminAccess,
  verifyRecipeAdminPassword,
} from "@/lib/recipe-admin-auth";

export const dynamic = "force-dynamic";

type AccessBody = {
  locale?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AccessBody;
  const locale = body.locale ?? "";
  const password = body.password ?? "";

  if (!hasLocale(locale)) {
    return Response.json(
      {
        type: "error",
        message: "Impossible d'ouvrir l'admin recettes.",
      },
      { status: 400 },
    );
  }

  if (!getRecipeAdminPassword()) {
    return Response.json(
      {
        type: "error",
        message: "Mot de passe admin non configure.",
      },
      { status: 500 },
    );
  }

  if (!verifyRecipeAdminPassword(password)) {
    return Response.json(
      {
        type: "error",
        message: "Mot de passe invalide.",
      },
      { status: 401 },
    );
  }

  await grantRecipeAdminAccess();

  return Response.json({
    type: "success",
    message: "Acces admin ouvert.",
    redirectTo: `/${locale}/admin/recettes`,
  });
}
