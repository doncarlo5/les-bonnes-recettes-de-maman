"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormReturn,
} from "react-hook-form";
import {
  getPublicationState,
  getRecipeReadiness,
  type RecipeReadiness,
} from "@/lib/recipe-admin-domain";
import {
  MAX_REFERENCE_SERVINGS,
  MIN_REFERENCE_SERVINGS,
} from "@/lib/recipe-servings";
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
  Eye,
  House,
  Languages,
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
import type { Dictionary } from "@/i18n/get-dictionary";
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
import { CompactIngredientsEditor, CompactSectionsEditor } from "./admin-compact-collections";
import { SortableCollection, SortableInlineRow } from "./admin-sortable-collection";
import {
  cloneRecipe,
  toFormValues,
  useRecipeDraftLifecycle,
  type RecipeFormMode,
  type SaveRecipeState,
  type SyncState,
} from "./use-recipe-draft-lifecycle";
import type { EditableRecipe, EditableRecipeSummary, Recipe } from "./types";
import { RecipePresentation } from "./recipe-detail-page";

type AdminRecipeEditorProps = {
  locale: Locale;
  dictionaries: Record<LocaleKey, Dictionary>;
  recipes: EditableRecipeSummary[];
  initialRecipe?: EditableRecipe;
  initialSlug?: string;
  startInCreateMode?: boolean;
};

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

type LocaleKey = "fr" | "en";
type RecipeRegister = UseFormRegister<any>;
type RecipeControl = Control<any>;

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
  yieldLabel: "",
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
  referenceServings: undefined,
  translations: {
    fr: blankLocalizedRecipe,
    en: blankLocalizedRecipe,
  },
  tags: [],
  status: "draft",
};

export function AdminRecipeEditor({
  locale,
  dictionaries,
  recipes,
  initialRecipe: initialRecipeProp,
  initialSlug,
  startInCreateMode = false,
}: AdminRecipeEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRecipe = startInCreateMode ? null : initialRecipeProp ?? null;
  const [selectedSlug, setSelectedSlug] = useState(initialRecipe?.slug ?? "");
  const [mode, setMode] = useState<RecipeFormMode>(
    startInCreateMode ? "create" : "update",
  );
  const selectedRecipe = initialRecipeProp?.slug === selectedSlug ? initialRecipeProp : null;

  const form = useForm<any>({
    resolver: zodResolver(editableRecipeContentSchema),
    defaultValues: selectedRecipe
      ? toFormValues(selectedRecipe)
      : cloneRecipe(blankRecipe),
    mode: "onBlur",
  });

  const {
    getValues,
    reset,
    setValue,
  } = form;
  const watchedValues = useWatch({ control: form.control });
  const mobileSection = normalizeMobileSection(searchParams.get("section"));
  const focusField = searchParams.get("field");
  const isPreview = searchParams.get("mode") === "preview";

  useEffect(() => {
    if (searchParams.get("new") === "1") return;
    const urlSlug = searchParams.get("slug") ?? "";
    if (urlSlug === selectedSlug) return;
    queueMicrotask(() => {
      setSelectedSlug(urlSlug);
      setMode("update");
    });
  }, [searchParams, selectedSlug]);

  const defaultLocale = useWatch({
    control: form.control,
    name: "defaultLocale",
  });
  const requestedLanguage = normalizeLocaleKey(searchParams.get("lang"), defaultLocale);
  const status = useWatch({
    control: form.control,
    name: "status",
  });
  const tagsValue = useWatch({
    control: form.control,
    name: "tags",
  });

  const handleCreated = useCallback((slug: string) => {
    setMode("update");
    setSelectedSlug(slug);
    router.replace(`/${locale}/admin/recettes?slug=${slug}`);
    router.refresh();
  }, [locale, router]);
  const refreshRecipe = useCallback(() => router.refresh(), [router]);
  const {
    state,
    isPending,
    syncState,
    revision,
    publishedRevision,
    savePayload,
    flushLatestDraft,
    publishRecipe,
    discardChanges,
    unpublishRecipe,
    handleImageRevision,
    handleImageConflict,
    replaceConflict,
    reloadLatest,
    resetForCreate,
    resetSyncState,
  } = useRecipeDraftLifecycle({
    locale,
    mode,
    selectedSlug,
    selectedRecipe,
    initialRecipe,
    watchedValues: watchedValues as Partial<RecipeFormPayload> | undefined,
    getValues,
    reset,
    setValue,
    onCreated: handleCreated,
    onRefresh: refreshRecipe,
  });
  const publication = getPublicationState(status ?? "draft", revision, publishedRevision);

  useEffect(() => {
    if (!focusField) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(focusField) ??
        document.querySelector<HTMLElement>(`[name="${CSS.escape(focusField)}"]`) ??
        document.querySelector<HTMLElement>(`[data-field-target="${CSS.escape(focusField)}"]`);
      target?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusField, mobileSection]);

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
    resetForCreate(blankRecipe);
    router.replace(`/${locale}/admin/recettes?new=1`);
  }

  async function showMobileHome() {
    if (!(await flushLatestDraft())) return;
    setSelectedSlug("");
    setMode("update");
    resetSyncState();
    router.push(`/${locale}/admin/recettes`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function openMobileSection(section: MobileSection) {
    if (!selectedSlug) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("mode");
    params.set("slug", selectedSlug);
    if (section === "overview") params.delete("section");
    else params.set("section", section);
    params.set("lang", requestedLanguage);
    router.push(`/${locale}/admin/recettes?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function openPreview() {
    if (!selectedSlug) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "preview");
    params.set("lang", requestedLanguage);
    router.push(`/${locale}/admin/recettes?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function closePreview() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    router.push(`/${locale}/admin/recettes?${params.toString()}`);
  }

  function selectPreviewLanguage(language: LocaleKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "preview");
    params.set("lang", language);
    router.push(`/${locale}/admin/recettes?${params.toString()}`);
  }

  function selectEditorLanguage(language: LocaleKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    params.set("lang", language);
    router.push(`/${locale}/admin/recettes?${params.toString()}`);
  }

  function returnFromPreview(section: Exclude<MobileSection, "overview" | "publish">) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    params.set("section", section);
    params.set("lang", requestedLanguage);
    router.push(`/${locale}/admin/recettes?${params.toString()}`);
  }

  if (isPreview && selectedRecipe) {
    return (
      <FormProvider {...form}>
        <AdminDraftPreview
          dictionaries={dictionaries}
          recipe={selectedRecipe}
          values={getValues()}
          previewLocale={requestedLanguage}
          onClose={closePreview}
          onPreviewLanguage={selectPreviewLanguage}
          onReturnToSection={returnFromPreview}
        />
      </FormProvider>
    );
  }

  return (
      <FormProvider {...form}>
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
        requestedLanguage={requestedLanguage}
        onLanguage={selectEditorLanguage}
        onCreate={createRecipe}
        onHome={showMobileHome}
        onSelect={selectRecipe}
        onOpenSection={openMobileSection}
        onSave={() => savePayload(getValues(), syncState === "conflict")}
        onPublish={publishRecipe}
        onDiscard={discardChanges}
        onUnpublish={unpublishRecipe}
        onImageRevision={handleImageRevision}
        onImageConflict={handleImageConflict}
        onReplaceConflict={replaceConflict}
        onReloadConflict={reloadLatest}
        publication={publication}
        onPreview={openPreview}
      />
      </FormProvider>
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
  requestedLanguage,
  onLanguage,
  onCreate,
  onHome,
  onSelect,
  onOpenSection,
  onSave,
  onPublish,
  onDiscard,
  onUnpublish,
  onImageRevision,
  onImageConflict,
  onReplaceConflict,
  onReloadConflict,
  publication,
  onPreview,
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
  requestedLanguage: LocaleKey;
  onLanguage: (locale: LocaleKey) => void;
  onCreate: () => void;
  onHome: () => void;
  onSelect: (slug: string) => void;
  onOpenSection: (section: MobileSection) => void;
  onSave: () => void;
  onPublish: () => void;
  onDiscard: () => void;
  onUnpublish: () => void;
  onImageRevision: (revision: number) => void;
  onImageConflict: (revision?: number, retry?: (revision: number) => Promise<void>) => void;
  onReplaceConflict: () => void;
  onReloadConflict: () => void;
  publication: ReturnType<typeof getPublicationState>;
  onPreview: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const values = useWatch({ control: form.control }) as RecipeFormPayload;
  const readiness = getRecipeReadiness(
    values,
    Boolean(selectedRecipe?.heroImageUrl),
  );
  const completedSections = Object.values(readiness.sections).filter(Boolean).length;

  if (!selectedSlug && mode !== "create") {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const visibleRecipes = recipes.filter((recipe) => {
      const matchesFilter = filter === "all" || recipe.status === filter;
      const haystack = `${recipe.title} ${recipe.slug} ${recipe.tags.join(" ")}`.toLocaleLowerCase(locale);
      return matchesFilter && (!normalizedQuery || haystack.includes(normalizedQuery));
    });

    return (
      <main className="min-h-screen px-4 pb-28 pt-6 text-foreground">
        <header className="mx-auto grid w-full max-w-5xl gap-5">
          <div className="grid gap-4 sm:flex sm:items-end sm:justify-between">
            <div className="grid gap-2">
              <p className="type-label text-primary">Admin recettes</p>
              <h1 className="type-page-title">Le carnet</h1>
              <p className="type-body-sm font-semibold text-muted-foreground tabular-nums">{recipes.length} recettes à portée de main.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Link href={`/${locale}`} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-sm font-semibold whitespace-nowrap transition-[scale,background-color,color,border-color,box-shadow] duration-150 outline-none select-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] md:min-h-10">
                <House data-icon="inline-start" /> Site public
              </Link>
              <Button type="button" onClick={onCreate} className="min-h-11 rounded-xl px-4">
                <CirclePlus data-icon="inline-start" /> Nouvelle
              </Button>
            </div>
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

        <section className="mx-auto mt-5 grid w-full max-w-5xl gap-3 lg:grid-cols-2" aria-label="Recettes">
          {visibleRecipes.map((recipe) => (
            <button key={recipe._id} type="button" onClick={() => onSelect(recipe.slug)} className="group grid min-h-24 grid-cols-[5rem_1fr_auto] items-center gap-3 rounded-2xl bg-card p-2 text-left shadow-[var(--shadow-card)] transition-[box-shadow,scale] duration-150 active:scale-[0.96]">
              <div className="relative size-20 overflow-hidden rounded-xl bg-muted">
                {recipe.heroImageUrl ? <Image src={recipe.heroImageUrl} alt="" fill sizes="80px" className="object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" /> : <div className="grid size-full place-items-center"><Camera className="size-5 text-muted-foreground" /></div>}
              </div>
              <span className="min-w-0">
                <span className="type-panel-title line-clamp-2" title={recipe.title || "Recette sans titre"}>{recipe.title || "Recette sans titre"}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  {recipe.isPublic ? "Visible" : recipe.hasPublishedVersion ? "Masquée" : "Jamais publiée"}
                  {recipe.hasUnpublishedChanges ? <><span aria-hidden>·</span><span className="text-primary">Modifications non publiées</span></> : null}
                  <span aria-hidden>·</span>
                  {recipe.readiness.blockers.length === 0 ? "Prête" : `${recipe.readiness.blockers.length} à compléter`}
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
        <div className="mx-auto grid w-full max-w-2xl gap-6">
          <button type="button" onClick={onHome} className="flex min-h-11 items-center gap-2 justify-self-start font-bold"><ArrowLeft /> Le carnet</button>
          <div className="grid gap-2"><p className="type-label text-primary">Nouveau brouillon</p><h1 className="type-page-title">Comment s’appelle cette recette&nbsp;?</h1><p className="type-body font-semibold text-muted-foreground [text-wrap:pretty]">Le titre crée immédiatement un brouillon privé. Tu pourras tout compléter ensuite.</p></div>
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
    <main className="min-h-screen px-4 pb-24 pt-3 text-foreground sm:pt-5">
      <div className="mx-auto w-full max-w-5xl">
        <header className="sticky top-2 z-20 mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[1.25rem] bg-card/95 p-2 shadow-[var(--shadow-card)] backdrop-blur-xl sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
          <Button type="button" variant="ghost" size="icon" onClick={() => section === "overview" ? onHome() : onOpenSection("overview")} className="size-11 rounded-xl" aria-label={section === "overview" ? "Retour au carnet" : "Retour à la recette"}><ArrowLeft /></Button>
          <div className="min-w-0 flex-1"><p className="type-label truncate text-muted-foreground" title={sectionTitle}>{sectionTitle}</p><h1 className="type-panel-title truncate ![text-wrap:nowrap]" title={values.translations[defaultLocale]?.title || "Recette sans titre"}>{values.translations[defaultLocale]?.title || "Recette sans titre"}</h1></div>
          <div className="col-span-3 row-start-2 flex items-center gap-1 rounded-xl bg-muted p-1 sm:col-span-1 sm:col-start-3 sm:row-start-1" role="group" aria-label="Langue du contenu">
            <Button type="button" variant="ghost" onClick={() => onLanguage("fr")} className={`h-10 min-h-10 flex-1 rounded-lg px-3 text-sm sm:flex-none ${requestedLanguage === "fr" ? "bg-card text-foreground shadow-[var(--shadow-border)] hover:bg-card" : "text-muted-foreground"}`} aria-pressed={requestedLanguage === "fr"}>Français</Button>
            <Button type="button" variant="ghost" onClick={() => onLanguage("en")} className={`h-10 min-h-10 flex-1 rounded-lg px-3 text-sm sm:flex-none ${requestedLanguage === "en" ? "bg-card text-foreground shadow-[var(--shadow-border)] hover:bg-card" : "text-muted-foreground"}`} aria-pressed={requestedLanguage === "en"}>Anglais</Button>
          </div>
          <div className="col-start-3 row-start-1 flex items-center gap-1 sm:col-start-4">
            <Button type="button" variant="ghost" size="icon" onClick={onPreview} className="rounded-xl" aria-label="Prévisualiser le brouillon" title="Prévisualiser le brouillon"><Eye /></Button>
            <SyncPill state={syncState} revision={revision} />
          </div>
        </header>

        {syncState === "conflict" ? <ConflictCard onReload={onReloadConflict} onReplace={onReplaceConflict} /> : null}
        {state.type === "error" ? <SaveStateAlert state={state} /> : null}

        {section === "overview" ? (
          <MobileOverview recipe={selectedRecipe} values={values} readiness={readiness} publication={publication} onOpen={onOpenSection} />
        ) : (
          <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <MobileSectionFields section={section} locale={locale} recipe={selectedRecipe} revision={revision} onImageRevision={onImageRevision} onImageConflict={onImageConflict} form={form} tagsValue={tagsValue} defaultLocale={defaultLocale} requestedLanguage={requestedLanguage} readiness={readiness} publication={publication} isPending={isPending} onPublish={onPublish} onDiscard={onDiscard} onUnpublish={onUnpublish} />
          </section>
        )}
      </div>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-5" aria-label="Actions de la recette">
        <div className="pointer-events-auto mx-auto grid max-w-xl grid-cols-3 gap-1 rounded-[1.125rem] bg-card/95 p-1.5 shadow-[var(--shadow-card)] backdrop-blur-xl">
          <Button type="button" variant={section === "overview" ? "secondary" : "ghost"} onClick={() => onOpenSection("overview")} className="h-12 min-w-0 gap-1 rounded-xl px-2 text-xs sm:text-sm" aria-pressed={section === "overview"}><BookOpen /> Recette</Button>
          <Button type="button" variant={section === "photo" ? "secondary" : "ghost"} onClick={() => onOpenSection("photo")} className="h-12 min-w-0 gap-1 rounded-xl px-2 text-xs sm:text-sm" aria-pressed={section === "photo"}><Camera /> Photo</Button>
          <Button type="button" variant={publication.hasUnpublishedChanges ? "default" : section === "publish" ? "secondary" : "ghost"} data-publication-needed={publication.hasUnpublishedChanges || undefined} onClick={() => onOpenSection("publish")} className="h-12 min-w-0 gap-1 rounded-xl px-2 text-xs sm:text-sm" aria-label={`Publier, ${completedSections} sections sur 7 complétées`} aria-pressed={section === "publish"}><Send /> Publier <span className={`rounded-full px-1.5 py-0.5 text-[0.6875rem] font-bold leading-none tabular-nums ${publication.hasUnpublishedChanges ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/10 text-primary"}`}>{completedSections}/7</span></Button>
        </div>
      </nav>
    </main>
  );
}

function MobileOverview({ recipe, values, readiness, publication, onOpen }: { recipe: EditableRecipe | null; values: RecipeFormPayload; readiness: RecipeReadiness; publication: ReturnType<typeof getPublicationState>; onOpen: (section: MobileSection) => void }) {
  function status(section: Exclude<MobileSection, "overview" | "publish">) {
    return {
      blockers: readiness.blockers.filter((item) => item.section === section).length,
      warnings: readiness.warnings.filter((item) => item.section === section).length,
    };
  }
  const sections: Array<{
    id: Exclude<MobileSection, "overview" | "publish">;
    title: string;
    detail: string;
    icon: typeof Camera;
    complete: boolean;
    blockers: number;
    warnings: number;
  }> = [
    { id: "essentials", title: "L’essentiel", detail: "Titre, auteur et description", icon: NotebookPen, complete: readiness.sections.essentials, ...status("essentials") },
    { id: "photo", title: "Photo", detail: "Couverture de la recette", icon: Camera, complete: readiness.sections.photo, ...status("photo") },
    { id: "details", title: "Détails", detail: "Quantité obtenue, temps et température", icon: Clock3, complete: readiness.sections.details, ...status("details") },
    { id: "ingredients", title: "Ingrédients", detail: `${values.translations[values.defaultLocale].ingredients.filter((item) => item.name.trim()).length} éléments`, icon: ListChecks, complete: readiness.sections.ingredients, ...status("ingredients") },
    { id: "preparation", title: "Préparation", detail: "Sections, étapes et sous-recettes", icon: BookOpen, complete: readiness.sections.preparation, ...status("preparation") },
    { id: "notes", title: "Notes", detail: "Astuces et variantes", icon: NotebookPen, complete: true, ...status("notes") },
    { id: "translation", title: "Traduction", detail: "Version anglaise", icon: Languages, complete: readiness.sections.translation, ...status("translation") },
  ];

  return <div className="grid gap-4">
    <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
      <div className="relative aspect-[16/9] bg-muted">{recipe?.heroImageUrl ? <Image src={recipe.heroImageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 32rem" className="object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" /> : <div className="grid size-full place-items-center gap-2 text-muted-foreground"><Camera /><span className="text-sm font-bold">Ajouter une photo</span></div>}</div>
      <div className="flex items-center justify-between gap-3 p-4"><div><Badge variant={publication.isPublic ? "default" : "secondary"}>{publication.isPublic ? "Visible publiquement" : publication.hasPublishedVersion ? "Version approuvée masquée" : "Jamais publiée"}</Badge><p className="mt-2 text-sm font-semibold text-muted-foreground">{publication.hasUnpublishedChanges ? "Modifications non publiées" : readiness.blockers.length === 0 ? "Prête à publier" : `${readiness.blockers.length} point${readiness.blockers.length > 1 ? "s" : ""} à compléter`}</p></div><Button type="button" variant="outline" onClick={() => onOpen("publish")} className="min-h-11 rounded-xl">Vérifier <ChevronRight /></Button></div>
    </div>
    <div className="grid gap-2 lg:grid-cols-2">{sections.map(({ id, title, detail, icon: Icon, complete, blockers, warnings }) => <button key={id} type="button" onClick={() => onOpen(id)} className="grid min-h-17 grid-cols-[2.75rem_1fr_auto] items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-[var(--shadow-card)] transition-[scale,box-shadow] active:scale-[0.96]"><span className="grid size-11 place-items-center rounded-xl bg-muted"><Icon className="size-5" /></span><span><span className="block font-black">{title}</span><span className="block text-xs font-semibold text-muted-foreground">{blockers > 0 ? `${blockers} blocage${blockers > 1 ? "s" : ""}` : warnings > 0 ? `${warnings} conseil${warnings > 1 ? "s" : ""}` : detail}</span></span>{blockers > 0 ? <TriangleAlert className="size-5 text-destructive" /> : warnings > 0 ? <TriangleAlert className="size-5 text-amber-600" /> : complete ? <Check className="size-5 text-green-600" /> : <ChevronRight className="size-5 text-muted-foreground" />}</button>)}</div>
  </div>;
}

function AdminDraftPreview({
  dictionaries,
  recipe,
  values,
  previewLocale,
  onClose,
  onPreviewLanguage,
  onReturnToSection,
}: {
  dictionaries: Record<LocaleKey, Dictionary>;
  recipe: EditableRecipe;
  values: RecipeFormPayload;
  previewLocale: LocaleKey;
  onClose: () => void;
  onPreviewLanguage: (locale: LocaleKey) => void;
  onReturnToSection: (section: Exclude<MobileSection, "overview" | "publish">) => void;
}) {
  const localized = values.translations[previewLocale];
  const previewRecipe: Recipe = {
    _id: recipe._id,
    _creationTime: recipe._creationTime,
    slug: recipe.slug,
    heroImageUrl: recipe.heroImageUrl,
    imageCredit: recipe.imageCredit,
    defaultLocale: values.defaultLocale,
    referenceServings: values.referenceServings,
    tags: values.tags,
    status: recipe.status,
    ...localized,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex min-h-16 flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
        <Button type="button" variant="ghost" aria-label="Retour à l’édition" onClick={onClose}>
          <ArrowLeft data-icon="inline-start" />
          <span className="hidden sm:inline">Retour à l’édition</span>
        </Button>
        <div className="flex items-center gap-2">
          <p className="type-label text-primary">Aperçu du brouillon</p>
          <Button type="button" variant={previewLocale === "fr" ? "default" : "outline"} onClick={() => onPreviewLanguage("fr")}>
            Français
          </Button>
          <Button type="button" variant={previewLocale === "en" ? "default" : "outline"} onClick={() => onPreviewLanguage("en")}>
            Anglais
          </Button>
        </div>
        <nav aria-label="Modifier une section" className="flex w-full gap-2 overflow-x-auto pb-1">
          {([
            ["essentials", "Essentiel"],
            ["photo", "Photo"],
            ["details", "Détails"],
            ["ingredients", "Ingrédients"],
            ["preparation", "Préparation"],
            ["notes", "Notes"],
            ["translation", "Traduction"],
          ] as const).map(([section, label]) => (
            <Button key={section} type="button" variant="ghost" className="shrink-0" onClick={() => onReturnToSection(section)}>
              {label}
            </Button>
          ))}
        </nav>
      </header>
      <RecipePresentation locale={previewLocale} dict={dictionaries[previewLocale]} recipe={previewRecipe} mode="preview" />
    </div>
  );
}

function MobileSectionFields({ section, locale, recipe, revision, onImageRevision, onImageConflict, form, tagsValue, defaultLocale, requestedLanguage, readiness, publication, isPending, onPublish, onDiscard, onUnpublish }: { section: MobileSection; locale: Locale; recipe: EditableRecipe | null; revision: number; onImageRevision: (revision: number) => void; onImageConflict: (revision?: number, retry?: (revision: number) => Promise<void>) => void; form: UseFormReturn<any>; tagsValue: string[]; defaultLocale: LocaleKey; requestedLanguage: LocaleKey; readiness: RecipeReadiness; publication: ReturnType<typeof getPublicationState>; isPending: boolean; onPublish: () => void; onDiscard: () => void; onUnpublish: () => void }) {
  const base = `translations.${requestedLanguage}`;
  const errors = form.formState.errors;
  if (section === "photo") return <div data-field-target="heroImageUrl" tabIndex={-1}><AdminRecipeImagePanel locale={locale} recipe={recipe} revision={revision} onRevisionChange={onImageRevision} onConflict={onImageConflict} /></div>;
  if (section === "essentials") return <FieldGroup><TextField label="Titre" name={`${base}.title`} register={form.register} errors={errors} /><TextField label="Auteur" name={`${base}.author`} register={form.register} errors={errors} /><TextareaField label="Description" name={`${base}.description`} register={form.register} errors={errors} /><SelectField label="Langue principale" value={defaultLocale} onValueChange={(value) => form.setValue("defaultLocale", value, { shouldDirty: true })} options={[{ label: "Français", value: "fr" }, { label: "Anglais", value: "en" }]} /><Field><FieldLabel htmlFor="mobile-tags">Catégories</FieldLabel><Input id="mobile-tags" className="h-11" value={tagsValue.join(", ")} onChange={(event) => form.setValue("tags", parseTags(event.target.value), { shouldDirty: true })} /><FieldDescription>Sépare les catégories par des virgules.</FieldDescription></Field></FieldGroup>;
  if (section === "details") return <FieldGroup><TextField label="Quantité obtenue" name={`${base}.yieldLabel`} register={form.register} errors={errors} placeholder="Environ 20 gougères" /><TextField label="Préparation" name={`${base}.prepTime`} register={form.register} errors={errors} placeholder="20 min" /><TextField label="Cuisson" name={`${base}.cookTime`} register={form.register} errors={errors} placeholder="25 min" /><TextField label="Total" name={`${base}.totalTime`} register={form.register} errors={errors} placeholder="45 min" /><TextField label="Libellé temps" name={`${base}.timeLabel`} register={form.register} errors={errors} placeholder="45 min" /><TextField label="Température" name={`${base}.temperature`} register={form.register} errors={errors} placeholder="180 °C" /></FieldGroup>;
  if (section === "ingredients") return <FieldGroup><TextField label="Portions de référence (personnes)" name="referenceServings" register={form.register} errors={errors} type="number" min={MIN_REFERENCE_SERVINGS} max={MAX_REFERENCE_SERVINGS} /><FieldDescription>Le nombre de personnes par défaut, utilisé comme base pour calculer les proportions de la recette publique.</FieldDescription><CompactIngredientsEditor name={`${base}.ingredients`} control={form.control} register={form.register} /></FieldGroup>;
  if (section === "preparation") return <FieldGroup><CompactSectionsEditor name={`${base}.sections`} control={form.control} register={form.register} /><SubRecipesArray name={`${base}.subRecipes`} control={form.control} register={form.register} /></FieldGroup>;
  if (section === "notes") return <NotesArray name={`${base}.notes`} control={form.control} register={form.register} />;
  if (section === "translation") return <div className="grid gap-4"><div className="rounded-xl bg-muted p-3 text-sm font-bold">Traduction {requestedLanguage === "en" ? "anglaise" : "française"}</div><LocalizedRecipeFields localeKey={requestedLanguage} register={form.register} control={form.control} errors={errors} /></div>;
  if (section === "publish") return <PublishWorkspace recipe={recipe} readiness={readiness} publication={publication} isPending={isPending} onPublish={onPublish} onDiscard={onDiscard} onUnpublish={onUnpublish} />;
  return null;
}

function PublishWorkspace({ recipe, readiness, publication, isPending, onPublish, onDiscard, onUnpublish }: { recipe: EditableRecipe | null; readiness: RecipeReadiness; publication: ReturnType<typeof getPublicationState>; isPending: boolean; onPublish: () => void; onDiscard: () => void; onUnpublish: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  function openItem(item: (typeof readiness.blockers)[number]) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", item.section);
    params.set("lang", item.locale);
    params.set("field", item.field);
    router.push(`?${params.toString()}`);
  }

  return <div className="grid gap-5">
    <div><p className="type-label text-primary">État de préparation</p><h2 className="type-panel-title mt-2">Avant de publier</h2><p className="type-body-sm mt-2 font-semibold text-muted-foreground [text-wrap:pretty]">{publication.isPublic ? "La version approuvée est visible publiquement." : publication.hasPublishedVersion ? "La version approuvée est actuellement masquée." : "Cette recette n’a jamais été publiée."}</p></div>
    {readiness.blockers.length ? <div className="grid gap-2"><h3 className="font-black text-destructive">À compléter</h3>{readiness.blockers.map((item) => <button type="button" key={item.code} onClick={() => openItem(item)} className="flex min-h-11 items-center gap-2 rounded-xl bg-destructive/10 p-3 text-left text-sm font-bold text-destructive transition-[scale,background-color] active:scale-[0.96]"><TriangleAlert className="size-5 shrink-0" /><span className="flex-1">{item.label}</span><ChevronRight className="size-5" /></button>)}</div> : <div className="flex gap-3 rounded-xl bg-green-600/10 p-4 font-bold text-green-700 dark:text-green-400"><Check className="size-5" />La version française est prête.</div>}
    {readiness.warnings.length ? <div className="grid gap-2"><h3 className="font-black">Conseils</h3>{readiness.warnings.map((item) => <button type="button" key={item.code} onClick={() => openItem(item)} className="flex min-h-11 items-center gap-2 rounded-xl bg-muted p-3 text-left text-sm font-semibold transition-[scale,background-color] active:scale-[0.96]"><span className="flex-1">{item.label}</span><ChevronRight className="size-5" /></button>)}</div> : null}
    {publication.isPublic && recipe ? <a href={`../recettes/${recipe.slug}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-xl bg-muted px-4 font-black">Voir la version publiée</a> : null}
    <Button type="button" size="lg" disabled={isPending || readiness.blockers.length > 0} onClick={onPublish} className="min-h-12 rounded-xl active:scale-[0.96] transition-transform">{isPending ? <Spinner /> : <Send />} {publication.hasPublishedVersion ? "Publier les modifications" : "Publier la recette"}</Button>
    {publication.canDiscard ? <Button type="button" variant="outline" disabled={isPending} onClick={onDiscard} className="min-h-11 rounded-xl">Abandonner les modifications</Button> : null}
    {publication.isPublic ? <Button type="button" variant="destructive" disabled={isPending} onClick={onUnpublish} className="min-h-11 rounded-xl">Retirer du site public</Button> : null}
  </div>;
}

function SyncPill({ state, revision }: { state: SyncState; revision: number }) {
  const Icon = state === "saving" ? RefreshCw : state === "offline" || state === "error" ? CloudOff : Cloud;
  const label = state === "saving" ? "Sauvegarde" : state === "offline" ? "Hors ligne" : state === "error" ? "Erreur" : state === "conflict" ? "Conflit" : "Enregistré";
  return <span title={`Révision ${revision}`} className="type-meta flex min-h-9 items-center gap-1 rounded-full bg-muted px-2.5"><Icon className={`size-3.5 ${state === "saving" ? "animate-spin" : ""}`} />{label}</span>;
}

function ConflictCard({ onReload, onReplace }: { onReload: () => void; onReplace: () => void }) {
  return <div className="mb-4 rounded-2xl bg-destructive/10 p-4 shadow-[var(--shadow-card)]"><div className="flex gap-3"><TriangleAlert className="size-5 shrink-0 text-destructive" /><div><h2 className="font-black">Modifications sur un autre appareil</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">Recharge la version la plus récente ou remplace-la avec le contenu de ce téléphone.</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={onReload} className="min-h-11">Recharger</Button><Button type="button" variant="destructive" onClick={onReplace} className="min-h-11">Remplacer</Button></div></div>;
}

function mobileSectionTitle(section: MobileSection) {
  return ({ overview: "Vue d’ensemble", essentials: "L’essentiel", photo: "Photo", details: "Détails", ingredients: "Ingrédients", preparation: "Préparation", notes: "Notes", translation: "Traduction", publish: "Publication" } as const)[section];
}

function normalizeMobileSection(value: string | null): MobileSection {
  const sections: MobileSection[] = ["overview", "essentials", "photo", "details", "ingredients", "preparation", "notes", "translation", "publish"];
  return sections.includes(value as MobileSection) ? (value as MobileSection) : "overview";
}

function normalizeLocaleKey(value: string | null, fallback: LocaleKey): LocaleKey {
  return value === "fr" || value === "en" ? value : fallback;
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
                  <span className="block max-w-full truncate font-medium" title={recipe.title}>{recipe.title}</span>
                  <span className="truncate text-xs text-muted-foreground" title={recipe.slug}>
                    {recipe.slug}
                  </span>
                  {recipe.tags.length > 0 ? (
                    <span className="truncate text-xs text-muted-foreground" title={recipe.tags.join(", ")}>
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
          label="Quantité obtenue"
          name={`${baseName}.yieldLabel`}
          register={register}
          errors={errors}
          serverErrors={serverErrors}
          placeholder="Environ 20 gougères"
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
  min,
  max,
}: {
  label: string;
  name: string;
  register: RecipeRegister;
  errors: Record<string, unknown>;
  serverErrors?: Record<string, string>;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  min?: number;
  max?: number;
}) {
  const error = getFieldError(errors, serverErrors, name);

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        className="h-11 md:h-10"
        type={type}
        min={min}
        max={max}
        placeholder={placeholder}
      aria-invalid={Boolean(error)}
      autoFocus={autoFocus}
        {...register(name, type === "number" ? {
          setValueAs: (value: string) => value === "" ? undefined : Number(value),
        } : undefined)}
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
        <SelectTrigger className="h-11 w-full md:h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} className="min-h-11 md:min-h-10">
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
      <SortableCollection ids={fields.map((field) => field.id)} label={`Réordonner ${title.toLowerCase()}`} getLabel={(index) => `${title} ${index + 1}`} onMove={move} renderItem={(id, index) => (
          <SortableInlineRow key={id} id={id} handleLabel={`Déplacer ${title.toLowerCase()} ${index + 1}`}>
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
          </SortableInlineRow>
        )} />
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
      <SortableCollection ids={fields.map((field) => field.id)} label="Réordonner les sections" getLabel={(index) => `Section ${index + 1}`} onMove={move} renderItem={(id, index) => (
          <SortableInlineRow key={id} id={id} handleLabel={`Déplacer la section ${index + 1}`}>
          <div className="flex flex-col gap-3">
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
          </SortableInlineRow>
        )} />
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
      <SortableCollection ids={fields.map((field) => field.id)} label="Réordonner les étapes" getLabel={(index) => `Étape ${index + 1}`} onMove={move} renderItem={(id, index) => (
        <SortableInlineRow key={id} id={id} handleLabel={`Déplacer l’étape ${index + 1}`}>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <Textarea placeholder={`Etape ${index + 1}`} {...register(`${name}.${index}`)} />
          <ArrayControls
            index={index}
            length={fields.length}
            onMove={move}
            onRemove={remove}
          />
        </div>
        </SortableInlineRow>
      )} />
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
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="min-h-11 md:min-h-10">
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
        className="size-11 md:size-10"
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
        className="size-11 md:size-10"
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="icon-sm"
        aria-label="Supprimer"
        onClick={() => onRemove(index)}
        className="size-11 md:size-10"
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

function parseTags(value: string) {
  return value
    .split(",")
    .flatMap((tag) => {
      const trimmed = tag.trim();
      return trimmed ? [trimmed] : [];
    });
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
