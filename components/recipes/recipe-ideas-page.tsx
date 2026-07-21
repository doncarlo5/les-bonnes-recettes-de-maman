"use client";

import Link from "next/link";
import {
  Component,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Check, Lightbulb, Pencil, Trash2 } from "lucide-react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecipeIdea } from "./types";
import { usePublicParticipantKey } from "./use-recipe-comment-participant";

type IdeaForm = {
  authorName: string;
  text: string;
  honeypot: string;
  editingId: Id<"recipeIdeas"> | null;
};

const initialForm: IdeaForm = {
  authorName: "",
  text: "",
  honeypot: "",
  editingId: null,
};

export function RecipeIdeasPage({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const labels = dict.ideas;
  const participantKey = usePublicParticipantKey();
  const createIdea = useMutation(api.recipeIdeas.create);
  const updateIdea = useMutation(api.recipeIdeas.updateOwn);
  const removeIdea = useMutation(api.recipeIdeas.removeOwn);
  const [form, setForm] = useState<IdeaForm>(initialForm);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Id<"recipeIdeas"> | null>(null);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "Europe/Paris",
      }),
    [locale],
  );

  useEffect(() => {
    if (window.location.hash === "#nouvelle-idee") focusIdeaText();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participantKey || pending) return;
    if (!form.text.trim()) {
      setMessage(labels.textRequired);
      focusIdeaText();
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      if (form.editingId) {
        await updateIdea({
          ideaId: form.editingId,
          participantKey,
          authorName: form.authorName,
          text: form.text,
        });
        toast.success(labels.updated);
      } else {
        await createIdea({
          participantKey,
          authorName: form.authorName,
          text: form.text,
          honeypot: form.honeypot,
        });
        toast.success(labels.success);
      }
      setForm(initialForm);
    } catch (error) {
      setMessage(
        String(error).includes("RECIPE_IDEA_RATE_LIMITED")
          ? labels.rateLimited
          : labels.error,
      );
    } finally {
      setPending(false);
    }
  }

  function edit(idea: RecipeIdea) {
    setForm({
      authorName: idea.authorName ?? "",
      text: idea.text,
      honeypot: "",
      editingId: idea._id,
    });
    setMessage(null);
    window.requestAnimationFrame(() => {
      const target = focusIdeaText();
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function remove() {
    if (!deleteTarget || !participantKey) return;
    try {
      await removeIdea({ ideaId: deleteTarget, participantKey });
      if (form.editingId === deleteTarget) setForm(initialForm);
      setDeleteTarget(null);
    } catch {
      setMessage(labels.error);
    }
  }

  return (
    <main className="bg-muted/45 px-4 py-8 md:px-6 md:py-16 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)] lg:items-start lg:gap-14">
        <div className="grid gap-6 lg:sticky lg:top-28">
          <header>
            <p className="type-label text-primary">{labels.eyebrow}</p>
            <h1 className="type-page-title mt-3">{labels.title}</h1>
            <p className="type-body mt-4 max-w-[45ch] font-semibold text-muted-foreground">
              {labels.description}
            </p>
          </header>
          <form
            id="nouvelle-idee"
            onSubmit={submit}
            className="grid gap-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]"
            aria-busy={pending}
          >
            <h2 className="type-panel-title">{labels.formTitle}</h2>
            <div className="grid gap-2">
              <label htmlFor="idea-author" className="type-label">
                {labels.authorLabel}
              </label>
              <Input
                id="idea-author"
                value={form.authorName}
                maxLength={60}
                placeholder={labels.authorPlaceholder}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    authorName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="idea-text" className="type-label">
                {labels.textLabel}
              </label>
              <Textarea
                id="idea-text"
                value={form.text}
                rows={6}
                maxLength={1500}
                placeholder={labels.textPlaceholder}
                onChange={(event) =>
                  setForm((current) => ({ ...current, text: event.target.value }))
                }
              />
              <span className="type-meta justify-self-end text-muted-foreground tabular-nums">
                {form.text.length}/1500
              </span>
            </div>
            <div className="absolute -left-[10000px] size-px overflow-hidden" aria-hidden>
              <label htmlFor="idea-website">Website</label>
              <input
                id="idea-website"
                tabIndex={-1}
                autoComplete="off"
                value={form.honeypot}
                onChange={(event) =>
                  setForm((current) => ({ ...current, honeypot: event.target.value }))
                }
              />
            </div>
            {message ? <p role="alert" className="text-sm font-bold text-destructive">{message}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || !participantKey || !form.text.trim()}>
                <Lightbulb data-icon="inline-start" />
                {form.editingId ? labels.save : labels.submit}
              </Button>
              {form.editingId ? (
                <Button type="button" variant="outline" onClick={() => setForm(initialForm)}>
                  {labels.cancel}
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="grid gap-10">
          {(["outstanding", "completed"] as const).map((state) => (
            <IdeaQueryErrorBoundary
              key={state}
              errorLabel={labels.loadError}
              retryLabel={labels.retry}
            >
              <IdeaSectionQuery
                state={state}
                locale={locale}
                participantKey={participantKey}
                title={state === "outstanding" ? labels.outstandingTitle : labels.completedTitle}
                description={state === "outstanding" ? labels.outstandingDescription : labels.completedDescription}
                empty={state === "outstanding" ? labels.emptyOutstanding : labels.emptyCompleted}
                loadingLabel={labels.loading}
                loadMoreLabel={labels.loadMore}
                render={(idea) => (
                  <IdeaCard
                    key={idea._id}
                    idea={idea}
                    locale={locale}
                    labels={labels}
                    formattedDate={dateFormatter.format(idea._creationTime)}
                    onEdit={() => edit(idea)}
                    onDelete={() => setDeleteTarget(idea._id)}
                  />
                )}
              />
            </IdeaQueryErrorBoundary>
          ))}
        </div>
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.delete}</AlertDialogTitle>
            <AlertDialogDescription>{labels.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              {labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

type PaginatedIdeas = ReturnType<typeof usePaginatedQuery<typeof api.recipeIdeas.list>>;

function IdeaSectionQuery({
  state,
  locale,
  participantKey,
  ...sectionProps
}: Omit<React.ComponentProps<typeof IdeaSection>, "query"> & {
  state: "outstanding" | "completed";
  locale: Locale;
  participantKey: string | null;
}) {
  const query = usePaginatedQuery(
    api.recipeIdeas.list,
    participantKey ? { state, locale, participantKey } : "skip",
    { initialNumItems: 10 },
  );
  return <IdeaSection {...sectionProps} query={query} />;
}

class IdeaQueryErrorBoundary extends Component<
  { children: ReactNode; errorLabel: string; retryLabel: string },
  { failed: boolean; retryKey: number }
> {
  state = { failed: false, retryKey: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section>
          <Empty className="rounded-2xl bg-card shadow-[var(--shadow-card)]">
            <EmptyHeader>
              <EmptyTitle>{this.props.errorLabel}</EmptyTitle>
              <EmptyDescription>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    this.setState((state) => ({
                      failed: false,
                      retryKey: state.retryKey + 1,
                    }))
                  }
                >
                  {this.props.retryLabel}
                </Button>
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      );
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}

function IdeaSection({
  title,
  description,
  empty,
  query,
  loadingLabel,
  loadMoreLabel,
  render,
}: {
  title: string;
  description: string;
  empty: string;
  query: PaginatedIdeas;
  loadingLabel: string;
  loadMoreLabel: string;
  render: (idea: RecipeIdea) => React.ReactNode;
}) {
  const initialLoading = query.status === "LoadingFirstPage";
  return (
    <section className="grid gap-4">
      <header>
        <h2 className="type-content-title">{title}</h2>
        <p className="type-body-sm mt-1 font-semibold text-muted-foreground">{description}</p>
      </header>
      {initialLoading ? (
        <div className="grid gap-3" role="status" aria-label={loadingLabel}>
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : query.results.length === 0 ? (
        <Empty className="rounded-2xl bg-card shadow-[var(--shadow-card)]">
          <EmptyHeader>
            <EmptyTitle>{empty}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3">{query.results.map((idea) => render(idea as RecipeIdea))}</div>
      )}
      {query.status === "CanLoadMore" ? (
        <Button type="button" variant="outline" onClick={() => query.loadMore(10)}>
          {loadMoreLabel}
        </Button>
      ) : null}
    </section>
  );
}

function IdeaCard({
  idea,
  locale,
  labels,
  formattedDate,
  onEdit,
  onDelete,
}: {
  idea: RecipeIdea;
  locale: Locale;
  labels: Dictionary["ideas"];
  formattedDate: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="grid gap-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black">{idea.authorName ?? labels.anonymous}</h3>
          <p className="type-meta mt-1 text-muted-foreground">
            {formattedDate}{idea.edited ? ` · ${labels.edited}` : ""}
          </p>
        </div>
        {idea.state === "completed" ? (
          <Badge variant="secondary"><Check /> {labels.addedBadge}</Badge>
        ) : null}
      </header>
      <p className="whitespace-pre-wrap type-body-sm font-semibold text-foreground/85">{idea.text}</p>
      <footer className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {idea.linkedRecipe?.isPublic ? (
          <Link href={`/${locale}/recettes/${idea.linkedRecipe.slug}`} className={buttonVariants()}>
            {labels.viewRecipe}: {idea.linkedRecipe.title}
          </Link>
        ) : null}
        <span className="flex-1" />
        {idea.canEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            <Pencil /> {labels.edit}
          </Button>
        ) : null}
        {idea.canDelete ? (
          <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 /> {labels.delete}
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

function focusIdeaText() {
  const target = document.getElementById("idea-text") as HTMLTextAreaElement | null;
  target?.focus();
  return target;
}
