# ADR 0010 — Remplacer les commentaires par des Réalisations de recette

## Statut

Accepté — 4 août 2026.

## Contexte

Les commentaires mélangeaient récit, astuce, réaction et photo facultative. Le produit veut surtout donner envie de cuisiner en montrant des résultats concrets et comparables, sans prétendre compter des personnes distinctes.

## Décision

La contribution publique principale devient la `Réalisation de recette` : une photo obligatoire correspondant à une occasion de cuisine, avec nom, légende et description visuelle facultatifs. Un Participant peut publier plusieurs Réalisations pour une même recette. Les interfaces publiques utilisent « Vos réalisations » en français et « Community makes » en anglais.

Les commentaires existants restent temporairement dans le schéma pendant le déploiement widen–clean–narrow, mais ne sont pas migrés vers les Réalisations.

## Conséquences

Le nombre affiché est toujours le nombre exact de Réalisations publiées, jamais un nombre de personnes. Les nouvelles lectures, écritures, images, réactions et outils de modération utilisent un modèle indépendant des anciens commentaires.
