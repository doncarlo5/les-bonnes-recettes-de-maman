"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, ImagePlus, MessageCircle, Share2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { siteUrl } from "@/lib/site";

export function RecipeShare({ locale, slug, title, dict }: {
  locale: Locale; slug: string; title: string; dict: Dictionary;
}) {
  const copy = dict.recipeShare;
  const [open, setOpen] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [poster, setPoster] = useState<File | null>(null);
  const [posterState, setPosterState] = useState<"loading" | "ready" | "error">("loading");
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const url = new URL(`/${locale}/recettes/${encodeURIComponent(slug)}`, siteUrl).href;
  const posterUrl = `/api/recipes/${encodeURIComponent(slug)}/poster?locale=${locale}`;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    // Prepare the file before the share click to preserve transient activation.
    void fetch(posterUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/jpeg")) {
          throw new Error("Poster unavailable");
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setDownloadUrl(objectUrl);
        setPoster(new File([blob], `${slug}.jpg`, { type: "image/jpeg" }));
        setPosterState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setPosterState("error");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, posterUrl, slug]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(copy.copied);
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setStatus(copy.copyManually);
    }
  }

  async function share(data: ShareData) {
    setSharing(true);
    setStatus("");
    try {
      await navigator.share(data);
    } catch (error) {
      // Cancelling the system sheet is a normal outcome, not an error.
      if (!(error instanceof Error && error.name === "AbortError")) {
        setStatus(copy.shareFailed);
      }
    } finally {
      setSharing(false);
    }
  }

  const canShareLink = open && typeof navigator !== "undefined" && typeof navigator.share === "function";
  const canSharePoster = canShareLink && poster && typeof navigator.canShare === "function" && navigator.canShare({ files: [poster] });

  return (
    <Dialog open={open} onOpenChange={(value: boolean) => {
      setOpen(value);
      if (value) { setStatus(""); setPosterState("loading"); setPoster(null); setDownloadUrl(""); }
    }}>
      <DialogTrigger render={<Button variant="outline" className="justify-start" />}>
        <Share2 aria-hidden="true" />{copy.trigger}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-5 sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg">{copy.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{title}</DialogDescription>
        </DialogHeader>
        <DialogClose render={<Button variant="ghost" size="icon" className="absolute right-2 top-2" aria-label={copy.close} />}><X aria-hidden="true" /></DialogClose>
        <div className="grid gap-2">
          {canShareLink && <Button disabled={sharing} onClick={() => void share({ title, url })}><Share2 aria-hidden="true" />{copy.shareLink}</Button>}
          <a className={buttonVariants({ variant: "outline" })} href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />WhatsApp</a>
          <label htmlFor={`share-link-${slug}`} className="mt-2 text-xs font-semibold text-muted-foreground">{copy.link}</label>
          <div className="flex min-w-0 gap-2">
            <input ref={linkInput} id={`share-link-${slug}`} readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
            <Button variant="outline" onClick={() => void copyLink()} aria-label={copy.copyLink}><Copy aria-hidden="true" />{copy.copy}</Button>
          </div>
        </div>
        <section className="grid gap-3 border-t border-border pt-4" aria-label={copy.posterTitle}>
          <h3 className="font-semibold">{copy.posterTitle}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{copy.instagramHelp}</p>
          {posterState === "loading" && <p role="status" className="text-sm text-muted-foreground">{copy.preparing}</p>}
          {posterState === "error" && <p role="status" className="text-sm text-destructive">{copy.posterFailed}</p>}
          {canSharePoster && <Button variant="outline" disabled={sharing} onClick={() => void share({ files: [poster] })}><ImagePlus aria-hidden="true" />{copy.sharePoster}</Button>}
          {downloadUrl ? (
            <a className={buttonVariants({ variant: "secondary" })} href={downloadUrl} download={`${slug}.jpg`}><Download aria-hidden="true" />{copy.download}</a>
          ) : (
            <Button variant="secondary" disabled><Download aria-hidden="true" />{copy.download}</Button>
          )}
        </section>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground empty:hidden">{status}</p>
      </DialogContent>
    </Dialog>
  );
}
