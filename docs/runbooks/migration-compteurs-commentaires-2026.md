# Migration des compteurs de commentaires

Cette migration initialise `recipeCommentSummaries` pour les commentaires déjà
présents. Les nouveaux commentaires sont comptés dès leur création, grâce au
marqueur `countedAt`; la migration peut donc s’exécuter pendant que le site reste
accessible sans compter deux fois un commentaire.

## Déploiement

1. Déployer le schéma, l’écriture du compteur et sa lecture sur les cartes.
2. Vérifier la migration en lecture seule sur la production :

   ```sh
   npx convex run migrations:runRecipeCommentCountBackfill '{"dryRun":true}' --prod
   ```

3. Lancer le backfill :

   ```sh
   npx convex run migrations:runRecipeCommentCountBackfill --prod
   ```

4. Suivre son avancement jusqu’à la fin :

   ```sh
   npx convex run --component migrations lib:getStatus --watch --prod
   ```

Pendant le backfill, les compteurs des anciennes recettes apparaissent
progressivement. Une relance est sans danger : les commentaires portant déjà
`countedAt` sont ignorés.
