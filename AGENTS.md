<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

## Production-only workflow

This repository targets the Convex production deployment selected by
`CONVEX_DEPLOY_KEY` in `.env.local`. Use `npx convex deploy` for backend changes
and `npm run sync:recipe:production -- <slug>` to publish one seeded recipe.
Reserve `npm run sync:recipes:production` for an explicitly requested full
catalog sync. Do not run `npx convex dev` or create a development deployment.

<!-- convex-ai-end -->

## Affiche des nouvelles recettes

Pour chaque nouvelle recette, suivre [le parcours de création d’affiche](docs/recipe-poster-workflow.md) avant publication. Utiliser le prompt partagé dans `lib/recipe-poster-prompt.ts`, générer l’affiche 9:16, puis l’associer à la recette et vérifier son aperçu. Une recette sans image reste en brouillon.

## Portugais (Brésil) et néerlandais (Belgique)

Le site est servi en `fr`, `en`, `pt-br` et `nl-be`. L’admin n’édite que le français et l’anglais. Les traductions `pt-br` et `nl-be` de chaque recette publiée sont dans `convex/recipeTranslations/recipes/<slug>.json` : du texte uniquement, indexé par les ids d’ingrédients et d’étapes du français.

Pour une nouvelle recette ou une recette modifiée : écrire ou mettre à jour ce fichier à partir du français publié, lancer `npm run generate:recipe-translations-index`, déployer avec `npx convex deploy`, puis exécuter `npm run sync:recipe-translations:production`. La synchronisation valide chaque fichier contre la recette française publiée et n’applique rien en cas d’écart. Si la structure française change (ingrédient ou étape ajouté ou supprimé), la page affiche le français (`nl-be`) ou l’anglais (`pt-br`) jusqu’à la mise à jour de la traduction.
