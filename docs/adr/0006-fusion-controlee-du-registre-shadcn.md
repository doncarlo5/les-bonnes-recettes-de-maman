# ADR 0006 — Fusion contrôlée du registre shadcn

## Statut

Accepté — 20 juillet 2026.

## Contexte

Le projet utilise le registre shadcn comme source de primitives Base UI, mais plusieurs composants locaux portent des invariants produit : cibles tactiles d’au moins 44 px, typographie éditoriale, tokens de couleur, arrondis et mouvements. Un écrasement automatique du catalogue supprimerait ces décisions et rendrait les mises à jour difficiles à relire.

## Décision

Le registre shadcn est un upstream à fusionner, jamais une source qui écrase automatiquement `components/ui`. Chaque mise à jour est inspectée avec le diff du CLI. Les corrections d’API, d’accessibilité et de compatibilité sont intégrées, tandis que les invariants visuels et accessibles locaux restent autoritaires. `button.tsx` demeure l’unique implémentation de bouton.

Les primitives sans usage concret peuvent rester disponibles dans le catalogue sans être importées par l’application.

ESLint reste temporairement en `9.39.5`. Le couple `eslint@10.7.0` / `eslint-config-next@16.2.10` échoue au chargement des plugins Next et React Hooks ; conserver la dernière version 9 évite de désactiver des règles ou de masquer des erreurs. Le passage à ESLint 10 sera repris dès qu’une version compatible d’`eslint-config-next` sera disponible.

## Conséquences

- Chaque montée de version demande une revue explicite des composants divergents.
- Les écarts intentionnels sont visibles dans le diff et validés par TypeScript, React Doctor, les tests et les snapshots ciblés.
- Les migrations de moteur, comme Drawer de Vaul vers Base UI, sont faites manuellement et l’ancienne dépendance est retirée.
- L’exception ESLint est explicite et contrôlée par `npm outdated`, au lieu d’être contournée par une configuration lint dégradée.
