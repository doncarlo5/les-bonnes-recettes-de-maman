"use client";

import { useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { RecipeDraftFormInput } from "./recipe-form-schema";

type LocaleKey = "fr" | "en";

export function StepIngredientUsesEditor({
  localeKey,
  stepPath,
}: {
  localeKey: LocaleKey;
  stepPath: `translations.${LocaleKey}.sections.${number}.steps.${number}`;
}) {
  const form = useFormContext<RecipeDraftFormInput>();
  const localized = useWatch({
    control: form.control,
    name: `translations.${localeKey}`,
  });
  const uses =
    useWatch({
      control: form.control,
      name: `${stepPath}.ingredientUses`,
    }) ?? [];
  const groups = [
    {
      key: "main",
      title: "Ingrédients principaux",
      ingredients: localized?.ingredients ?? [],
    },
    ...(localized?.subRecipes ?? []).map((subRecipe, subRecipeIndex) => ({
      key: `sub-${subRecipeIndex}`,
      title: subRecipe.title || "Sous-recette",
      ingredients: subRecipe.ingredients,
    })),
  ];

  function setSelected(ingredientId: string, selected: boolean) {
    const current = form.getValues(`${stepPath}.ingredientUses`) ?? [];
    form.setValue(
      `${stepPath}.ingredientUses`,
      selected
        ? [
            ...current.filter((use) => use.ingredientId !== ingredientId),
            { ingredientId },
          ]
        : current.filter((use) => use.ingredientId !== ingredientId),
      { shouldDirty: true, shouldTouch: true, shouldValidate: true },
    );
  }

  return (
    <div className="grid gap-3 rounded-xl bg-muted p-3">
      <div>
        <p className="text-sm font-bold">Ingrédients de cette étape</p>
        <p className="text-xs text-muted-foreground">
          Sélectionne les ingrédients à afficher sous l’instruction.
        </p>
      </div>
      {groups.map((group) =>
        group.ingredients.length ? (
          <fieldset key={group.key} className="grid gap-2">
            <legend className="type-meta mb-1 text-muted-foreground">
              {group.title}
            </legend>
            {group.ingredients.map((ingredient) => {
              const selectedIndex = uses.findIndex(
                (use) => use.ingredientId === ingredient.id,
              );
              return (
                <div
                  key={ingredient.id}
                  className="rounded-lg bg-background p-2.5 shadow-[var(--shadow-border)]"
                >
                  <div className="flex min-h-10 items-center gap-3 font-semibold">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-primary"
                      aria-label={ingredient.name || "Ingrédient sans nom"}
                      checked={selectedIndex >= 0}
                      onChange={(event) =>
                        setSelected(ingredient.id, event.target.checked)
                      }
                    />
                    <span className="flex-1 first-letter:uppercase">
                      {ingredient.name || "Ingrédient sans nom"}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {[ingredient.quantity, ingredient.unit]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  </div>
                  {selectedIndex >= 0 ? (
                    <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2">
                      <Field>
                        <FieldLabel className="text-xs">
                          Quantité pour l’étape
                        </FieldLabel>
                        <Input
                          aria-label={`Quantité pour l’étape – ${ingredient.name || "ingrédient"}`}
                          placeholder={
                            ingredient.quantity || "Quantité globale"
                          }
                          {...form.register(
                            `${stepPath}.ingredientUses.${selectedIndex}.amount.quantity` as FieldPath<RecipeDraftFormInput>,
                          )}
                        />
                      </Field>
                      <Field>
                        <FieldLabel className="text-xs">Unité</FieldLabel>
                        <Input
                          aria-label={`Unité pour l’étape – ${ingredient.name || "ingrédient"}`}
                          placeholder={ingredient.unit || "—"}
                          {...form.register(
                            `${stepPath}.ingredientUses.${selectedIndex}.amount.unit` as FieldPath<RecipeDraftFormInput>,
                          )}
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </fieldset>
        ) : null,
      )}
    </div>
  );
}
