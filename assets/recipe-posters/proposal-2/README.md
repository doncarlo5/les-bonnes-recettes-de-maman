# Proposition 2 — le plat crée la composition

Génération avec l’outil intégré `image_gen`, le 7 septembre 2026, depuis les recettes publiées et le second prompt conservé dans `lib/recipe-poster-prompt.ts`.

- **Macaron tante Maria** : grille éditoriale modulaire. Image finale : `public/images/recipes/posters/macaron-tante-maria-fr-v2.webp`. Prompt exact : `macaron-tante-maria.prompt.txt`.
- **Pâtes carbonara** : affiche « steam veil » déjà générée et approuvée dans la conversation, réutilisée sans nouvelle génération. Image finale : `public/images/recipes/posters/pates-carbonara-fr-v2.webp`.
- **Amandin** : photo dans les lettres. Image finale : `public/images/recipes/posters/amandin-fr-v2.webp`. Prompt exact : `amandin.prompt.txt`.

Ces trois affiches sont désormais réservées au partage. Les premières affiches restent disponibles dans leurs fichiers d’origine. `previous-publication.json` conserve leurs anciennes références.

Le formulaire propose les deux prompts. La proposition 1 reste le choix initial ; la proposition 2 offre les quatre structures du nouveau prompt.

## Extension aux 37 autres recettes

Les 37 affiches supplémentaires utilisent le second prompt partagé, renseigné à partir des recettes françaises publiées. Génération avec l’outil intégré `image_gen`, inspection visuelle, puis export WebP 1080 × 1920 à qualité 88. Les coulants ont été allégés en texte et le lettrage de la marque sur les papillotes a été corrigé.

- `prompts-all.json` : prompts exacts et retouches.
- `generated-all.json` : fichiers PNG sources sélectionnés ; les livrables du projet sont dans `public/images/recipes/posters/<slug>-fr-v2.webp`.
- `previous-share-images.json` : les 40 références de partage avant ce remplacement.
- `sharing-publication.json` : les 37 nouveaux fichiers stockés, leurs empreintes et les anciennes références.
- `../share-images.json` : les 40 affiches actuellement utilisées pour le partage.

Pour reprendre le transfert : `node --env-file=.env.local scripts/publish-sharing-posters.mjs`, puis déployer le site. Ce script vérifie les fichiers et les recettes, sans modifier leurs photos, leurs crédits ou leur contenu. Ne pas utiliser l’ancien script `publish-recipe-posters.mjs`, qui remplaçait les photos principales.
