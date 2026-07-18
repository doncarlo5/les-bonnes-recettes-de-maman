"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
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
  redirectTo?: string;
};

type AdminAccessState = {
  type: "idle" | "success" | "error";
  message: string;
  redirectTo?: string;
};

const initialState: AdminAccessState = {
  type: "idle",
  message: "",
};

export function AdminAccessForm({ locale, redirectTo }: AdminAccessFormProps) {
  const router = useRouter();
  const [state, setState] = useState<AdminAccessState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setState(initialState);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/recipes/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale,
          password: String(formData.get("password") ?? ""),
          redirectTo,
        }),
      });
      const data = (await response.json()) as AdminAccessState;

      if (!response.ok || data.type === "error") {
        setState({
          type: "error",
          message: data.message || "Impossible d'ouvrir l'admin recettes.",
        });
        return;
      }

      router.replace(data.redirectTo ?? `/${locale}/admin/recettes`);
      router.refresh();
    } catch {
      setState({
        type: "error",
        message: "Impossible d'ouvrir l'admin recettes.",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 text-foreground sm:px-6">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="type-label text-primary">Admin recettes</p>
          <h1 className="type-page-title text-foreground">
            Acces admin
          </h1>
          <p className="type-body-sm font-semibold text-muted-foreground [text-wrap:pretty]">
            Entre le mot de passe pour creer ou modifier les recettes.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
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
