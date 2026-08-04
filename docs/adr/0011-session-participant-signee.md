# ADR 0011 — Représenter le Participant par une session serveur signée

## Statut

Accepté — 4 août 2026. Remplace l’ADR 0004 pour les Réalisations de recette.

## Contexte

Une clé créée et lisible par JavaScript côté client est facile à copier ou modifier et ne convient pas pour établir la propriété durable d’une contribution contenant une photo.

## Décision

La participation reste sans compte. Le serveur crée un identifiant pseudonyme aléatoire et le conserve dans un cookie signé `Secure`, `HttpOnly`, `SameSite=Lax`. Les API Next.js vérifient ce cookie puis transmettent uniquement son condensat aux fonctions Convex. Les adresses réseau servent seulement à une limite anti-abus après HMAC avec un secret distinct.

## Conséquences

Le navigateur d’origine peut modifier, remplacer ou supprimer ses Réalisations. Une session bloquée ne peut plus publier, envoyer un Bravo ou signaler. La perte du cookie entraîne la perte des commandes de propriété, avec recours possible par l’adresse de contact publique.
