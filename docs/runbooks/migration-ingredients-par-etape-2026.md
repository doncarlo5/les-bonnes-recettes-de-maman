# Migration des ingrédients par étape

Cette évolution suit deux déploiements afin que les recettes et brouillons existants restent lisibles pendant le backfill.

1. Déployer le schéma élargi et le code en lecture double de ce changement.
2. Vérifier une première batch sans écriture :

   ```sh
   npx convex run migrations:runStepIngredientBackfill '{"dryRun":true}' --prod
   ```

3. Lancer le backfill de `recipes` puis `recipeDrafts` :

   ```sh
   npx convex run migrations:runStepIngredientBackfill --prod
   ```

4. Suivre la migration jusqu’à son achèvement :

   ```sh
   npx convex run --component migrations lib:getStatus --watch --prod
   ```

Le backfill attribue des identifiants déterministes et crée `stepDetails` avec des associations vides. Il ne tente aucune détection d’ingrédients dans le texte.

Après vérification sur les deux tables, un second déploiement pourra rendre les identifiants et `stepDetails` obligatoires. Le champ historique `steps` restera alors facultatif et déprécié pendant la période de retour arrière.
