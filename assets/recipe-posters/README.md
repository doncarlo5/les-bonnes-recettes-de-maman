# Recipe posters

Forty French editorial posters generated with the built-in image generator from the published production recipes on 2026-09-07. The approved bolognaise sample is reused. Posters are shared by the French and English pages; recipe labels remain localized in HTML.

- `manifest.json` maps every recipe slug to its optimized WebP in `public/images/recipes/posters/`.
- `prompts.json` contains the exact generation prompts and recipe context for the 39 new posters. The original bolognaise prompt is in `public/images/recipes/posters/sauce-bolognaise-fr-v1.prompt.txt`.
- `publication.json` records upload hashes, previous image URLs and credits, storage IDs, and published revisions for resuming or auditing this rollout. Previous stored images are retained.

The generated PNG originals remain in the image generator's output directory. The committed WebP assets preserve the full portrait composition at quality 88. Cards and recipe headers use 9:16 containers with `object-contain`; link previews contain the poster beside a localized title on a 1200 × 630 cream canvas.

## Publish existing assets

**Historique uniquement :** les commandes ci-dessous remplacent la photo principale. Pour les affiches réservées au partage, utiliser `scripts/publish-sharing-posters.mjs` et les instructions de [la proposition 2](proposal-2/README.md).

The script requires `CONVEX_PRODUCTION_URL`, `RECIPE_ADMIN_PASSWORD`, and `CONVEX_DEPLOY_KEY` in `.env.local`. It uploads through the existing authenticated image API and invokes the deployed internal `recipes:publishImageOnly` mutation. This changes only the image of an already published recipe, checks the revision, and refuses any pending content changes. It does not run a catalog sync.

```sh
# Inspect one recipe, or replace the slug with --all for the manifest.
node --env-file=.env.local scripts/publish-recipe-posters.mjs sauce-bolognaise

# Apply after inspection. Completed entries are skipped on subsequent runs.
node --env-file=.env.local scripts/publish-recipe-posters.mjs --all --apply
```

For new recipes, fill the same editorial prompt with their current contents, generate and inspect one poster, save its optimized asset, and add it to the manifest. Publishing assets does not deploy the Next.js frontend; card/layout changes ship with the normal frontend release.

## Deuxième proposition

Le formulaire conserve les deux prompts dans `lib/recipe-poster-prompt.ts`. Les remplacements du macaron et de l’amandin, leurs prompts exacts et les anciennes références sont documentés dans [proposal-2/README.md](proposal-2/README.md).

## Photos dans le site, affiches dans le partage

Les photos initiales et leurs crédits sont restaurés depuis `original-images.json`. Les affiches restent conservées et référencées indépendamment dans `share-images.json` pour les aperçus de liens et le partage de fichiers. `photo-restoration.json` journalise la restauration ; `publication.json` reste l’archive des affiches, pas un reflet des photos principales actuelles.
