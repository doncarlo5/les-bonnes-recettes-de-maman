"use client";

import { useRef, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildRecipePosterPrompt, type PosterRecipe, type RecipePosterProposal } from "@/lib/recipe-poster-prompt";

export function RecipePosterStep({ recipe, hasImage }: { recipe: PosterRecipe; hasImage: boolean }) {
  const [proposal, setProposal] = useState<RecipePosterProposal>("editorial");
  const [structure, setStructure] = useState("modular editorial grid");
  const [accent, setAccent] = useState("burgundy");
  const [layout, setLayout] = useState("annotated flat lay");
  const [copySource, setCopySource] = useState("");
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const prompt = buildRecipePosterPrompt(recipe, { accent, layout, proposal, structure });
  const ready = Boolean(recipe.title.trim() && recipe.ingredients.some((item) => item.name.trim()));

  async function copyPrompt() {
    setCopySource(prompt);
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("Prompt copié. Colle-le dans ton générateur d’images, puis conserve l’affiche pour le partage.");
    } catch {
      setExpanded(true);
      setStatus("Sélectionne et copie le prompt ci-dessous.");
      requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.select(); });
    }
  }

  return (
    <section aria-label="Générer l’affiche" className="grid gap-3 rounded-xl border border-primary/20 bg-background p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4" aria-hidden="true" />L’affiche de la recette</h3>
      <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
        <li>Complète le titre et les ingrédients, puis copie le prompt.</li>
        <li>Génère l’affiche avec ce prompt dans ton outil d’images.</li>
        <li>Conserve l’affiche pour le partage, séparément de la photo principale.</li>
      </ol>
      <label className="grid gap-1 text-xs font-semibold">Proposition visuelle
        <select aria-label="Proposition visuelle" value={proposal} onChange={(event) => setProposal(event.target.value as RecipePosterProposal)} className="min-h-11 min-w-0 rounded-lg border border-border bg-background px-2 text-sm">
          <option value="editorial">1 · Affiche éditoriale</option>
          <option value="food-structure">2 · Le plat crée la composition</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <label className="grid gap-1 text-xs font-semibold">Couleur d’accent
          <select aria-label="Couleur d’accent" value={accent} onChange={(event) => { setAccent(event.target.value); setStatus(""); }} className="min-h-11 min-w-0 rounded-lg border border-border bg-background px-2 text-sm">
            <option value="burgundy">Bordeaux</option><option value="forest green">Vert forêt</option><option value="cobalt blue">Bleu cobalt</option>
          </select>
        </label>
        {proposal === "food-structure" ? (
          <label className="grid gap-1 text-xs font-semibold">Structure
            <select aria-label="Structure de l’affiche" value={structure} onChange={(event) => setStructure(event.target.value)} className="min-h-11 min-w-0 rounded-lg border border-border bg-background px-2 text-sm">
              <option value="photo-filled type">Photo dans les lettres</option>
              <option value="food layers as grid">Couches du plat comme grille</option>
              <option value="modular editorial grid">Grille éditoriale modulaire</option>
              <option value="steam veil">Voile de vapeur</option>
            </select>
          </label>
        ) : <label className="grid gap-1 text-xs font-semibold">Composition
          <select aria-label="Composition de l’affiche" value={layout} onChange={(event) => { setLayout(event.target.value); setStatus(""); }} className="min-h-11 min-w-0 rounded-lg border border-border bg-background px-2 text-sm">
            <option value="annotated flat lay">Vue de dessus annotée</option><option value="diagonal split">Composition diagonale</option><option value="circular typography">Typographie circulaire</option><option value="oversized type">Grand titre expressif</option>
          </select>
        </label>}
      </div>
      <Button type="button" disabled={!ready} onClick={() => void copyPrompt()}><Copy aria-hidden="true" />Copier le prompt de l’affiche</Button>
      {!ready && <p className="text-xs text-muted-foreground">Le titre français et au moins un ingrédient sont nécessaires pour préparer le prompt.</p>}
      <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="cursor-pointer text-sm font-semibold">Voir le prompt prérempli</summary>
        <textarea ref={textarea} aria-label="Prompt de génération de l’affiche" readOnly value={prompt} rows={10} className="mt-2 w-full min-w-0 rounded-lg border border-border bg-background p-3 text-xs" />
      </details>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">{copySource === prompt ? status : ""}</p>
      <p className="text-xs font-semibold text-primary">{hasImage ? "Affiche de partage disponible." : "Affiche de partage à préparer."}</p>
    </section>
  );
}
