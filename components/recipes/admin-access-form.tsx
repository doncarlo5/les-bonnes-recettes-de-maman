"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import type {
  AdminAccessState,
  requestRecipesAdminAccessAction,
} from "@/app/[locale]/(public)/admin/recettes/actions";
import type { Locale } from "@/i18n/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type AdminAccessFormProps = {
  locale: Locale;
  action: typeof requestRecipesAdminAccessAction;
};

const initialState: AdminAccessState = {
  type: "idle",
  message: "",
};

export function AdminAccessForm({ locale, action }: AdminAccessFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <main className="min-h-screen px-5 py-8 text-foreground sm:px-6">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="eyebrow">Admin recettes</p>
          <h1 className="font-heading text-4xl font-black leading-[0.95] text-foreground">
            Acces admin
          </h1>
          <p className="text-sm font-semibold leading-6 text-muted-foreground">
            Entre le mot de passe pour creer ou modifier les recettes.
          </p>
        </div>

        <form
          action={formAction}
          className="rounded-lg border bg-card p-5 shadow-card"
        >
          <input type="hidden" name="locale" value={locale} />
          <FieldGroup>
            <Field data-invalid={state.type === "error"}>
              <FieldLabel htmlFor="admin-password">Mot de passe</FieldLabel>
              <Input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={state.type === "error"}
              />
              <FieldError>{state.type === "error" ? state.message : ""}</FieldError>
            </Field>

            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LockKeyhole data-icon="inline-start" />
              )}
              Ouvrir l&apos;admin
            </Button>
          </FieldGroup>
        </form>

        <Alert>
          <LockKeyhole />
          <AlertTitle>Acces protege</AlertTitle>
          <AlertDescription>
            La liste et les formulaires de recettes ne sont charges qu&apos;apres
            validation du cookie admin.
          </AlertDescription>
        </Alert>
      </section>
    </main>
  );
}
