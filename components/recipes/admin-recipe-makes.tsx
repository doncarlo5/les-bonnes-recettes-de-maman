"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Ban, Check, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ModerationItem = {
  make: {
    _id: string;
    authorName: string | null;
    caption: string | null;
    thumbnailUrl: string | null;
    state: "published" | "removed" | "blocked";
  };
  participantDigest: string;
  openReportCount: number;
  reports: Array<{
    _id: string;
    reason: "spam" | "inappropriate" | "privacy" | "copyright" | "other";
    details: string | null;
  }>;
};

type QueueResponse = { page: ModerationItem[]; continueCursor: string; isDone: boolean };

export function AdminRecipeMakes() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextCursor: string | null = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      const response = await fetch(`/api/admin/recipes/makes?${params}`, { cache: "no-store" });
      const body = await response.json() as QueueResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Impossible de charger la modération.");
      setItems((current) => nextCursor ? [...current, ...body.page] : body.page);
      setCursor(body.continueCursor || null);
      setDone(body.isDone);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger la modération.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const act = useCallback(async (payload: Record<string, string>) => {
    setError(null);
    const response = await fetch("/api/admin/recipes/makes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof body.error === "string" ? body.error : "Action de modération impossible.");
      return;
    }
    await load();
  }, [load]);

  return (
    <div className="grid gap-5">
      <div>
        <p className="type-label text-primary">Modération</p>
        <h2 className="type-panel-title mt-2">Réalisations signalées</h2>
        <p className="mt-2 text-sm text-muted-foreground">Les signalements n’entraînent aucun masquage automatique.</p>
      </div>
      {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      {!loading && items.length === 0 ? <p className="text-sm text-muted-foreground">Aucun signalement en attente.</p> : null}
      {items.map((item) => (
        <article key={item.make._id} className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-[9rem_1fr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
            {item.make.thumbnailUrl ? <Image src={item.make.thumbnailUrl} alt="" fill sizes="9rem" className="object-cover" /> : null}
          </div>
          <div>
            <h3 className="font-semibold">{item.make.caption || "Réalisation sans légende"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.make.authorName || "Anonyme"} · {item.openReportCount} signalement(s) ouvert(s)</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {item.reports.map((report) => (
                <li key={report._id} className="rounded-lg bg-muted p-3">
                  <span className="font-semibold">{report.reason}</span>{report.details ? ` — ${report.details}` : ""}
                  <Button className="ml-3" size="sm" variant="ghost" onClick={() => void act({ action: "dismiss", reportId: report._id })}>Classer</Button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.make.state !== "published" ? (
                <Button size="sm" variant="outline" onClick={() => void act({ action: "restore", makeId: item.make._id })}><Check />Restaurer</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void act({ action: "remove", makeId: item.make._id, reason: "signalement validé" })}><EyeOff />Retirer</Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => void act({ action: "block", makeId: item.make._id, participantDigest: item.participantDigest, reason: "session bloquée par modération" })}><Ban />Bloquer la session</Button>
            </div>
          </div>
        </article>
      ))}
      {loading ? <p className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Chargement…</p> : null}
      {!loading && !done && cursor ? <Button variant="outline" onClick={() => void load(cursor)}>Voir la suite</Button> : null}
    </div>
  );
}
