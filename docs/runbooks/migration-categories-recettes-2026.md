# Migration 2026 des catégories de recette

Cette migration suit `widen → migrate → narrow` et doit être déployée en plusieurs étapes techniques, même si l’interface est activée en une seule bascule.

## 1. Widen et compatibilité

Déployer le schéma qui accepte `tags`, `categories` et `legacyCategoryLabels`, puis le code en dual-read/write. Les écritures produisent les catégories canoniques et maintiennent `tags` pendant la transition. Les lectures anciennes sont séparées entre valeurs canoniques et libellés legacy.

## 2. Vérifier puis migrer

Exécuter d’abord le dry-run :

```sh
npx convex run migrations:runCategoryBackfill '{"dryRun":true}'
```

Vérifier les volumes recettes/brouillons et les libellés inconnus, puis lancer la migration idempotente :

```sh
npx convex run migrations:runCategoryBackfill
```

La commande peut être relancée. Elle réconcilie aussi les documents qui possèdent déjà `categories` avec leurs `tags`, afin de conserver tout libellé legacy ajouté pendant la période de coexistence.

## 3. Bascule visible

Déployer l’interface Combobox. Les valeurs legacy restent visibles dans l’éditeur jusqu’à leur remplacement ou suppression explicite. Elles ne bloquent pas la version publique et n’affectent pas les filtres.

## 4. Narrow

Après vérification qu’aucun document recette ou brouillon ne contient de valeur legacy :

1. arrêter le dual-write `tags` ;
2. retirer `tags` et `legacyCategoryLabels` des données par migration ;
3. resserrer le schéma Convex ;
4. retirer les chemins de compatibilité applicatifs.

Ne jamais resserrer le schéma avant la fin de la vérification en production.
