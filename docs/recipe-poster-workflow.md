# Créer l’affiche d’une recette

Le prompt actif est `buildRecipePosterPrompt` dans `lib/recipe-poster-prompt.ts`. Les prompts de `assets/recipe-posters/prompts.json` sont les archives de la première série, pas le modèle à modifier.

## Depuis le site

1. Remplir la recette, notamment le titre français, les ingrédients et la préparation. Le panneau « L’affiche de la recette » utilise les valeurs actuelles du formulaire, même avant leur sauvegarde.
2. Choisir la proposition visuelle : « 1 · Affiche éditoriale » conserve le premier prompt ; « 2 · Le plat crée la composition » utilise le second prompt avec photo dans les lettres, couches du plat, grille modulaire ou vapeur. Choisir ensuite la couleur et la composition/structure, puis copier le prompt prérempli.
3. Coller ce prompt dans un générateur d’images et générer une affiche verticale 9:16. La génération se fait dans cet outil, pas dans le site.
4. Conserver l’affiche pour le partage selon le registre décrit ci-dessous. Le panneau d’image principale sert à importer la photo affichée sur la recette.
5. Publier lorsque la photo principale et le contenu sont prêts. L’absence d’image bloque la publication dans l’interface et côté serveur. Le serveur vérifie la présence d’une image, pas sa provenance IA ni sa qualité visuelle.

## Lorsqu’une recette est créée avec Codex

Construire le prompt avec les données françaises de la nouvelle recette et la fonction partagée, puis utiliser l’outil de génération d’images disponible. Conserver le prompt exact avec l’asset généré. Examiner l’affiche et corriger les erreurs avant de l’importer dans la recette. Vérifier que l’image est associée au bon brouillon, puis publier la recette seulement dans le périmètre autorisé. Si la génération n’est pas disponible, conserver le brouillon et signaler l’étape restante.

Les affiches existantes sont conservées lors des modifications de texte. Régénérer si le plat représenté ou le texte de l’affiche n’est plus correct. Les pages publiques et les outils de partage réutilisent automatiquement l’image principale publiée.

## Séparation photo / affiche de partage

Les cartes, la page de recette et les aperçus de lien Open Graph / Twitter utilisent la photo réelle de la recette (`heroImageUrl`, Unsplash ou équivalent, avec crédit). Les affiches IA ne servent plus qu’au téléchargement ou au partage explicite de l’affiche. Les anciennes photos IA remplacées sont archivées dans `assets/recipe-posters/replaced-ai-photos/`. Le registre `assets/recipe-posters/share-images.json` associe chaque slug à son affiche publiée, indépendamment de la photo principale. En l’absence d’une entrée, le partage utilise la photo de la recette.

Pour une nouvelle affiche créée avec Codex, publier son fichier dans le stockage, ajouter ou mettre à jour ce registre et déployer le site. Conserver la photo principale et ses crédits. Le bouton d’import de l’image principale ne modifie pas le registre de partage. Les instructions de génération restent disponibles dans une section repliée de l’administration.
