"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
} from "react-hook-form";
import {
  ArrowDown,
  ArrowUp,
  CirclePlus,
  ListPlus,
  Save,
  Trash2,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  editableRecipeContentSchema,
  type RecipeFormPayload,
} from "./recipe-form-schema";
import { AdminRecipeImagePanel } from "./admin-recipe-image-panel";
import type { EditableRecipe } from "./types";

type AdminRecipeEditorProps = {
  locale: Locale;
  recipes: EditableRecipe[];
  initialSlug?: string;
  startInCreateMode?: boolean;
};

type SaveRecipeState = {
  type: "idle" | "success" | "error";
  message: string;
  slug?: string;
  fieldErrors?: Record<string, string>;
};

type RecipeFormMode = "create" | "update";
type LocaleKey = "fr" | "en";
type RecipeRegister = UseFormRegister<any>;
type RecipeControl = Control<any>;

const initialState = {
  type: "idle" as const,
  message: "Choisis une recette ou cree un brouillon.",
};

const blankIngredient = {
  name: "",
  quantity: "",
  unit: "",
  notes: "",
};

const blankLocalizedRecipe = {
  title: "",
  author: "",
  description: "",
  servings: null,
  prepTime: "",
  cookTime: "",
  totalTime: "",
  timeLabel: "",
  temperature: "",
  ingredients: [blankIngredient],
  sections: [
    {
      title: "",
      steps: [""],
    },
  ],
  subRecipes: [],
  notes: [],
};

const blankRecipe: RecipeFormPayload = {
  defaultLocale: "fr",
  translations: {
    fr: blankLocalizedRecipe,
    en: blankLocalizedRecipe,
  },
  tags: [],
  status: "draft",
};

export function AdminRecipeEditor({
  locale,
  recipes,
  initialSlug,
  startInCreateMode = false,
}: AdminRecipeEditorProps) {
  const router = useRouter();
  const [state, setState] = useState<SaveRecipeState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const initialRecipe =
    startInCreateMode
      ? null
      : recipes.find((recipe) => recipe.slug === initialSlug) ??
        recipes[0] ??
        null;
  const [selectedSlug, setSelectedSlug] = useState(initialRecipe?.slug ?? "");
  const [mode, setMode] = useState<RecipeFormMode>(
    initialRecipe ? "update" : "create",
  );
  const formRef = useRef<HTMLFormElement>(null);
  const payloadRef = useRef<HTMLInputElement>(null);
  const submitRequestedRef = useRef(false);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.slug === selectedSlug) ?? null,
    [recipes, selectedSlug],
  );

  const form = useForm<any>({
    resolver: zodResolver(editableRecipeContentSchema),
    defaultValues: selectedRecipe
      ? toFormValues(selectedRecipe)
      : cloneRecipe(blankRecipe),
    mode: "onBlur",
  });

  const {
    formState: { errors },
    getValues,
    register,
    reset,
    setValue,
  } = form;

  const defaultLocale = useWatch({
    control: form.control,
    name: "defaultLocale",
  });
  const status = useWatch({
    control: form.control,
    name: "status",
  });
  const tagsValue = useWatch({
    control: form.control,
    name: "tags",
  });

  function selectRecipe(slug: string) {
    const recipe = recipes.find((item) => item.slug === slug) ?? null;
    setMode(recipe ? "update" : "create");
    setSelectedSlug(recipe?.slug ?? "");
    reset(recipe ? toFormValues(recipe) : cloneRecipe(blankRecipe));

    if (recipe) {
      router.replace(`/${locale}/admin/recettes?slug=${recipe.slug}`);
    }
  }

  function createRecipe() {
    setMode("create");
    setSelectedSlug("");
    reset(cloneRecipe(blankRecipe));
    router.replace(`/${locale}/admin/recettes?new=1`);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitRequestedRef.current || isPending) return;

    const recipePayload = JSON.stringify(normalizePayload(getValues()));
    if (payloadRef.current) {
      payloadRef.current.value = recipePayload;
    }

    submitRequestedRef.current = true;
    setIsPending(true);

    try {
      const response = await fetch("/api/admin/recipes/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale,
          mode,
          slug: selectedSlug,
          recipePayload,
        }),
      });
      const data = (await response.json()) as SaveRecipeState;

      setState(data);

      if (response.ok && data.type === "success" && data.slug) {
        setMode("update");
        setSelectedSlug(data.slug);
        router.replace(`/${locale}/admin/recettes?slug=${data.slug}`);
        router.refresh();
      }
    } catch {
      setState({
        type: "error",
        message: "Impossible d'enregistrer cette recette.",
      });
    } finally {
      submitRequestedRef.current = false;
      setIsPending(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 text-foreground sm:px-6">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Admin recettes</p>
            <h1 className="font-heading text-5xl font-black leading-[0.95] text-foreground">
              Recettes
            </h1>
          </div>
          <Button type="button" onClick={createRecipe}>
            <CirclePlus data-icon="inline-start" />
            Nouvelle recette
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
          <RecipeTable
            recipes={recipes}
            selectedSlug={selectedSlug}
            onSelectRecipe={selectRecipe}
          />

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 rounded-lg border bg-card p-5 shadow-card"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="slug" value={selectedSlug} />
            <input ref={payloadRef} type="hidden" name="recipePayload" />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-2xl font-black text-foreground">
                    {mode === "create"
                      ? "Nouveau brouillon"
                      : selectedRecipe?.title}
                  </h2>
                  <Badge variant={status === "published" ? "default" : "secondary"}>
                    {status === "published" ? "Publiee" : "Brouillon"}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Slug: {mode === "create" ? "genere au premier enregistrement" : selectedSlug}
                </p>
              </div>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>

            <SaveStateAlert state={state} />

            <AdminRecipeImagePanel
              key={selectedRecipe?.slug ?? "new-recipe-image"}
              locale={locale}
              recipe={selectedRecipe}
            />

            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-3">
                <SelectField
                  label="Statut"
                  value={status}
                  onValueChange={(value) =>
                    setValue("status", value as "draft" | "published", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  options={[
                    { label: "Brouillon", value: "draft" },
                    { label: "Publiee", value: "published" },
                  ]}
                />
                <SelectField
                  label="Locale par defaut"
                  value={defaultLocale}
                  onValueChange={(value) =>
                    setValue("defaultLocale", value as LocaleKey, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  options={[
                    { label: "Francais", value: "fr" },
                    { label: "Anglais", value: "en" },
                  ]}
                />
                <Field>
                  <FieldLabel htmlFor="recipe-tags">Tags</FieldLabel>
                  <Input
                    id="recipe-tags"
                    value={(tagsValue ?? []).join(", ")}
                    onChange={(event) =>
                      setValue("tags", parseTags(event.target.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    placeholder="dessert, famille"
                  />
                  <FieldDescription>
                    Separe les tags par des virgules.
                  </FieldDescription>
                </Field>
              </div>

              <Tabs defaultValue="fr">
                <TabsList>
                  <TabsTrigger value="fr">Francais</TabsTrigger>
                  <TabsTrigger value="en">Anglais</TabsTrigger>
                </TabsList>
                <TabsContent value="fr">
                  <LocalizedRecipeFields
                    localeKey="fr"
                    register={register}
                    control={form.control}
                    errors={errors}
                    serverErrors={state.fieldErrors}
                  />
                </TabsContent>
                <TabsContent value="en">
                  <LocalizedRecipeFields
                    localeKey="en"
                    register={register}
                    control={form.control}
                    errors={errors}
                    serverErrors={state.fieldErrors}
                  />
                </TabsContent>
              </Tabs>
            </FieldGroup>
          </form>
        </div>
      </section>
    </main>
  );
}

function RecipeTable({
  recipes,
  selectedSlug,
  onSelectRecipe,
}: {
  recipes: EditableRecipe[];
  selectedSlug: string;
  onSelectRecipe: (slug: string) => void;
}) {
  if (recipes.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-5 text-sm font-semibold text-muted-foreground">
        Aucune recette pour le moment.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recette</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.map((recipe) => (
            <TableRow
              key={recipe._id}
              data-state={recipe.slug === selectedSlug ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => onSelectRecipe(recipe.slug)}
            >
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="truncate font-medium">{recipe.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {recipe.slug}
                  </span>
                  {recipe.tags.length > 0 ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {recipe.tags.join(", ")}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={recipe.status === "published" ? "default" : "secondary"}
                >
                  {recipe.status === "published" ? "Publiee" : "Draft"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LocalizedRecipeFields({
  localeKey,
  register,
  control,
  errors,
  serverErrors,
}: {
  localeKey: LocaleKey;
  register: RecipeRegister;
  control: RecipeControl;
  errors: Record<string, unknown>;
  serverErrors?: Record<string, string>;
}) {
  const baseName = `translations.${localeKey}`;

  return (
    <FieldGroup className="pt-4">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Titre"
          name={`${baseName}.title`}
          register={register}
          errors={errors}
          serverErrors={serverErrors}
        />
        <TextField
          label="Auteur"
          name={`${baseName}.author`}
          register={register}
          errors={errors}
          serverErrors={serverErrors}
        />
      </div>

      <TextareaField
        label="Description"
        name={`${baseName}.description`}
        register={register}
        errors={errors}
        serverErrors={serverErrors}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Portions"
          name={`${baseName}.servings.quantity`}
          type="number"
          register={register}
          errors={errors}
          serverErrors={serverErrors}
        />
        <TextField
          label="Unite portions"
          name={`${baseName}.servings.unit`}
          register={register}
          errors={errors}
          serverErrors={serverErrors}
          placeholder="personnes"
        />
        <TextField
          label="Temperature"
          name={`${baseName}.temperature`}
          register={register}
          errors={errors}
          serverErrors={serverErrors}
          placeholder="180 C"
        />
        <TextField
          label="Libelle temps"
          name={`${baseName}.timeLabel`}
          register={register}
          errors={errors}
          serverErrors={serverErrors}
          placeholder="45 min"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TextField
          label="Preparation"
          name={`${baseName}.prepTime`}
          register={register}
          errors={errors}
          serverErrors={serverErrors}
          placeholder="20 min"
        />
        <TextField
          label="Cuisson"
          name={`${baseName}.cookTime`}
          register={register}
          errors={errors}
          serverErrors={serverErrors}
          placeholder="25 min"
        />
        <TextField
          label="Total"
          name={`${baseName}.totalTime`}
          register={register}
          errors={errors}
          serverErrors={serverErrors}
          placeholder="45 min"
        />
      </div>

      <IngredientsArray
        title="Ingredients"
        name={`${baseName}.ingredients`}
        control={control}
        register={register}
      />
      <SectionsArray
        name={`${baseName}.sections`}
        control={control}
        register={register}
      />
      <SubRecipesArray
        name={`${baseName}.subRecipes`}
        control={control}
        register={register}
      />
      <NotesArray
        name={`${baseName}.notes`}
        control={control}
        register={register}
      />
    </FieldGroup>
  );
}

function TextField({
  label,
  name,
  register,
  errors,
  serverErrors,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  register: RecipeRegister;
  errors: Record<string, unknown>;
  serverErrors?: Record<string, string>;
  type?: string;
  placeholder?: string;
}) {
  const error = getFieldError(errors, serverErrors, name);

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        {...register(name)}
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function TextareaField({
  label,
  name,
  register,
  errors,
  serverErrors,
}: {
  label: string;
  name: string;
  register: RecipeRegister;
  errors: Record<string, unknown>;
  serverErrors?: Record<string, string>;
}) {
  const error = getFieldError(errors, serverErrors, name);

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea id={name} aria-invalid={Boolean(error)} {...register(name)} />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function IngredientsArray({
  title,
  name,
  control,
  register,
}: {
  title: string;
  name: string;
  control: RecipeControl;
  register: RecipeRegister;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });

  return (
    <FieldSet>
      <ArrayHeader
        title={title}
        onAdd={() => append({ ...blankIngredient })}
        addLabel="Ajouter un ingredient"
      />
      <div className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_7rem_7rem_1fr_auto]">
              <Input placeholder="Nom" {...register(`${name}.${index}.name`)} />
              <Input
                placeholder="Quantite"
                {...register(`${name}.${index}.quantity`)}
              />
              <Input placeholder="Unite" {...register(`${name}.${index}.unit`)} />
              <Input placeholder="Notes" {...register(`${name}.${index}.notes`)} />
              <ArrayControls
                index={index}
                length={fields.length}
                onMove={move}
                onRemove={remove}
              />
            </div>
          </div>
        ))}
      </div>
    </FieldSet>
  );
}

function SectionsArray({
  name,
  control,
  register,
}: {
  name: string;
  control: RecipeControl;
  register: RecipeRegister;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });

  return (
    <FieldSet>
      <ArrayHeader
        title="Sections"
        onAdd={() => append({ title: "", steps: [""] })}
        addLabel="Ajouter une section"
      />
      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                placeholder="Titre de section"
                {...register(`${name}.${index}.title`)}
              />
              <ArrayControls
                index={index}
                length={fields.length}
                onMove={move}
                onRemove={remove}
              />
            </div>
            <StepsArray
              name={`${name}.${index}.steps`}
              control={control}
              register={register}
            />
          </div>
        ))}
      </div>
    </FieldSet>
  );
}

function StepsArray({
  name,
  control,
  register,
}: {
  name: string;
  control: RecipeControl;
  register: RecipeRegister;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <FieldTitle>Etapes</FieldTitle>
        <Button type="button" variant="outline" size="sm" onClick={() => append("")}>
          <ListPlus data-icon="inline-start" />
          Ajouter
        </Button>
      </div>
      {fields.map((field, index) => (
        <div key={field.id} className="grid gap-2 md:grid-cols-[1fr_auto]">
          <Textarea placeholder={`Etape ${index + 1}`} {...register(`${name}.${index}`)} />
          <ArrayControls
            index={index}
            length={fields.length}
            onMove={move}
            onRemove={remove}
          />
        </div>
      ))}
    </div>
  );
}

function SubRecipesArray({
  name,
  control,
  register,
}: {
  name: string;
  control: RecipeControl;
  register: RecipeRegister;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });

  return (
    <FieldSet>
      <ArrayHeader
        title="Sous-recettes"
        onAdd={() => append({ title: "", ingredients: [{ ...blankIngredient }] })}
        addLabel="Ajouter une sous-recette"
      />
      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div key={field.id} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                placeholder="Titre de sous-recette"
                {...register(`${name}.${index}.title`)}
              />
              <ArrayControls
                index={index}
                length={fields.length}
                onMove={move}
                onRemove={remove}
              />
            </div>
            <IngredientsArray
              title="Ingredients de sous-recette"
              name={`${name}.${index}.ingredients`}
              control={control}
              register={register}
            />
          </div>
        ))}
      </div>
    </FieldSet>
  );
}

function NotesArray({
  name,
  control,
  register,
}: {
  name: string;
  control: RecipeControl;
  register: RecipeRegister;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });

  return (
    <FieldSet>
      <ArrayHeader
        title="Notes"
        onAdd={() => append("")}
        addLabel="Ajouter une note"
      />
      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div key={field.id} className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Textarea placeholder="Note" {...register(`${name}.${index}`)} />
            <ArrayControls
              index={index}
              length={fields.length}
              onMove={move}
              onRemove={remove}
            />
          </div>
        ))}
      </div>
    </FieldSet>
  );
}

function ArrayHeader({
  title,
  addLabel,
  onAdd,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <FieldTitle>{title}</FieldTitle>
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <ListPlus data-icon="inline-start" />
        {addLabel}
      </Button>
    </div>
  );
}

function ArrayControls({
  index,
  length,
  onMove,
  onRemove,
}: {
  index: number;
  length: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <ButtonGroup>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Monter"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Descendre"
        disabled={index === length - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="icon-sm"
        aria-label="Supprimer"
        onClick={() => onRemove(index)}
      >
        <Trash2 />
      </Button>
    </ButtonGroup>
  );
}

function SaveStateAlert({
  state,
}: {
  state: {
    type: "idle" | "success" | "error";
    message: string;
  };
}) {
  if (!state.message) return null;

  return (
    <Alert variant={state.type === "error" ? "destructive" : "default"}>
      <AlertTitle>
        {state.type === "error"
          ? "Enregistrement bloque"
          : state.type === "success"
            ? "Enregistre"
            : "Edition"}
      </AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function toFormValues(recipe: EditableRecipe): RecipeFormPayload {
  return cloneRecipe({
    defaultLocale: recipe.defaultLocale,
    translations: recipe.translations,
    tags: recipe.tags,
    status: recipe.status,
  });
}

function normalizePayload(value: RecipeFormPayload) {
  return {
    ...value,
    tags: (value.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
    translations: {
      fr: normalizeLocalizedRecipe(value.translations.fr),
      en: normalizeLocalizedRecipe(value.translations.en),
    },
  };
}

function normalizeLocalizedRecipe(
  recipe: RecipeFormPayload["translations"][LocaleKey],
) {
  const servingsQuantity = Number(recipe.servings?.quantity);
  const servingsUnit = recipe.servings?.unit?.trim() ?? "";

  return {
    ...recipe,
    servings:
      Number.isFinite(servingsQuantity) && servingsQuantity > 0 && servingsUnit
        ? {
            quantity: servingsQuantity,
            unit: servingsUnit,
          }
        : null,
    ingredients: recipe.ingredients.map(normalizeIngredient),
    sections: recipe.sections.map((section) => ({
      title: section.title.trim(),
      steps: section.steps.map((step) => step.trim()).filter(Boolean),
    })),
    subRecipes: recipe.subRecipes.map((subRecipe) => ({
      title: subRecipe.title.trim(),
      ingredients: subRecipe.ingredients.map(normalizeIngredient),
    })),
    notes: recipe.notes.map((note) => note.trim()).filter(Boolean),
  };
}

function normalizeIngredient(
  ingredient: RecipeFormPayload["translations"][LocaleKey]["ingredients"][number],
) {
  return {
    name: ingredient.name.trim(),
    quantity: ingredient.quantity.trim(),
    unit: ingredient.unit.trim(),
    notes: ingredient.notes.trim(),
  };
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function cloneRecipe(recipe: RecipeFormPayload): RecipeFormPayload {
  return JSON.parse(JSON.stringify(recipe)) as RecipeFormPayload;
}

function getFieldError(
  errors: Record<string, unknown>,
  serverErrors: Record<string, string> | undefined,
  name: string,
) {
  if (serverErrors?.[name]) return serverErrors[name];

  const error = name
    .split(".")
    .reduce<unknown>((current, part) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[part];
    }, errors);

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "";
}
