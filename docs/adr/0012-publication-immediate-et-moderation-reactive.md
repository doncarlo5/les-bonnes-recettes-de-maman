# ADR 0012 — Publier immédiatement avec une modération réactive

## Statut

Accepté — 4 août 2026.

## Contexte

Une prémodération ralentirait fortement la boucle de partage d’un petit carnet familial. Une analyse automatique externe ajouterait des coûts, des transferts de contenu et des décisions difficiles à expliquer.

## Décision

Une Réalisation est publiée dès que le serveur a validé, décodé et assaini sa photo. La v1 n’utilise ni IA de modération, ni CAPTCHA. Chaque visiteur peut signaler une Réalisation avec un motif ; le contenu reste public jusqu’à une décision humaine.

La modération peut classer un signalement, retirer ou restaurer une Réalisation, et bloquer la session d’origine. Un retrait administratif est restaurable pendant 30 jours avant purge. Une suppression par l’auteur purge immédiatement les images.

## Conséquences

Le produit accepte une fenêtre d’exposition avant revue. Les limites de débit, le coupe-circuit d’upload, la file globale de signalements et l’adresse `pro.julien.thomas@gmail.com` réduisent le risque opérationnel sans ajouter de friction systématique à chaque publication.
