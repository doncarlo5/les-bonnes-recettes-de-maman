"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormReturn,
} from "react-hook-form";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  CirclePlus,
  Clock3,
  Cloud,
  CloudOff,
  Languages,
  GripVertical,
  ListChecks,
  ListPlus,
  NotebookPen,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  TriangleAlert,
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
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
import type { EditableRecipe, EditableRecipeSummary } from "./types";

type AdminRecipeEditorProps = {
  locale: Locale;
  recipes: EditableRecipeSummary[];
  initialRecipe?: EditableRecipe;
  initialSlug?: string;
  startInCreateMode?: boolean;
};

type SaveRecipeState = {
  type: "idle" | "success" | "error" | "conflict";
  message: string;
  slug?: string;
  revision?: number;
  updatedAt?: number;
  latestRevision?: number;
  fieldErrors?: Record<string, string>;
};

type SyncState = "idle" | "saving" | "saved" | "offline" | "error" | "conflict";
type MobileSection =
  | "overview"
  | "essentials"
  | "photo"
  | "details"
  | "ingredients"
  | "preparation"
  | "notes"
  | "translation"
  | "publish";

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
  initialRecipe: initialRecipeProp,
  initialSlug,
  startInCreateMode = false,
}: AdminRecipeEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [state, setState] = useState<SaveRecipeState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const initialRecipe = startInCreateMode ? null : initialRecipeProp ?? null;
  const [selectedSlug, setSelectedSlug] = useState(initialRecipe?.slug ?? "");
  const [mode, setMode] = useState<RecipeFormMode>(
    startInCreateMode ? "create" : "update",
  );
  const [revision, setRevision] = useState(initialRecipe?.revision ?? 0);
  const formRef = useRef<HTMLFormElement>(null);
  const payloadRef = useRef<HTMLInputElement>(null);
  const submitRequestedRef = useRef(false);
  const revisionRef = useRef(initialRecipe?.revision ?? 0);
  const saveInFlightRef = useRef(false);
  const queuedPayloadRef = useRef<RecipeFormPayload | null>(null);
  const queuedForceRef = useRef(false);
  const queuedSaveWaitersRef = useRef<Array<(saved: boolean) => void>>([]);
  const savePayloadRef = useRef<((payload: RecipeFormPayload, force?: boolean) => Promise<boolean>) | null>(null);
  const [initialSavedPayload] = useState(() =>
    JSON.stringify(
      normalizePayload(initialRecipe ? toFormValues(initialRecipe) : blankRecipe),
    ),
  );
  const lastSavedPayloadRef = useRef(initialSavedPayload);

  const selectedRecipe = useMemo(
    () => initialRecipeProp?.slug === selectedSlug ? initialRecipeProp : null,
    [initialRecipeProp, selectedSlug],
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
  const watchedValues = useWatch({ control: form.control });
  const mobileSection = normalizeMobileSection(searchParams.get("section"));

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

  async function selectRecipe(slug: string) {
    if (!slug) return;
    if (!(await flushLatestDraft())) return;
    router.push(`/${locale}/admin/recettes?slug=${slug}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function createRecipe() {
    if (!(await flushLatestDraft())) return;
    setMode("create");
    setSelectedSlug("");
    reset(cloneRecipe(blankRecipe));
    setRevision(0);
    revisionRef.current = 0;
    lastSavedPayloadRef.current = JSON.stringify(normalizePayload(blankRecipe));
    router.replace(`/${locale}/admin/recettes?new=1`);
  }

  async function showMobileHome() {
    if (!(await flushLatestDraft())) return;
    setSelectedSlug("");
    setMode("update");
    setSyncState("idle");
    router.push(`/${locale}/admin/recettes`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const savePayload = useCallback(
    async (payload: RecipeFormPayload, force = false) => {
      if (saveInFlightRef.current) {
        queuedPayloadRef.current = payload;
        queuedForceRef.current ||= force;
        return new Promise<boolean>((resolve) => {
          queuedSaveWaitersRef.current.push(resolve);
        });
      }

      const normalized = normalizePayload(payload);
      const recipePayload = JSON.stringify(normalized);
      if (!force && recipePayload === lastSavedPayloadRef.current) return true;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (selectedSlug) {
          localStorage.setItem(
            recoveryKey(selectedSlug),
            JSON.stringify({ payload: normalized, revision: revisionRef.current }),
          );
        }
        setSyncState("offline");
        return false;
      }

      saveInFlightRef.current = true;
      submitRequestedRef.current = true;
      setIsPending(true);
      setSyncState("saving");

      let saved = false;
      try {
        const response = await fetch("/api/admin/recipes/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            mode,
            slug: selectedSlug,
            recipePayload,
            expectedRevision: revisionRef.current,
            force,
          }),
        });
        const data = (await response.json()) as SaveRecipeState;
        setState(data);

        if (response.status === 409 || data.type === "conflict") {
          setSyncState("conflict");
          return false;
        }

        if (!response.ok || data.type !== "success" || !data.slug) {
          setSyncState("error");
          return false;
        }

        const nextRevision = data.revision ?? revisionRef.current;
        revisionRef.current = nextRevision;
        setRevision(nextRevision);
        lastSavedPayloadRef.current = recipePayload;
        localStorage.removeItem(recoveryKey(data.slug));
        setSyncState("saved");

        if (mode === "create") {
          setMode("update");
          setSelectedSlug(data.slug);
          router.replace(`/${locale}/admin/recettes?slug=${data.slug}`);
          router.refresh();
        }
        saved = true;
      } catch {
        if (selectedSlug) {
          localStorage.setItem(
            recoveryKey(selectedSlug),
            JSON.stringify({ payload: normalized, revision: revisionRef.current }),
          );
        }
        setSyncState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
        setState({ type: "error", message: "Impossible d'enregistrer cette recette." });
        saved = false;
      } finally {
        saveInFlightRef.current = false;
        submitRequestedRef.current = false;
        setIsPending(false);
        const queued = queuedPayloadRef.current;
        const queuedForce = queuedForceRef.current;
        const waiters = queuedSaveWaitersRef.current;
        queuedPayloadRef.current = null;
        queuedForceRef.current = false;
        queuedSaveWaitersRef.current = [];
        if (queued && savePayloadRef.current) {
          const queuedSaved = await savePayloadRef.current(queued, queuedForce);
          saved = saved && queuedSaved;
          for (const resolve of waiters) resolve(queuedSaved);
        } else {
          for (const resolve of waiters) resolve(saved);
        }
      }
      return saved;
    },
    [locale, mode, router, selectedSlug],
  );
  useEffect(() => {
    savePayloadRef.current = savePayload;
  }, [savePayload]);

  useEffect(() => {
    if (mode !== "update" || !selectedSlug || !watchedValues) return;
    const timer = window.setTimeout(() => {
      void savePayload(watchedValues as RecipeFormPayload);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [mode, savePayload, selectedSlug, watchedValues]);

  useEffect(() => {
    if (!selectedSlug) return;
    const recovered = localStorage.getItem(recoveryKey(selectedSlug));
    if (!recovered) return;
    try {
      const parsed = JSON.parse(recovered) as { payload?: RecipeFormPayload; revision?: number };
      if (parsed.payload && parsed.revision === revisionRef.current) {
        reset(parsed.payload);
        queueMicrotask(() => setSyncState("offline"));
      }
    } catch {
      localStorage.removeItem(recoveryKey(selectedSlug));
    }
  }, [reset, selectedSlug]);

  const retryOnlineSave = useEffectEvent(() => {
    if (syncState === "offline") void savePayload(getValues());
  });

  useEffect(() => {
    const retry = () => retryOnlineSave();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await savePayload(getValues(), syncState === "conflict");
  }

  useEffect(() => {
    if (!selectedRecipe || selectedRecipe.slug !== selectedSlug) return;
    if (
      selectedRecipe.revision !== revisionRef.current ||
      selectedRecipe.status !== getValues("status")
    ) {
      reset(toFormValues(selectedRecipe));
      revisionRef.current = selectedRecipe.revision;
      setRevision(selectedRecipe.revision);
      lastSavedPayloadRef.current = JSON.stringify(
        normalizePayload(toFormValues(selectedRecipe)),
      );
    }
  }, [getValues, reset, selectedRecipe, selectedSlug]);

  async function flushLatestDraft() {
    if (mode !== "update" || !selectedSlug) return true;

    while (true) {
      const saved = await savePayload(getValues());
      if (!saved) return false;
      const latestPayload = JSON.stringify(normalizePayload(getValues()));
      if (
        latestPayload === lastSavedPayloadRef.current &&
        !saveInFlightRef.current &&
        !queuedPayloadRef.current
      ) {
        return true;
      }
    }
  }

  function openMobileSection(section: MobileSection) {
    if (!selectedSlug) return;
    const params = new URLSearchParams({ slug: selectedSlug });
    if (section !== "overview") params.set("section", section);
    params.set(
      "lang",
      section === "translation"
        ? defaultLocale === "fr" ? "en" : "fr"
        : defaultLocale,
    );
    router.push(`/${locale}/admin/recettes?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function publishRecipe() {
    if (!selectedSlug || isPending) return;
    const draftSaved = await flushLatestDraft();
    if (!draftSaved) return;
    setIsPending(true);
    try {
      const response = await fetch("/api/admin/recipes/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug, expectedRevision: revisionRef.current }),
      });
      const data = (await response.json()) as SaveRecipeState;
      setState(data);
      if (!response.ok) {
        setSyncState(response.status === 409 ? "conflict" : "error");
        return;
      }
      setValue("status", "published");
      setSyncState("saved");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function discardChanges() {
    if (!selectedSlug || !window.confirm("Abandonner toutes les modifications non publiees ?")) return;
    setIsPending(true);
    try {
      const response = await fetch("/api/admin/recipes/discard-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug, expectedRevision: revisionRef.current }),
      });
      const data = (await response.json()) as SaveRecipeState;
      setState(data);
      if (response.ok && typeof data.revision === "number") {
        revisionRef.current = data.revision;
        setRevision(data.revision);
        localStorage.removeItem(recoveryKey(selectedSlug));
        setSyncState("saved");
        router.refresh();
      } else {
        setSyncState(response.status === 409 ? "conflict" : "error");
      }
    } finally {
      setIsPending(false);
    }
  }

  async function unpublishRecipe() {
    if (!selectedSlug || !window.confirm("Retirer cette recette du site public ?")) return;
    setIsPending(true);
    try {
      const response = await fetch("/api/admin/recipes/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug }),
      });
      if (response.ok) {
        setValue("status", "draft");
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  function handleImageRevision(nextRevision: number) {
    revisionRef.current = nextRevision;
    setRevision(nextRevision);
    setSyncState("saved");
    router.refresh();
  }

  if (isMobile) {
    return (
      <MobileRecipeAdmin
        locale={locale}
        recipes={recipes}
        selectedRecipe={selectedRecipe}
        selectedSlug={selectedSlug}
        mode={mode}
        section={mobileSection}
        syncState={syncState}
        revision={revision}
        isPending={isPending}
        state={state}
        form={form}
        tagsValue={tagsValue ?? []}
        defaultLocale={defaultLocale}
        onCreate={createRecipe}
        onHome={showMobileHome}
        onSelect={selectRecipe}
        onOpenSection={openMobileSection}
        onSave={() => savePayload(getValues(), syncState === "conflict")}
        onPublish={publishRecipe}
        onDiscard={discardChanges}
        onUnpublish={unpublishRecipe}
        onImageRevision={handleImageRevision}
      />
    );
  }

  if (!selectedSlug && !startInCreateMode) {
    return (
      <main className="min-h-screen px-5 py-8 text-foreground sm:px-6">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div className="flex items-end justify-between gap-4">
            <div className="grid gap-3"><p className="eyebrow">Admin recettes</p><h1 className="font-heading text-5xl font-black leading-none">Recettes</h1></div>
            <Button type="button" onClick={createRecipe}><CirclePlus data-icon="inline-start" />Nouvelle recette</Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
            <RecipeTable recipes={recipes} selectedSlug="" onSelectRecipe={selectRecipe} />
            <div className="grid min-h-80 place-items-center rounded-2xl bg-card p-8 text-center shadow-[var(--shadow-card)]"><div className="max-w-sm"><BookOpen className="mx-auto size-8 text-primary" /><h2 className="mt-4 font-heading text-2xl font-black">Choisis une recette</h2><p className="mt-2 text-sm font-semibold text-muted-foreground">Sélectionne une recette dans la liste pour ouvrir son Brouillon de travail.</p></div></div>
          </div>
        </section>
      </main>
    );
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
              <div className="flex gap-2">
              <Button type="submit" variant="outline" disabled={isPending}>
                {isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {isPending ? "Enregistrement..." : "Sauvegarder le brouillon"}
              </Button>
              <Button type="button" disabled={isPending || getRecipeReadiness(getValues(), selectedRecipe?.heroImageUrl ?? "").blockers.length > 0} onClick={publishRecipe}>
                <Send data-icon="inline-start" /> Publier
              </Button>
              </div>
            </div>

            <SaveStateAlert state={state} />

            <AdminRecipeImagePanel
              key={selectedRecipe?.slug ?? "new-recipe-image"}
              locale={locale}
              recipe={selectedRecipe}
              revision={revision}
              onRevisionChange={handleImageRevision}
            />

            <FieldGroup>
              <div className="grid gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel>Version publique</FieldLabel>
                  <div className="flex h-8 items-center"><Badge variant={status === "published" ? "default" : "secondary"}>{status === "published" ? "Publiée" : "Non publiée"}</Badge></div>
                  <FieldDescription>La publication est une action explicite.</FieldDescription>
                </Field>
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

function MobileRecipeAdmin({
  locale,
  recipes,
  selectedRecipe,
  selectedSlug,
  mode,
  section,
  syncState,
  revision,
  isPending,
  state,
  form,
  tagsValue,
  defaultLocale,
  onCreate,
  onHome,
  onSelect,
  onOpenSection,
  onSave,
  onPublish,
  onDiscard,
  onUnpublish,
  onImageRevision,
}: {
  locale: Locale;
  recipes: EditableRecipeSummary[];
  selectedRecipe: EditableRecipe | null;
  selectedSlug: string;
  mode: RecipeFormMode;
  section: MobileSection;
  syncState: SyncState;
  revision: number;
  isPending: boolean;
  state: SaveRecipeState;
  form: UseFormReturn<any>;
  tagsValue: string[];
  defaultLocale: LocaleKey;
  onCreate: () => void;
  onHome: () => void;
  onSelect: (slug: string) => void;
  onOpenSection: (section: MobileSection) => void;
  onSave: () => void;
  onPublish: () => void;
  onDiscard: () => void;
  onUnpublish: () => void;
  onImageRevision: (revision: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const values = useWatch({ control: form.control }) as RecipeFormPayload;
  const readiness = getRecipeReadiness(
    values,
    selectedRecipe?.heroImageUrl ?? "",
  );

  if (!selectedSlug && mode !== "create") {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const visibleRecipes = recipes.filter((recipe) => {
      const matchesFilter = filter === "all" || recipe.status === filter;
      const haystack = `${recipe.title} ${recipe.slug} ${recipe.tags.join(" ")}`.toLocaleLowerCase(locale);
      return matchesFilter && (!normalizedQuery || haystack.includes(normalizedQuery));
    });

    return (
      <main className="min-h-screen px-4 pb-28 pt-6 text-foreground">
        <header className="mx-auto grid w-full max-w-lg gap-5">
          <div className="flex items-end justify-between gap-4">
            <div className="grid gap-2">
              <p className="eyebrow">Admin recettes</p>
              <h1 className="font-heading text-4xl font-black leading-none">Le carnet</h1>
              <p className="text-sm font-semibold text-muted-foreground">{recipes.length} recettes à portée de main.</p>
            </div>
            <Button type="button" onClick={onCreate} className="min-h-11 rounded-xl px-4 active:scale-[0.96] transition-transform">
              <CirclePlus data-icon="inline-start" /> Nouvelle
            </Button>
          </div>

          <div className="rounded-2xl bg-card p-2 shadow-[var(--shadow-card)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une recette" className="h-11 rounded-xl border-0 bg-muted/60 pl-10 shadow-none" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1" aria-label="Filtrer les recettes">
              {(["all", "draft", "published"] as const).map((value) => (
                <Button key={value} type="button" variant={filter === value ? "secondary" : "ghost"} onClick={() => setFilter(value)} className="min-h-11 rounded-xl">
                  {value === "all" ? "Toutes" : value === "draft" ? "Brouillons" : "Publiées"}
                </Button>
              ))}
            </div>
          </div>
        </header>

        <section className="mx-auto mt-5 grid w-full max-w-lg gap-3" aria-label="Recettes">
          {visibleRecipes.map((recipe) => (
            <button key={recipe._id} type="button" onClick={() => onSelect(recipe.slug)} className="group grid min-h-24 grid-cols-[5rem_1fr_auto] items-center gap-3 rounded-2xl bg-card p-2 text-left shadow-[var(--shadow-card)] transition-[box-shadow,scale] duration-150 active:scale-[0.96]">
              <div className="relative size-20 overflow-hidden rounded-xl bg-muted">
                {recipe.heroImageUrl ? <Image src={recipe.heroImageUrl} alt="" fill sizes="80px" className="object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" /> : <div className="grid size-full place-items-center"><Camera className="size-5 text-muted-foreground" /></div>}
              </div>
              <span className="min-w-0">
                <span className="line-clamp-2 font-heading text-lg font-black leading-tight">{recipe.title || "Recette sans titre"}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  {recipe.status === "published" ? "Publiée" : "Brouillon"}
                  {recipe.hasUnpublishedChanges ? <><span aria-hidden>·</span><span className="text-primary">Modifications</span></> : null}
                </span>
              </span>
              <ChevronRight className="mr-1 size-5 text-muted-foreground transition-transform group-active:translate-x-0.5" />
            </button>
          ))}
          {visibleRecipes.length === 0 ? <div className="rounded-2xl bg-card p-8 text-center text-sm font-semibold text-muted-foreground shadow-[var(--shadow-card)]">Aucune recette ne correspond.</div> : null}
        </section>
      </main>
    );
  }

  if (mode === "create" && !selectedSlug) {
    return (
      <main className="min-h-screen px-4 py-6 text-foreground">
        <div className="mx-auto grid w-full max-w-lg gap-6">
          <button type="button" onClick={onHome} className="flex min-h-11 items-center gap-2 justify-self-start font-bold"><ArrowLeft /> Le carnet</button>
          <div className="grid gap-2"><p className="eyebrow">Nouveau brouillon</p><h1 className="font-heading text-4xl font-black leading-tight">Comment s’appelle cette recette&nbsp;?</h1><p className="font-semibold text-muted-foreground">Le titre crée immédiatement un brouillon privé. Tu pourras tout compléter ensuite.</p></div>
          <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <TextField label="Titre français" name="translations.fr.title" register={form.register} errors={form.formState.errors} autoFocus />
          </div>
          <Button type="button" size="lg" disabled={isPending || !values.translations.fr.title.trim()} onClick={onSave} className="min-h-12 rounded-xl active:scale-[0.96] transition-transform">
            {isPending ? <Spinner data-icon="inline-start" /> : <NotebookPen data-icon="inline-start" />} Commencer la recette
          </Button>
        </div>
      </main>
    );
  }

  const sectionTitle = mobileSectionTitle(section);

  return (
    <main className="min-h-screen px-4 pb-28 pt-4 text-foreground">
      <div className="mx-auto w-full max-w-lg">
        <header className="sticky top-0 z-20 -mx-4 mb-4 flex min-h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Button type="button" variant="ghost" size="icon" onClick={() => section === "overview" ? onHome() : onOpenSection("overview")} className="size-11 rounded-full" aria-label={section === "overview" ? "Retour au carnet" : "Retour à la recette"}><ArrowLeft /></Button>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{sectionTitle}</p><h1 className="truncate font-heading text-lg font-black">{values.translations[defaultLocale]?.title || "Recette sans titre"}</h1></div>
          <SyncPill state={syncState} revision={revision} />
        </header>

        {syncState === "conflict" ? <ConflictCard onReload={() => window.location.reload()} onReplace={onSave} /> : null}
        {state.type === "error" ? <SaveStateAlert state={state} /> : null}

        {section === "overview" ? (
          <MobileOverview recipe={selectedRecipe} values={values} readiness={readiness} onOpen={onOpenSection} />
        ) : (
          <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <MobileSectionFields section={section} locale={locale} recipe={selectedRecipe} revision={revision} onImageRevision={onImageRevision} form={form} tagsValue={tagsValue} defaultLocale={defaultLocale} readiness={readiness} isPending={isPending} onPublish={onPublish} onDiscard={onDiscard} onUnpublish={onUnpublish} />
          </section>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur" aria-label="Actions de la recette">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenSection("overview")} className="min-h-11 flex-col gap-0 rounded-xl text-xs"><BookOpen /> Recette</Button>
          <Button type="button" variant="ghost" onClick={() => onOpenSection("photo")} className="min-h-11 flex-col gap-0 rounded-xl text-xs"><Camera /> Photo</Button>
          <Button type="button" onClick={() => onOpenSection("publish")} className="min-h-11 flex-col gap-0 rounded-xl text-xs active:scale-[0.96] transition-transform"><Send /> Publier</Button>
        </div>
      </nav>
    </main>
  );
}

function MobileOverview({ recipe, values, readiness, onOpen }: { recipe: EditableRecipe | null; values: RecipeFormPayload; readiness: RecipeReadiness; onOpen: (section: MobileSection) => void }) {
  const sections: { id: MobileSection; title: string; detail: string; icon: typeof Camera; complete: boolean }[] = [
    { id: "essentials", title: "L’essentiel", detail: "Titre, auteur et description", icon: NotebookPen, complete: readiness.essentials },
    { id: "photo", title: "Photo", detail: "Couverture de la recette", icon: Camera, complete: readiness.image },
    { id: "details", title: "Détails", detail: "Portions, temps et température", icon: Clock3, complete: readiness.details },
    { id: "ingredients", title: "Ingrédients", detail: `${values.translations[values.defaultLocale].ingredients.filter((item) => item.name.trim()).length} éléments`, icon: ListChecks, complete: readiness.ingredients },
    { id: "preparation", title: "Préparation", detail: "Sections, étapes et sous-recettes", icon: BookOpen, complete: readiness.preparation },
    { id: "notes", title: "Notes", detail: "Astuces et variantes", icon: NotebookPen, complete: true },
    { id: "translation", title: "Traduction", detail: "Version anglaise", icon: Languages, complete: readiness.translation },
  ];

  return <div className="grid gap-4">
    <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
      <div className="relative aspect-[16/9] bg-muted">{recipe?.heroImageUrl ? <Image src={recipe.heroImageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 32rem" className="object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" /> : <div className="grid size-full place-items-center gap-2 text-muted-foreground"><Camera /><span className="text-sm font-bold">Ajouter une photo</span></div>}</div>
      <div className="flex items-center justify-between gap-3 p-4"><div><Badge variant={values.status === "published" ? "default" : "secondary"}>{values.status === "published" ? "Version publiée" : "Brouillon"}</Badge><p className="mt-2 text-sm font-semibold text-muted-foreground">{readiness.blockers.length === 0 ? "Prête à publier" : `${readiness.blockers.length} point${readiness.blockers.length > 1 ? "s" : ""} à compléter`}</p></div><Button type="button" variant="outline" onClick={() => onOpen("publish")} className="min-h-11 rounded-xl">Vérifier <ChevronRight /></Button></div>
    </div>
    <div className="grid gap-2">{sections.map(({ id, title, detail, icon: Icon, complete }) => <button key={id} type="button" onClick={() => onOpen(id)} className="grid min-h-17 grid-cols-[2.75rem_1fr_auto] items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-[var(--shadow-card)] transition-[scale,box-shadow] active:scale-[0.96]"><span className="grid size-11 place-items-center rounded-xl bg-muted"><Icon className="size-5" /></span><span><span className="block font-black">{title}</span><span className="block text-xs font-semibold text-muted-foreground">{detail}</span></span>{complete ? <Check className="size-5 text-green-600" /> : <ChevronRight className="size-5 text-muted-foreground" />}</button>)}</div>
  </div>;
}

function MobileSectionFields({ section, locale, recipe, revision, onImageRevision, form, tagsValue, defaultLocale, readiness, isPending, onPublish, onDiscard, onUnpublish }: { section: MobileSection; locale: Locale; recipe: EditableRecipe | null; revision: number; onImageRevision: (revision: number) => void; form: UseFormReturn<any>; tagsValue: string[]; defaultLocale: LocaleKey; readiness: RecipeReadiness; isPending: boolean; onPublish: () => void; onDiscard: () => void; onUnpublish: () => void }) {
  const base = `translations.${defaultLocale}`;
  const errors = form.formState.errors;
  if (section === "photo") return <AdminRecipeImagePanel locale={locale} recipe={recipe} revision={revision} onRevisionChange={onImageRevision} />;
  if (section === "essentials") return <FieldGroup><TextField label="Titre" name={`${base}.title`} register={form.register} errors={errors} /><TextField label="Auteur" name={`${base}.author`} register={form.register} errors={errors} /><TextareaField label="Description" name={`${base}.description`} register={form.register} errors={errors} /><SelectField label="Langue principale" value={defaultLocale} onValueChange={(value) => form.setValue("defaultLocale", value, { shouldDirty: true })} options={[{ label: "Français", value: "fr" }, { label: "Anglais", value: "en" }]} /><Field><FieldLabel htmlFor="mobile-tags">Catégories</FieldLabel><Input id="mobile-tags" className="h-11" value={tagsValue.join(", ")} onChange={(event) => form.setValue("tags", parseTags(event.target.value), { shouldDirty: true })} /><FieldDescription>Sépare les catégories par des virgules.</FieldDescription></Field></FieldGroup>;
  if (section === "details") return <FieldGroup><TextField label="Portions" name={`${base}.servings.quantity`} type="number" register={form.register} errors={errors} /><TextField label="Unité" name={`${base}.servings.unit`} register={form.register} errors={errors} placeholder="personnes" /><TextField label="Préparation" name={`${base}.prepTime`} register={form.register} errors={errors} placeholder="20 min" /><TextField label="Cuisson" name={`${base}.cookTime`} register={form.register} errors={errors} placeholder="25 min" /><TextField label="Total" name={`${base}.totalTime`} register={form.register} errors={errors} placeholder="45 min" /><TextField label="Libellé temps" name={`${base}.timeLabel`} register={form.register} errors={errors} placeholder="45 min" /><TextField label="Température" name={`${base}.temperature`} register={form.register} errors={errors} placeholder="180 °C" /></FieldGroup>;
  if (section === "ingredients") return <IngredientsArray title="Ingrédients" name={`${base}.ingredients`} control={form.control} register={form.register} compact />;
  if (section === "preparation") return <FieldGroup><CompactSectionsArray name={`${base}.sections`} control={form.control} register={form.register} /><SubRecipesArray name={`${base}.subRecipes`} control={form.control} register={form.register} /></FieldGroup>;
  if (section === "notes") return <NotesArray name={`${base}.notes`} control={form.control} register={form.register} />;
  if (section === "translation") { const translationLocale = defaultLocale === "fr" ? "en" : "fr"; return <div className="grid gap-4"><div className="rounded-xl bg-muted p-3 text-sm font-bold">Traduction {translationLocale === "en" ? "anglaise" : "française"}</div><LocalizedRecipeFields localeKey={translationLocale} register={form.register} control={form.control} errors={errors} /></div>; }
  if (section === "publish") return <PublishWorkspace recipe={recipe} readiness={readiness} isPending={isPending} onPublish={onPublish} onDiscard={onDiscard} onUnpublish={onUnpublish} />;
  return null;
}

function PublishWorkspace({ recipe, readiness, isPending, onPublish, onDiscard, onUnpublish }: { recipe: EditableRecipe | null; readiness: RecipeReadiness; isPending: boolean; onPublish: () => void; onDiscard: () => void; onUnpublish: () => void }) {
  return <div className="grid gap-5"><div><p className="eyebrow">État de préparation</p><h2 className="mt-2 font-heading text-3xl font-black">Avant de publier</h2></div>{readiness.blockers.length ? <div className="grid gap-2"><h3 className="font-black text-destructive">À compléter</h3>{readiness.blockers.map((item) => <div key={item} className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive"><TriangleAlert className="size-5 shrink-0" />{item}</div>)}</div> : <div className="flex gap-3 rounded-xl bg-green-600/10 p-4 font-bold text-green-700 dark:text-green-400"><Check className="size-5" />La version française est prête.</div>}{readiness.warnings.length ? <div className="grid gap-2"><h3 className="font-black">Conseils</h3>{readiness.warnings.map((item) => <div key={item} className="rounded-xl bg-muted p-3 text-sm font-semibold">{item}</div>)}</div> : null}{recipe?.status === "published" ? <a href={`../recettes/${recipe.slug}`} target="_blank" className="flex min-h-11 items-center justify-center rounded-xl bg-muted px-4 font-black">Voir la version publiée</a> : null}<Button type="button" size="lg" disabled={isPending || readiness.blockers.length > 0} onClick={onPublish} className="min-h-12 rounded-xl active:scale-[0.96] transition-transform">{isPending ? <Spinner /> : <Send />} {recipe?.status === "published" ? "Publier les modifications" : "Publier la recette"}</Button>{recipe?.hasUnpublishedChanges ? <Button type="button" variant="outline" onClick={onDiscard} className="min-h-11 rounded-xl">Abandonner les modifications</Button> : null}{recipe?.status === "published" ? <Button type="button" variant="destructive" onClick={onUnpublish} className="min-h-11 rounded-xl">Retirer du site public</Button> : null}</div>;
}

function SyncPill({ state, revision }: { state: SyncState; revision: number }) {
  const Icon = state === "saving" ? RefreshCw : state === "offline" || state === "error" ? CloudOff : Cloud;
  const label = state === "saving" ? "Sauvegarde" : state === "offline" ? "Hors ligne" : state === "error" ? "Erreur" : state === "conflict" ? "Conflit" : "Enregistré";
  return <span title={`Révision ${revision}`} className="flex min-h-9 items-center gap-1 rounded-full bg-muted px-2.5 text-[0.68rem] font-black"><Icon className={`size-3.5 ${state === "saving" ? "animate-spin" : ""}`} />{label}</span>;
}

function ConflictCard({ onReload, onReplace }: { onReload: () => void; onReplace: () => void }) {
  return <div className="mb-4 rounded-2xl bg-destructive/10 p-4 shadow-[var(--shadow-card)]"><div className="flex gap-3"><TriangleAlert className="size-5 shrink-0 text-destructive" /><div><h2 className="font-black">Modifications sur un autre appareil</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">Recharge la version la plus récente ou remplace-la avec le contenu de ce téléphone.</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={onReload} className="min-h-11">Recharger</Button><Button type="button" variant="destructive" onClick={onReplace} className="min-h-11">Remplacer</Button></div></div>;
}

type RecipeReadiness = { essentials: boolean; image: boolean; details: boolean; ingredients: boolean; preparation: boolean; translation: boolean; blockers: string[]; warnings: string[] };

function getRecipeReadiness(recipe: RecipeFormPayload, heroImageUrl: string): RecipeReadiness {
  const fr = recipe.translations.fr;
  const essentials = Boolean(fr.title.trim() && fr.author.trim() && fr.description.trim());
  const details = [fr.prepTime, fr.cookTime, fr.totalTime, fr.timeLabel].some((value) => value.trim());
  const ingredients = fr.ingredients.some((item) => item.name.trim());
  const preparation = fr.sections.some((item) => item.title.trim() && item.steps.some((step) => step.trim()));
  const en = recipe.translations.en;
  const translation = Boolean(en.title.trim() && en.description.trim() && en.ingredients.some((item) => item.name.trim()));
  const blockers = [...(!fr.title.trim() ? ["Ajoute un titre français."] : []), ...(!fr.author.trim() ? ["Ajoute l’auteur."] : []), ...(!fr.description.trim() ? ["Ajoute une description française."] : []), ...(!details ? ["Indique au moins un temps."] : []), ...(!ingredients ? ["Ajoute au moins un ingrédient."] : []), ...(!preparation ? ["Ajoute une section avec une étape."] : [])];
  const warnings = [...(!heroImageUrl ? ["Une photo rendra la recette plus facile à reconnaître."] : []), ...(!translation ? ["La traduction anglaise est encore incomplète."] : [])];
  return { essentials, image: Boolean(heroImageUrl), details, ingredients, preparation, translation, blockers, warnings };
}

function mobileSectionTitle(section: MobileSection) {
  return ({ overview: "Vue d’ensemble", essentials: "L’essentiel", photo: "Photo", details: "Détails", ingredients: "Ingrédients", preparation: "Préparation", notes: "Notes", translation: "Traduction", publish: "Publication" } as const)[section];
}

function normalizeMobileSection(value: string | null): MobileSection {
  const sections: MobileSection[] = ["overview", "essentials", "photo", "details", "ingredients", "preparation", "notes", "translation", "publish"];
  return sections.includes(value as MobileSection) ? (value as MobileSection) : "overview";
}

function recoveryKey(slug: string) {
  return `recipe-admin-draft:v1:${slug}`;
}

function RecipeTable({
  recipes,
  selectedSlug,
  onSelectRecipe,
}: {
  recipes: EditableRecipeSummary[];
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
  autoFocus = false,
}: {
  label: string;
  name: string;
  register: RecipeRegister;
  errors: Record<string, unknown>;
  serverErrors?: Record<string, string>;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const error = getFieldError(errors, serverErrors, name);

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        className="h-11 md:h-8"
        type={type}
        placeholder={placeholder}
      aria-invalid={Boolean(error)}
      autoFocus={autoFocus}
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
        <SelectTrigger className="h-11 w-full md:h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} className="min-h-11 md:min-h-8">
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
  compact = false,
}: {
  title: string;
  name: string;
  control: RecipeControl;
  register: RecipeRegister;
  compact?: boolean;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const ingredientValues = useWatch({ control, name }) ?? [];

  if (compact) {
    return (
      <FieldSet>
        <ArrayHeader
          title={title}
          onAdd={() => {
            append({ ...blankIngredient });
            setEditingIndex(fields.length);
          }}
          addLabel="Ajouter un ingredient"
        />
        <div className="grid gap-2">
          {fields.map((field, index) => {
            const ingredient = ingredientValues[index] ?? blankIngredient;
            const summary = [ingredient.quantity, ingredient.unit, ingredient.name]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={field.id}
                type="button"
                onClick={() => setEditingIndex(index)}
                className="grid min-h-14 grid-cols-[2.75rem_1fr_auto] items-center gap-2 rounded-xl bg-muted/55 p-2 text-left transition-[scale,background-color] active:scale-[0.96]"
              >
                <span className="grid size-11 place-items-center rounded-lg bg-card"><GripVertical className="size-5 text-muted-foreground" /></span>
                <span className="min-w-0"><span className="block truncate font-black">{summary || `Ingrédient ${index + 1}`}</span>{ingredient.notes ? <span className="block truncate text-xs font-semibold text-muted-foreground">{ingredient.notes}</span> : null}</span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            );
          })}
        </div>
        <Drawer open={editingIndex !== null} onOpenChange={(open: boolean) => !open && setEditingIndex(null)}>
          <DrawerContent className="max-h-[92dvh] rounded-t-3xl">
            {editingIndex !== null ? (
              <>
                <DrawerHeader className="text-left">
                  <DrawerTitle className="font-heading text-2xl font-black">Ingrédient {editingIndex + 1}</DrawerTitle>
                  <DrawerDescription className="">Renseigne seulement les détails utiles à la recette.</DrawerDescription>
                </DrawerHeader>
                <div className="grid gap-3 overflow-y-auto px-4 pb-4">
                  <Field><FieldLabel>Nom</FieldLabel><Input className="h-11" autoFocus {...register(`${name}.${editingIndex}.name`)} /></Field>
                  <div className="grid grid-cols-2 gap-3"><Field><FieldLabel>Quantité</FieldLabel><Input className="h-11" {...register(`${name}.${editingIndex}.quantity`)} /></Field><Field><FieldLabel>Unité</FieldLabel><Input className="h-11" {...register(`${name}.${editingIndex}.unit`)} /></Field></div>
                  <Field><FieldLabel>Notes</FieldLabel><Input className="h-11" {...register(`${name}.${editingIndex}.notes`)} /></Field>
                </div>
                <DrawerFooter className="grid grid-cols-[1fr_1fr_auto]">
                  <Button type="button" variant="outline" className="min-h-11" disabled={editingIndex === 0} onClick={() => { move(editingIndex, editingIndex - 1); setEditingIndex(editingIndex - 1); }}><ArrowUp /> Monter</Button>
                  <Button type="button" variant="outline" className="min-h-11" disabled={editingIndex === fields.length - 1} onClick={() => { move(editingIndex, editingIndex + 1); setEditingIndex(editingIndex + 1); }}><ArrowDown /> Descendre</Button>
                  <Button type="button" variant="destructive" size="icon" className="size-11" aria-label="Supprimer cet ingrédient" onClick={() => { if (window.confirm("Supprimer cet ingrédient ?")) { remove(editingIndex); setEditingIndex(null); } }}><Trash2 /></Button>
                  <Button type="button" className="col-span-3 min-h-12 rounded-xl" onClick={() => setEditingIndex(null)}>Terminé</Button>
                </DrawerFooter>
              </>
            ) : null}
          </DrawerContent>
        </Drawer>
      </FieldSet>
    );
  }

  return (
    <FieldSet>
      <ArrayHeader
        title={title}
        onAdd={() => append({ ...blankIngredient })}
        addLabel="Ajouter un ingredient"
      />
      <div className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <div key={field.id} className={compact ? "rounded-2xl bg-muted/55 p-3" : "rounded-lg border p-3"}>
            <div className="grid gap-3 md:grid-cols-[1fr_7rem_7rem_1fr_auto]">
              <Input className={compact ? "h-11 bg-card" : undefined} placeholder="Nom" {...register(`${name}.${index}.name`)} />
              <Input
                className={compact ? "h-11 bg-card" : undefined}
                placeholder="Quantite"
                {...register(`${name}.${index}.quantity`)}
              />
              <Input className={compact ? "h-11 bg-card" : undefined} placeholder="Unite" {...register(`${name}.${index}.unit`)} />
              <Input className={compact ? "h-11 bg-card" : undefined} placeholder="Notes" {...register(`${name}.${index}.notes`)} />
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

function CompactSectionsArray({
  name,
  control,
  register,
}: {
  name: string;
  control: RecipeControl;
  register: RecipeRegister;
}) {
  const { append, fields, move, remove } = useFieldArray({ control, name });
  const values = useWatch({ control, name }) ?? [];
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return (
    <FieldSet>
      <ArrayHeader title="Sections" addLabel="Ajouter une section" onAdd={() => {
        append({ title: "", steps: [""] });
        setEditingIndex(fields.length);
      }} />
      <div className="grid gap-2">
        {fields.map((field, index) => {
          const section = values[index] ?? { title: "", steps: [] };
          return (
            <button key={field.id} type="button" onClick={() => setEditingIndex(index)} className="grid min-h-16 grid-cols-[2.75rem_1fr_auto] items-center gap-2 rounded-xl bg-muted/55 p-2 text-left transition-[scale,background-color] active:scale-[0.96]">
              <span className="grid size-11 place-items-center rounded-lg bg-card"><BookOpen className="size-5" /></span>
              <span className="min-w-0"><span className="block truncate font-black">{section.title || `Section ${index + 1}`}</span><span className="block text-xs font-semibold text-muted-foreground">{section.steps?.filter((step: string) => step.trim()).length ?? 0} étapes</span></span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>
      <Drawer open={editingIndex !== null} onOpenChange={(open: boolean) => !open && setEditingIndex(null)}>
        <DrawerContent className="max-h-[92dvh] rounded-t-3xl">
          {editingIndex !== null ? <>
            <DrawerHeader className="text-left"><DrawerTitle className="font-heading text-2xl font-black">Section {editingIndex + 1}</DrawerTitle><DrawerDescription className="">Organise les étapes dans leur ordre de préparation.</DrawerDescription></DrawerHeader>
            <div className="grid gap-4 overflow-y-auto px-4 pb-4">
              <Field><FieldLabel>Titre de section</FieldLabel><Input className="h-11" autoFocus {...register(`${name}.${editingIndex}.title`)} /></Field>
              <CompactStepsArray name={`${name}.${editingIndex}.steps`} control={control} register={register} />
            </div>
            <DrawerFooter className=""><div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={editingIndex === 0} onClick={() => { move(editingIndex, editingIndex - 1); setEditingIndex(editingIndex - 1); }}><ArrowUp /> Monter</Button><Button type="button" variant="outline" className="min-h-11" disabled={editingIndex === fields.length - 1} onClick={() => { move(editingIndex, editingIndex + 1); setEditingIndex(editingIndex + 1); }}><ArrowDown /> Descendre</Button></div><Button type="button" variant="destructive" className="min-h-11" onClick={() => { if (window.confirm("Supprimer cette section ?")) { remove(editingIndex); setEditingIndex(null); } }}><Trash2 /> Supprimer la section</Button><Button type="button" className="min-h-12 rounded-xl" onClick={() => setEditingIndex(null)}>Terminé</Button></DrawerFooter>
          </> : null}
        </DrawerContent>
      </Drawer>
    </FieldSet>
  );
}

function CompactStepsArray({ name, control, register }: { name: string; control: RecipeControl; register: RecipeRegister }) {
  const { append, fields, move, remove } = useFieldArray({ control, name });
  const values = useWatch({ control, name }) ?? [];
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return <div className="grid gap-2"><div className="flex items-center justify-between gap-3"><FieldTitle>Étapes</FieldTitle><Button type="button" variant="outline" className="min-h-11" onClick={() => { append(""); setEditingIndex(fields.length); }}><ListPlus /> Ajouter</Button></div>{fields.map((field, index) => editingIndex === index ? <div key={field.id} className="grid gap-2 rounded-xl bg-card p-3 shadow-[var(--shadow-card)]"><Textarea autoFocus placeholder={`Étape ${index + 1}`} {...register(`${name}.${index}`)} /><div className="grid grid-cols-[1fr_1fr_auto] gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={index === 0} onClick={() => { move(index, index - 1); setEditingIndex(index - 1); }}><ArrowUp /></Button><Button type="button" variant="outline" className="min-h-11" disabled={index === fields.length - 1} onClick={() => { move(index, index + 1); setEditingIndex(index + 1); }}><ArrowDown /></Button><Button type="button" variant="destructive" size="icon" className="size-11" aria-label="Supprimer cette étape" onClick={() => { remove(index); setEditingIndex(null); }}><Trash2 /></Button></div><Button type="button" className="min-h-11" onClick={() => setEditingIndex(null)}>Terminé</Button></div> : <button key={field.id} type="button" onClick={() => setEditingIndex(index)} className="grid min-h-14 grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl bg-muted/55 p-2 text-left transition-transform active:scale-[0.96]"><span className="grid size-8 place-items-center rounded-lg bg-card text-sm font-black tabular-nums">{index + 1}</span><span className="line-clamp-2 text-sm font-semibold">{values[index] || `Étape ${index + 1}`}</span><ChevronRight className="size-5 text-muted-foreground" /></button>)}</div>;
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
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="min-h-11 md:min-h-7">
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
        className="size-11 md:size-7"
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
        className="size-11 md:size-7"
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="icon-sm"
        aria-label="Supprimer"
        onClick={() => onRemove(index)}
        className="size-11 md:size-7"
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
    type: "idle" | "success" | "error" | "conflict";
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
    tags: (value.tags ?? []).flatMap((tag) => {
      const trimmed = tag.trim();
      return trimmed ? [trimmed] : [];
    }),
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
      steps: section.steps.flatMap((step) => {
        const trimmed = step.trim();
        return trimmed ? [trimmed] : [];
      }),
    })),
    subRecipes: recipe.subRecipes.map((subRecipe) => ({
      title: subRecipe.title.trim(),
      ingredients: subRecipe.ingredients.map(normalizeIngredient),
    })),
    notes: recipe.notes.flatMap((note) => {
      const trimmed = note.trim();
      return trimmed ? [trimmed] : [];
    }),
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
    .flatMap((tag) => {
      const trimmed = tag.trim();
      return trimmed ? [trimmed] : [];
    });
}

function cloneRecipe(recipe: RecipeFormPayload): RecipeFormPayload {
  return structuredClone(recipe);
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
