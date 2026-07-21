"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useFieldArray,
  useFormContext,
  useWatch,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type UseFormRegister,
} from "react-hook-form";
import { ChevronRight, ListPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldLabel, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRecipeItemId } from "@/lib/recipe-item-ids";
import { countIngredientReferences, removeIngredientReferences } from "@/lib/recipe-step-references";
import {
  SortableCollection,
  SortableEditorRow,
} from "./admin-sortable-collection";
import type { RecipeDraftFormInput } from "./recipe-form-schema";
import type { Ingredient, RecipeSection, RecipeStep } from "./types";
import { StepIngredientUsesEditor } from "./step-ingredient-uses-editor";

type RecipeControl = Control<RecipeDraftFormInput>;
type RecipeRegister = UseFormRegister<RecipeDraftFormInput>;
const newIngredient = () => ({
  id: createRecipeItemId("ingredient"),
  name: "",
  quantity: "",
  unit: "",
  notes: "",
});

type IngredientArrayPath = Extract<
  FieldArrayPath<RecipeDraftFormInput>,
  `translations.${string}.ingredients`
>;
type SectionArrayPath = Extract<
  FieldArrayPath<RecipeDraftFormInput>,
  `translations.${string}.sections`
>;
type StepsArrayPath = Extract<
  FieldArrayPath<RecipeDraftFormInput>,
  `translations.${string}.sections.${number}.steps`
>;

type CollectionChildSuffix =
  | `${number}`
  | `${number}.${"name" | "quantity" | "unit" | "notes" | "title"}`;

function childFieldPath<T extends FieldArrayPath<RecipeDraftFormInput>>(
  name: T,
  suffix: CollectionChildSuffix,
): FieldPath<RecipeDraftFormInput> {
  return `${name}.${suffix}` as FieldPath<RecipeDraftFormInput>;
}

function stepsArrayPath(name: SectionArrayPath, index: number): StepsArrayPath {
  return `${name}.${index}.steps` as StepsArrayPath;
}

export function CompactIngredientsEditor({
  name,
  control,
  register,
}: {
  name: IngredientArrayPath;
  control: RecipeControl;
  register: RecipeRegister;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });
  const form = useFormContext<RecipeDraftFormInput>();
  const localeKey = name.includes(".en.") ? "en" : "fr";
  const sections = useWatch({ control, name: `translations.${localeKey}.sections` });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const values = (useWatch({ control, name }) ?? []) as Ingredient[];
  useDeepLinkedIndex(name, fields.length, setEditingIndex);
  const closeEditor = useFocusRestoringClose(
    editingIndex,
    fields,
    setEditingIndex,
  );

  return (
    <FieldSet>
      <CollectionHeader
        title="Ingrédients"
        label="Ajouter un ingrédient"
        onAdd={() => {
          append(newIngredient());
          setEditingIndex(fields.length);
        }}
      />
      <SortableCollection
        ids={fields.map((field) => field.id)}
        label="Réordonner les ingrédients"
        getLabel={(index) => values[index]?.name || `Ingrédient ${index + 1}`}
        onMove={move}
        renderItem={(id, index) => {
          const ingredient = values[index] ?? newIngredient();
          const summary = [
            ingredient.quantity,
            ingredient.unit,
            ingredient.name,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <SortableEditorRow
              key={id}
              id={id}
              handleLabel={`Déplacer ${summary || `l’ingrédient ${index + 1}`}`}
              onOpen={() => setEditingIndex(index)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate font-black tabular-nums"
                    title={summary || `Ingrédient ${index + 1}`}
                  >
                    {summary || `Ingrédient ${index + 1}`}
                  </span>
                  {ingredient.notes ? (
                    <span
                      className="block truncate text-xs font-semibold text-muted-foreground"
                      title={ingredient.notes}
                    >
                      {ingredient.notes}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </span>
            </SortableEditorRow>
          );
        }}
      />
      <Drawer
        open={editingIndex !== null}
        onOpenChange={(open: boolean) => !open && closeEditor()}
      >
        <DrawerContent className="max-h-[92dvh] rounded-t-3xl">
          {editingIndex !== null ? (
            <>
              <DrawerHeader className="shrink-0 text-left">
                <DrawerTitle className="type-panel-title">
                  Ingrédient {editingIndex + 1}
                </DrawerTitle>
                <DrawerDescription data-drawer-editing-description>
                  Renseigne seulement les détails utiles à la recette.
                </DrawerDescription>
              </DrawerHeader>
              <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain px-4 pb-4">
                <Field>
                  <FieldLabel>Nom</FieldLabel>
                  <Input
                    className="h-11"
                    {...register(childFieldPath(name, `${editingIndex}.name`))}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel>Quantité</FieldLabel>
                    <Input
                      className="h-11"
                      {...register(
                        childFieldPath(name, `${editingIndex}.quantity`),
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Unité</FieldLabel>
                    <Input
                      className="h-11"
                      {...register(
                        childFieldPath(name, `${editingIndex}.unit`),
                      )}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Notes</FieldLabel>
                  <Input
                    className="h-11"
                    {...register(childFieldPath(name, `${editingIndex}.notes`))}
                  />
                </Field>
              </div>
              <DrawerFooter className="recipe-drawer-footer recipe-compact-action-bar shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <DestructiveConfirmButton
                  label="Supprimer cet ingrédient"
                  description={(() => {
                    const count = countIngredientReferences(
                      sections ?? [],
                      [values[editingIndex]?.id].filter(Boolean) as string[],
                    );
                    return count
                      ? `Cet ingrédient est affiché dans ${count} étape${count > 1 ? "s" : ""}. Il sera également retiré de ces étapes.`
                      : "Supprimer cet ingrédient ?";
                  })()}
                  onConfirm={() => {
                    const ingredientId = values[editingIndex]?.id;
                    if (ingredientId) {
                      form.setValue(
                        `translations.${localeKey}.sections`,
                        removeIngredientReferences(sections ?? [], [ingredientId]),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    }
                    remove(editingIndex);
                    setEditingIndex(null);
                  }}
                />
                <Button
                  type="button"
                  className="min-h-12 rounded-xl"
                  onClick={closeEditor}
                >
                  Terminé
                </Button>
              </DrawerFooter>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </FieldSet>
  );
}

export function CompactSectionsEditor({
  name,
  control,
  register,
}: {
  name: SectionArrayPath;
  control: RecipeControl;
  register: RecipeRegister;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });
  const values = (useWatch({ control, name }) ?? []) as RecipeSection[];
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isEditingStep, setIsEditingStep] = useState(false);
  useDeepLinkedIndex(name, fields.length, setEditingIndex);
  const closeEditor = useFocusRestoringClose(
    editingIndex,
    fields,
    setEditingIndex,
  );

  return (
    <FieldSet>
      <CollectionHeader
        title="Sections"
        label="Ajouter une section"
        onAdd={() => {
          append({
            title: "",
            steps: [{ id: createRecipeItemId("step"), text: "", ingredientUses: [] }],
          });
          setEditingIndex(fields.length);
        }}
      />
      <SortableCollection
        ids={fields.map((field) => field.id)}
        label="Réordonner les sections"
        getLabel={(index) => values[index]?.title || `Section ${index + 1}`}
        onMove={move}
        renderItem={(id, index) => {
          const section = values[index] ?? { title: "", steps: [] };
          return (
            <SortableEditorRow
              key={id}
              id={id}
              handleLabel={`Déplacer ${section.title || `la section ${index + 1}`}`}
              onOpen={() => setEditingIndex(index)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate font-black"
                    title={section.title || `Section ${index + 1}`}
                  >
                    {section.title || `Section ${index + 1}`}
                  </span>
                  <span className="type-meta block text-muted-foreground">
                    {section.steps?.filter((step) => step.text.trim())
                      .length ?? 0}{" "}
                    étapes
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </span>
            </SortableEditorRow>
          );
        }}
      />
      <Drawer
        open={editingIndex !== null}
        onOpenChange={(open: boolean) => !open && closeEditor()}
      >
        <DrawerContent className="max-h-[92dvh] rounded-t-3xl">
          {editingIndex !== null ? (
            <>
              <DrawerHeader className="shrink-0 text-left">
                <DrawerTitle className="type-panel-title">
                  Section {editingIndex + 1}
                </DrawerTitle>
                <DrawerDescription data-drawer-editing-description>
                  Organise les étapes dans leur ordre de préparation.
                </DrawerDescription>
              </DrawerHeader>
              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain px-4 pb-4">
                <Field>
                  <FieldLabel>Titre de section</FieldLabel>
                  <Input
                    className="h-11"
                    {...register(childFieldPath(name, `${editingIndex}.title`))}
                  />
                </Field>
                <CompactStepsEditor
                  name={stepsArrayPath(name, editingIndex)}
                  control={control}
                  register={register}
                  onEditingChange={setIsEditingStep}
                />
              </div>
              {!isEditingStep ? (
                <DrawerFooter className="recipe-drawer-footer recipe-compact-action-bar shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <DestructiveConfirmButton
                    label="Supprimer la section"
                    description="Supprimer cette section ?"
                    onConfirm={() => {
                      remove(editingIndex);
                      setEditingIndex(null);
                    }}
                  />
                  <Button
                    type="button"
                    className="min-h-12 rounded-xl"
                    onClick={closeEditor}
                  >
                    Terminé
                  </Button>
                </DrawerFooter>
              ) : null}
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </FieldSet>
  );
}

function CompactStepsEditor({
  name,
  control,
  register,
  onEditingChange,
}: {
  name: StepsArrayPath;
  control: RecipeControl;
  register: RecipeRegister;
  onEditingChange: (isEditing: boolean) => void;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });
  const values = (useWatch({ control, name }) ?? []) as RecipeStep[];
  const localeKey = name.includes(".en.") ? "en" : "fr";
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  useDeepLinkedIndex(name, fields.length, setEditingIndex);
  useEffect(() => {
    onEditingChange(editingIndex !== null);
  }, [editingIndex, onEditingChange]);
  useEffect(
    () => () => {
      onEditingChange(false);
    },
    [onEditingChange],
  );
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <FieldTitle>Étapes</FieldTitle>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            append({ id: createRecipeItemId("step"), text: "", ingredientUses: [] });
            setEditingIndex(fields.length);
          }}
        >
          <ListPlus /> Ajouter
        </Button>
      </div>
      <SortableCollection
        ids={fields.map((field) => field.id)}
        label="Réordonner les étapes"
        getLabel={(index) => `Étape ${index + 1}`}
        onMove={move}
        renderItem={(id, index) => (
          <SortableEditorRow
            key={id}
            id={id}
            handleLabel={`Déplacer l’étape ${index + 1}`}
            onOpen={() => setEditingIndex(index)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-sm font-black tabular-nums">
                {index + 1}
              </span>
              <span
                className="line-clamp-2 flex-1 text-sm font-semibold"
                title={values[index]?.text || `Étape ${index + 1}`}
              >
                {values[index]?.text || `Étape ${index + 1}`}
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </span>
          </SortableEditorRow>
        )}
      />
      {editingIndex !== null ? (
        <div
          data-drawer-scroll-target
          className="grid gap-2 rounded-xl bg-card p-3 shadow-[var(--shadow-card)]"
        >
          <Textarea
            autoFocus
            placeholder={`Étape ${editingIndex + 1}`}
            {...register(`${name}.${editingIndex}.text` as FieldPath<RecipeDraftFormInput>)}
          />
          <StepIngredientUsesEditor
            localeKey={localeKey}
            stepPath={`${name}.${editingIndex}` as `translations.${"fr" | "en"}.sections.${number}.steps.${number}`}
          />
          <div className="recipe-compact-action-bar gap-2">
            <DestructiveConfirmButton
              label="Supprimer cette étape"
              description="Supprimer cette étape ?"
              onConfirm={() => {
                remove(editingIndex);
                setEditingIndex(null);
              }}
            />
            <Button
              type="button"
              className="min-h-12 rounded-xl transition-transform active:scale-[0.96]"
              onClick={() => setEditingIndex(null)}
            >
              Terminé
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DestructiveConfirmButton({
  label,
  description,
  onConfirm,
}: {
  label: string;
  description: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="destructive"
        data-drawer-destructive-action
        aria-label={label}
        className="min-h-11 transition-transform active:scale-[0.96]"
        onClick={() => setOpen(true)}
      >
        <Trash2 /> <span data-drawer-action-label>{label}</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              {label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CollectionHeader({
  title,
  label,
  onAdd,
}: {
  title: string;
  label: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <FieldTitle>{title}</FieldTitle>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={onAdd}
      >
        <ListPlus /> {label}
      </Button>
    </div>
  );
}

function useDeepLinkedIndex(
  name: string,
  length: number,
  setEditingIndex: (index: number) => void,
) {
  const requestedField = useSearchParams().get("field");
  useEffect(() => {
    if (!requestedField?.startsWith(`${name}.`)) return;
    const index = Number(requestedField.slice(name.length + 1).split(".")[0]);
    if (Number.isInteger(index) && index >= 0 && index < length)
      setEditingIndex(index);
  }, [length, name, requestedField, setEditingIndex]);
}

function useFocusRestoringClose(
  editingIndex: number | null,
  fields: Array<{ id: string }>,
  setEditingIndex: (index: number | null) => void,
) {
  return () => {
    const id = editingIndex === null ? null : fields[editingIndex]?.id;
    setEditingIndex(null);
    if (id)
      window.requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            `[data-sortable-open="${CSS.escape(id)}"]`,
          )
          ?.focus(),
      );
  };
}
