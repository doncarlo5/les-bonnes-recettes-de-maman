"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Lightbulb, NotebookPen, Trash2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { RecipeIdea } from "./types";

type IdeaPage = {
  page: RecipeIdea[];
  isDone: boolean;
  continueCursor: string;
};

export function AdminRecipeIdeas({
  locale,
  dict,
  initialCount,
  startWithComposer = false,
}: {
  locale: Locale;
  dict: Dictionary;
  initialCount: number;
  startWithComposer?: boolean;
}) {
  const labels = dict.ideas;
  const [state, setState] = useState<"outstanding" | "completed">("outstanding");
  const [ideas, setIdeas] = useState<RecipeIdea[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(startWithComposer);
  const [authorName, setAuthorName] = useState("");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Id<"recipeIdeas"> | null>(null);
  const [outstandingCount, setOutstandingCount] = useState(initialCount);
  const loadVersion = useRef(0);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Europe/Paris" }),
    [locale],
  );

  const load = useCallback(async (
    requestedState: "outstanding" | "completed",
    nextCursor: string | null,
    append: boolean,
  ) => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ state: requestedState, locale });
      if (nextCursor) params.set("cursor", nextCursor);
      const response = await fetch(`/api/admin/recipe-ideas?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("IDEAS_LOAD_FAILED");
      const result = (await response.json()) as IdeaPage;
      if (version !== loadVersion.current) return;
      setIdeas((current) => append ? [...current, ...result.page] : result.page);
      setCursor(result.continueCursor || null);
      setIsDone(result.isDone);
    } catch {
      if (version === loadVersion.current) setError(labels.adminLoadError);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [labels.adminLoadError, locale]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(state, null, false), 0);
    return () => window.clearTimeout(timeout);
  }, [load, state]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/recipe-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, text }),
      });
      if (!response.ok) throw new Error("IDEA_CREATE_FAILED");
      setAuthorName("");
      setText("");
      setComposerOpen(false);
      setOutstandingCount((count) => count + 1);
      if (state === "outstanding") {
        await load("outstanding", null, false);
      } else {
        loadVersion.current += 1;
        setIdeas([]);
        setCursor(null);
        setIsDone(true);
        setState("outstanding");
      }
    } catch {
      setError(labels.error);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setError(null);
    try {
      const target = ideas.find((idea) => idea._id === deleteTarget);
      const response = await fetch("/api/admin/recipe-ideas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: deleteTarget }),
      });
      if (!response.ok) throw new Error("IDEA_DELETE_FAILED");
      setIdeas((current) => current.filter((idea) => idea._id !== deleteTarget));
      if (target?.state === "outstanding") {
        setOutstandingCount((count) => Math.max(0, count - 1));
      }
      setDeleteTarget(null);
    } catch {
      setError(labels.adminDeleteError);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-24 pt-6 text-foreground">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-4 sm:flex sm:items-end sm:justify-between">
          <div>
            <Link href={`/${locale}/admin/recettes`} className={buttonVariants({ variant: "ghost", className: "-ml-3 mb-3" })}>
              <ArrowLeft /> {labels.adminBack}
            </Link>
            <p className="type-label text-primary">{labels.adminEyebrow}</p>
            <h1 className="type-page-title mt-2">{labels.adminTitle}</h1>
            <p className="type-body-sm mt-2 max-w-xl font-semibold text-muted-foreground">
              {labels.adminDescription}
            </p>
          </div>
          <Button type="button" onClick={() => setComposerOpen((open) => !open)} className="min-h-11 rounded-xl">
            <Lightbulb /> {labels.adminQuickAdd}
          </Button>
        </header>

        {composerOpen ? (
          <form onSubmit={create} className="grid gap-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
            <Input value={authorName} maxLength={60} aria-label={labels.authorLabel} placeholder={labels.authorPlaceholder} onChange={(event) => setAuthorName(event.target.value)} />
            <Textarea value={text} maxLength={1500} rows={5} aria-label={labels.textLabel} placeholder={labels.textPlaceholder} onChange={(event) => setText(event.target.value)} autoFocus />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || !text.trim()}><Lightbulb /> {labels.submit}</Button>
              <Button type="button" variant="outline" onClick={() => setComposerOpen(false)}>{labels.cancel}</Button>
            </div>
          </form>
        ) : null}

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-card p-2 shadow-[var(--shadow-card)]" role="group" aria-label={labels.adminTitle}>
          <Button type="button" variant={state === "outstanding" ? "default" : "ghost"} onClick={() => { loadVersion.current += 1; setState("outstanding"); }}>
            {labels.outstandingTitle} · {outstandingCount}
          </Button>
          <Button type="button" variant={state === "completed" ? "default" : "ghost"} onClick={() => { loadVersion.current += 1; setState("completed"); }}>
            {labels.completedTitle}
          </Button>
        </div>

        {error ? <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p> : null}
        {loading && ideas.length === 0 ? (
          <div className="grid gap-3" role="status" aria-label={labels.loading}><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
        ) : null}
        {!loading && ideas.length === 0 ? (
          <Empty className="bg-card shadow-[var(--shadow-card)]"><EmptyHeader><EmptyTitle>{labels.adminEmpty}</EmptyTitle></EmptyHeader></Empty>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {ideas.map((idea) => (
            <article key={idea._id} className="grid gap-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
              <header className="flex items-start justify-between gap-3">
                <div><h2 className="font-black">{idea.authorName ?? labels.anonymous}</h2><p className="type-meta mt-1 text-muted-foreground">{dateFormatter.format(idea._creationTime)}</p></div>
                {idea.state === "completed" ? <Badge variant="secondary"><Check /> {labels.addedBadge}</Badge> : null}
              </header>
              <p className="whitespace-pre-wrap text-sm font-semibold text-foreground/85">{idea.text}</p>
              <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {idea.linkedRecipe ? (
                  <Link href={`/${locale}/admin/recettes?slug=${idea.linkedRecipe.slug}&section=info`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                    <NotebookPen /> {labels.adminLinkedDraft}
                  </Link>
                ) : idea.state === "outstanding" ? (
                  <Link href={`/${locale}/admin/recettes?new=1&idea=${idea._id}`} className={buttonVariants({ size: "sm" })}>
                    <NotebookPen /> {labels.adminCreateRecipe}
                  </Link>
                ) : null}
                <span className="flex-1" />
                <Button type="button" size="sm" variant="destructive" onClick={() => setDeleteTarget(idea._id)}><Trash2 /> {labels.delete}</Button>
              </footer>
            </article>
          ))}
        </div>
        {!loading && !isDone && cursor ? <Button type="button" variant="outline" onClick={() => void load(state, cursor, true)}>{labels.loadMore}</Button> : null}
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{labels.delete}</AlertDialogTitle><AlertDialogDescription>{labels.deleteConfirm}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{labels.cancel}</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void remove()}>{labels.delete}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
