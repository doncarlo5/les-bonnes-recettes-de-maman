"use client";

import Image from "next/image";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ImagePlus, Pencil, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import {
  RECIPE_COMMENT_MAX_PHOTO_BYTES,
  RECIPE_COMMENT_PHOTO_MIME_TYPES,
} from "@/lib/recipe-comment-policy";
import { uploadRecipeCommentPhoto } from "@/lib/recipe-comment-photo-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRecipeCommentParticipantKey } from "./use-recipe-comment-participant";

type CommentItem = {
  _id: Id<"recipeComments">;
  _creationTime: number;
  authorName: string | null;
  text: string;
  photoUrl: string | null;
  updatedAt: number | null;
  edited: boolean;
  thumbsUpCount: number;
  thumbsDownCount: number;
  viewerReaction: "up" | "down" | null;
  canEdit: boolean;
};

type CommentFormState = {
  authorName: string;
  text: string;
  honeypot: string;
  photo: File | null;
  photoEnabled: boolean;
  photoInputRevision: number;
  existingPhotoUrl: string | null;
  photoRemoved: boolean;
  editingId: Id<"recipeComments"> | null;
};

const initialCommentFormState: CommentFormState = {
  authorName: "",
  text: "",
  honeypot: "",
  photo: null,
  photoEnabled: false,
  photoInputRevision: 0,
  existingPhotoUrl: null,
  photoRemoved: false,
  editingId: null,
};

type CommentFormAction =
  | { type: "patch"; value: Partial<CommentFormState> }
  | { type: "reset" }
  | { type: "edit"; comment: CommentItem };

function commentFormReducer(state: CommentFormState, action: CommentFormAction): CommentFormState {
  if (action.type === "patch") return { ...state, ...action.value };
  if (action.type === "edit") {
    return {
      ...state,
      authorName: action.comment.authorName ?? "",
      text: action.comment.text,
      photo: null,
      photoEnabled: Boolean(action.comment.photoUrl),
      photoInputRevision: state.photoInputRevision + 1,
      existingPhotoUrl: action.comment.photoUrl,
      photoRemoved: false,
      editingId: action.comment._id,
    };
  }
  return { ...initialCommentFormState, photoInputRevision: state.photoInputRevision + 1 };
}

export function RecipeComments({ locale, dict, slug }: { locale: Locale; dict: Dictionary; slug: string }) {
  const labels = dict.recipeDetail.comments;
  const participantKey = useRecipeCommentParticipantKey();
  const [formState, dispatchForm] = useReducer(commentFormReducer, initialCommentFormState);
  const { authorName, text, honeypot, photo, photoEnabled, photoInputRevision, existingPhotoUrl, photoRemoved, editingId } = formState;
  const [pending, setPending] = useState(false);
  const [reactionPending, setReactionPending] = useState<Id<"recipeComments"> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const query = usePaginatedQuery(
    api.comments.list,
    participantKey ? { slug, participantKey } : "skip",
    { initialNumItems: 10 },
  );
  const createComment = useMutation(api.comments.create);
  const updateComment = useMutation(api.comments.update);
  const removeOwn = useMutation(api.comments.removeOwn);
  const setReaction = useMutation(api.comments.setReaction);
  const discardPhoto = useMutation(api.comments.discardPhoto);
  const photoPreviewUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }),
    [locale],
  );

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);

  function resetForm() {
    dispatchForm({ type: "reset" });
  }

  function startEditing(comment: CommentItem) {
    dispatchForm({ type: "edit", comment });
    setMessage(null);
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function selectPhoto(file: File | null) {
    setMessage(null);
    if (!file) {
      dispatchForm({ type: "patch", value: { photo: null } });
      return;
    }
    if (!(RECIPE_COMMENT_PHOTO_MIME_TYPES as readonly string[]).includes(file.type) || file.size > RECIPE_COMMENT_MAX_PHOTO_BYTES) {
      dispatchForm({ type: "patch", value: { photo: null, photoEnabled: true, photoInputRevision: photoInputRevision + 1 } });
      setMessage({ type: "error", text: labels.photoInvalid });
      return;
    }
    dispatchForm({ type: "patch", value: { photo: file, photoEnabled: true, photoRemoved: false } });
  }

  function togglePhoto(enabled: boolean) {
    dispatchForm({
      type: "patch",
      value: enabled
        ? { photoEnabled: true, photoRemoved: false }
        : {
            photo: null,
            photoEnabled: false,
            photoRemoved: Boolean(existingPhotoUrl || photo),
            photoInputRevision: photoInputRevision + 1,
          },
    });
  }

  async function uploadPhoto(file: File) {
    if (!participantKey) throw new Error("PARTICIPANT_KEY_MISSING");
    return uploadRecipeCommentPhoto({ file, slug, participantKey, honeypot });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participantKey || pending) return;
    if (!text.trim()) {
      setMessage({ type: "error", text: labels.textRequired });
      return;
    }
    if (photoEnabled && !photo && !(existingPhotoUrl && !photoRemoved)) {
      setMessage({ type: "error", text: labels.photoRequired });
      return;
    }
    setPending(true);
    setMessage(null);
    let uploadedStorageId: Id<"_storage"> | undefined;
    try {
      if (photo) uploadedStorageId = await uploadPhoto(photo);
      if (editingId) {
        await updateComment({
          commentId: editingId,
          participantKey,
          authorName,
          text,
          photoAction: uploadedStorageId ? "replace" : photoRemoved ? "remove" : "keep",
          ...(uploadedStorageId ? { photoStorageId: uploadedStorageId } : {}),
        });
        setMessage({ type: "success", text: labels.updated });
      } else {
        await createComment({
          slug,
          participantKey,
          authorName,
          text,
          honeypot,
          ...(uploadedStorageId ? { photoStorageId: uploadedStorageId } : {}),
        });
        setMessage({ type: "success", text: labels.success });
      }
      resetForm();
    } catch (error) {
      if (uploadedStorageId) await discardPhoto({ storageId: uploadedStorageId, participantKey }).catch(() => undefined);
      setMessage({ type: "error", text: String(error).includes("COMMENT_RATE_LIMITED") ? labels.rateLimited : labels.error });
    } finally {
      setPending(false);
    }
  }

  async function deleteComment(commentId: Id<"recipeComments">) {
    if (!participantKey || !window.confirm(labels.deleteConfirm)) return;
    setMessage(null);
    try {
      await removeOwn({ commentId, participantKey });
      if (editingId === commentId) resetForm();
    } catch {
      setMessage({ type: "error", text: labels.error });
    }
  }

  async function react(comment: CommentItem, direction: "up" | "down") {
    if (!participantKey || reactionPending) return;
    setReactionPending(comment._id);
    setMessage(null);
    try {
      await setReaction({
        commentId: comment._id,
        participantKey,
        direction: comment.viewerReaction === direction ? null : direction,
      });
    } catch (error) {
      setMessage({ type: "error", text: String(error).includes("COMMENT_RATE_LIMITED") ? labels.rateLimited : labels.error });
    } finally {
      setReactionPending(null);
    }
  }

  const displayedPhoto = photoPreviewUrl ?? (!photoRemoved ? existingPhotoUrl : null);
  const formattedDate = (timestamp: number) => dateFormatter.format(timestamp);

  return (
    <section className="border-t border-border px-5 py-16 lg:px-10 lg:py-24" aria-labelledby="recipe-comments-title">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
        <div>
          <p className="type-label text-primary">{labels.title}</p>
          <h2 id="recipe-comments-title" className="type-section-title mt-3">{labels.title}</h2>
          <p className="type-body mt-4 max-w-[42ch] text-muted-foreground">{labels.description}</p>
          <form ref={formRef} onSubmit={submit} className="mt-8 grid gap-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]" aria-busy={pending}>
            <div className="grid gap-2">
              <label htmlFor="comment-author" className="type-label text-foreground">{labels.authorLabel}</label>
              <Input id="comment-author" value={authorName} maxLength={60} placeholder={labels.authorPlaceholder} onChange={(event) => dispatchForm({ type: "patch", value: { authorName: event.target.value } })} />
            </div>
            <div className="grid gap-2">
              <label htmlFor="comment-text" className="type-label text-foreground">{labels.textLabel}</label>
              <Textarea id="comment-text" value={text} maxLength={1500} rows={5} placeholder={labels.textPlaceholder} onChange={(event) => dispatchForm({ type: "patch", value: { text: event.target.value } })} />
              <span className="type-meta justify-self-end text-muted-foreground tabular-nums">{text.length}/1500</span>
            </div>
            <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
              <label htmlFor="comment-website">Website</label>
              <input id="comment-website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => dispatchForm({ type: "patch", value: { honeypot: event.target.value } })} />
            </div>
            <div className="grid gap-3">
              <div className="flex min-h-14 items-center justify-between gap-4 rounded-xl bg-muted/60 px-4 py-3 shadow-[var(--shadow-border)]">
                <div className="grid gap-1">
                  <label htmlFor="comment-photo-toggle" className="type-label cursor-pointer text-foreground">{labels.photoLabel}</label>
                  <p className="type-meta text-muted-foreground">{labels.photoHelp}</p>
                </div>
                <Switch className="cursor-pointer after:-inset-y-[13px]" id="comment-photo-toggle" checked={photoEnabled} onCheckedChange={togglePhoto} aria-controls="comment-photo-picker" />
              </div>
              {photoEnabled ? (
                <div id="comment-photo-picker">
                  <input key={photoInputRevision} id="comment-photo" className="peer sr-only" type="file" accept={RECIPE_COMMENT_PHOTO_MIME_TYPES.join(",")} aria-label={labels.choosePhoto} onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)} />
                  <label htmlFor="comment-photo" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-background px-4 text-sm font-semibold text-foreground shadow-[var(--shadow-border)] transition-[scale,box-shadow] duration-150 active:scale-[0.96] peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                    <ImagePlus className="size-4" />
                    {labels.choosePhoto}
                  </label>
                </div>
              ) : null}
            </div>
            {displayedPhoto ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                <Image src={displayedPhoto} alt="" fill unoptimized={displayedPhoto.startsWith("blob:")} sizes="20rem" className="object-cover" />
                <Button type="button" size="icon-sm" variant="secondary" className="absolute right-2 top-2" aria-label={labels.removePhoto} onClick={() => togglePhoto(false)}><X /></Button>
              </div>
            ) : null}
            {message ? <p role="status" className={`text-sm font-semibold ${message.type === "error" ? "text-destructive" : "text-primary"}`}>{message.text}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || !participantKey}>{pending ? labels.loading : editingId ? labels.save : labels.publish}</Button>
              {editingId ? <Button type="button" variant="outline" onClick={resetForm}>{labels.cancel}</Button> : null}
            </div>
          </form>
        </div>

        <div className="min-w-0" aria-live="polite">
          {!participantKey || query.status === "LoadingFirstPage" ? <p className="type-body text-muted-foreground">{labels.loading}</p> : null}
          {query.status !== "LoadingFirstPage" && query.results.length === 0 ? <p className="rounded-2xl bg-muted p-6 text-center font-semibold text-muted-foreground">{labels.empty}</p> : null}
          <div className="grid gap-5">
            {(query.results as CommentItem[]).map((comment) => {
              const author = comment.authorName ?? labels.anonymous;
              return (
                <article key={comment._id} className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
                  <header className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-black text-foreground">{author}</h3>
                    <p className="type-meta text-muted-foreground">{formattedDate(comment._creationTime)}{comment.edited ? ` · ${labels.edited}` : ""}</p>
                  </header>
                  <p className="type-body mt-3 whitespace-pre-wrap text-foreground/90">{comment.text}</p>
                  {comment.photoUrl ? (
                    <Dialog>
                      <DialogTrigger className="relative mt-4 block aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted text-left">
                        <Image src={comment.photoUrl} alt={labels.photoAlt.replace("{author}", author)} fill sizes="(max-width: 768px) 100vw, 38rem" className="object-cover transition-transform duration-200 hover:scale-[1.02]" />
                        <span className="sr-only">{labels.openPhoto.replace("{author}", author)}</span>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl bg-black p-2" showCloseButton>
                        <DialogHeader className="sr-only"><DialogTitle className="">{labels.openPhoto.replace("{author}", author)}</DialogTitle><DialogDescription className="">{comment.text}</DialogDescription></DialogHeader>
                        <div className="relative aspect-[4/3] overflow-hidden rounded-lg"><Image src={comment.photoUrl} alt={labels.photoAlt.replace("{author}", author)} fill sizes="90vw" className="object-contain" /></div>
                      </DialogContent>
                    </Dialog>
                  ) : null}
                  <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex gap-2" role="group" aria-label={labels.title}>
                      <Button type="button" size="sm" variant={comment.viewerReaction === "up" ? "secondary" : "ghost"} aria-pressed={comment.viewerReaction === "up"} aria-label={labels.thumbUp} disabled={reactionPending === comment._id} onClick={() => react(comment, "up")}><ThumbsUp /> {comment.thumbsUpCount}</Button>
                      <Button type="button" size="sm" variant={comment.viewerReaction === "down" ? "secondary" : "ghost"} aria-pressed={comment.viewerReaction === "down"} aria-label={labels.thumbDown} disabled={reactionPending === comment._id} onClick={() => react(comment, "down")}><ThumbsDown /> {comment.thumbsDownCount}</Button>
                    </div>
                    {comment.canEdit ? <div className="flex gap-1"><Button type="button" size="sm" variant="ghost" onClick={() => startEditing(comment)}><Pencil /> {labels.edit}</Button><Button type="button" size="sm" variant="destructive" onClick={() => deleteComment(comment._id)}><Trash2 /> {labels.delete}</Button></div> : null}
                  </footer>
                </article>
              );
            })}
          </div>
          {query.status === "CanLoadMore" ? <Button type="button" variant="outline" className="mt-6 w-full" onClick={() => query.loadMore(10)}>{labels.loadMore}</Button> : null}
        </div>
      </div>
    </section>
  );
}
