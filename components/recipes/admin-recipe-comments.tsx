"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Locale } from "@/i18n/config";
import { clientDictionaries } from "@/i18n/client-dictionaries";
import { Button } from "@/components/ui/button";

type ModeratedComment = {
  _id: Id<"recipeComments">;
  _creationTime: number;
  authorName: string | null;
  text: string;
  photoUrl: string | null;
  edited: boolean;
  thumbsUpCount: number;
  thumbsDownCount: number;
};

type CommentPage = {
  page: ModeratedComment[];
  isDone: boolean;
  continueCursor: string;
};

export function AdminRecipeComments({ slug, locale }: { slug: string; locale: Locale }) {
  const labels = clientDictionaries[locale].recipeDetail.comments;
  const [comments, setComments] = useState<ModeratedComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextCursor: string | null, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ slug });
      if (nextCursor) params.set("cursor", nextCursor);
      const response = await fetch(`/api/admin/recipes/comments?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("COMMENTS_LOAD_FAILED");
      const result = (await response.json()) as CommentPage;
      setComments((current) => append ? [...current, ...result.page] : result.page);
      setCursor(result.continueCursor || null);
      setIsDone(result.isDone);
    } catch {
      setError(labels.adminLoadError);
    } finally {
      setLoading(false);
    }
  }, [labels.adminLoadError, slug]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(null, false), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function remove(commentId: Id<"recipeComments">) {
    if (!window.confirm(labels.deleteConfirm)) return;
    setError(null);
    try {
      const response = await fetch("/api/admin/recipes/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (!response.ok) throw new Error("COMMENTS_DELETE_FAILED");
      setComments((current) => current.filter((comment) => comment._id !== commentId));
    } catch {
      setError(labels.adminDeleteError);
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <p className="type-label text-primary">{labels.adminEyebrow}</p>
        <h2 className="type-panel-title mt-2">{labels.adminTitle}</h2>
        <p className="type-body-sm mt-2 text-muted-foreground">{labels.adminDescription}</p>
      </div>
      {error ? <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p> : null}
      {!loading && comments.length === 0 ? <div className="grid place-items-center gap-2 rounded-xl bg-muted p-8 text-center text-muted-foreground"><MessageSquare /><p className="font-bold">{labels.adminEmpty}</p></div> : null}
      <div className="grid gap-3">
        {comments.map((comment) => (
          <article key={comment._id} className="grid gap-3 rounded-xl border border-border bg-background p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-black">{comment.authorName ?? labels.anonymous}</h3>
              <span className="type-meta text-muted-foreground">{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(comment._creationTime)}{comment.edited ? ` · ${labels.edited}` : ""}</span>
            </header>
            <p className="whitespace-pre-wrap text-sm font-semibold text-foreground/85">{comment.text}</p>
            {comment.photoUrl ? <div className="relative aspect-[16/9] max-w-md overflow-hidden rounded-lg bg-muted"><Image src={comment.photoUrl} alt={labels.photoAlt.replace("{author}", comment.authorName ?? labels.anonymous)} fill sizes="28rem" className="object-cover" /></div> : null}
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex gap-3 text-sm font-bold text-muted-foreground"><span className="inline-flex items-center gap-1"><ThumbsUp className="size-4" />{comment.thumbsUpCount}</span><span className="inline-flex items-center gap-1"><ThumbsDown className="size-4" />{comment.thumbsDownCount}</span></div>
              <Button type="button" size="sm" variant="destructive" onClick={() => remove(comment._id)}><Trash2 /> {labels.delete}</Button>
            </footer>
          </article>
        ))}
      </div>
      {loading ? <p className="text-sm font-semibold text-muted-foreground">{labels.loading}</p> : null}
      {!loading && !isDone && cursor ? <Button type="button" variant="outline" onClick={() => load(cursor, true)}>{labels.loadMore}</Button> : null}
    </div>
  );
}
