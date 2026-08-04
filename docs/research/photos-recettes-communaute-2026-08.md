# Photos de réalisations par la communauté — pratiques 2026

Date de recherche : 4 août 2026

## Décision recommandée

Créer une contribution dédiée « J’ai fait cette recette », distincte d’un commentaire général : une photo, un court texte facultatif, un nom facultatif, un état de modération et une relation vers la recette. Afficher les contributions approuvées dans une galerie « Cuisinée par la communauté » et proposer l’ajout au moment où la personne termine le mode cuisine ainsi qu’en bas de la recette.

Pour ce petit carnet public sans compte, le meilleur compromis initial est une publication optimiste privée — la contribution est visible immédiatement par son auteur avec l’état « en attente » — puis une publication publique après approbation manuelle. L’automatisation de la modération peut venir plus tard si le volume la justifie.

## Expérience produit

- Employer un appel à l’action lié à l’accomplissement : « J’ai fait cette recette » ou « Ajouter mon résultat », plutôt que « Ajouter un commentaire ».
- Placer l’appel à l’action à la fin du mode cuisine et dans la galerie de la recette. Afficher aussi un compteur, par exemple « 12 personnes l’ont cuisinée ».
- Autoriser une photo et une légende courte facultative. Ne pas exiger un texte de commentaire pour publier une photo.
- Montrer un aperçu, une progression d’envoi, la possibilité de remplacer la photo et une confirmation claire. Sur mobile, proposer le sélecteur de fichiers standard ; `capture="environment"` peut être un raccourci vers l’appareil photo, mais sa compatibilité reste incomplète, donc il ne doit pas être l’unique parcours ([MDN, attribut `capture`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)).
- Ne conserver qu’une réaction positive (« J’aime » ou « Bravo ») sur les réalisations. Un vote négatif transforme une mécanique d’encouragement en concours de qualité et crée un vecteur d’abus.
- Demander une description visuelle courte de la photo, avec une valeur par défaut contextualisée si elle est omise. Les images informatives doivent avoir une alternative textuelle qui transmet leur information essentielle ([W3C WAI, Images Tutorial](https://www.w3.org/WAI/tutorials/images/)).

## Modèle Convex conseillé

Utiliser une table enfant séparée, par exemple `recipeMakes`, plutôt qu’un tableau dans `recipes` et plutôt qu’un simple champ optionnel sur `recipeComments` :

- `recipeId`, `ownerDigest`, `photoStorageId`, `thumbnailStorageId`
- `caption?`, `altText?`, `authorName?`
- `status: "pending" | "approved" | "rejected"`
- `moderatedAt?`, `moderationReason?`, `updatedAt?`
- index `by_recipeId_and_status` et index opérationnels pour la file de modération

Une URL Convex Storage est une URL porteuse réutilisable par toute personne qui la possède. Il faut donc ne produire les URL publiques que pour les contributions approuvées ; les fichiers en attente peuvent être servis seulement à l’auteur et à l’administration, ou rester non exposés ([Convex, Serving Files](https://docs.convex.dev/file-storage/serve-files)). Convex documente l’envoi direct par URL temporaire ou l’envoi contrôlé par HTTP Action ; l’HTTP Action convient aux fichiers inférieurs à 20 Mo et exige une configuration CORS exacte ([Convex, Uploading and Storing Files](https://docs.convex.dev/file-storage/upload-files)).

## Pipeline image obligatoire

Le serveur reste l’autorité, même si le navigateur réduit l’image pour améliorer la vitesse :

1. Vérifier une liste blanche de formats, la taille en octets, les dimensions, le nombre de pixels et la signature réelle ; ne jamais faire confiance au nom ou au `Content-Type` du client.
2. Décoder complètement l’image avec une bibliothèque à jour et une limite de pixels/temps.
3. Appliquer l’orientation, limiter le grand côté (environ 1 600 à 2 048 px), réencoder dans un format connu et créer une miniature (environ 480 px).
4. Supprimer EXIF, GPS, XMP et autres métadonnées. Sharp retire les métadonnées par défaut lors d’un véritable encodage et fournit `autoOrient()` pour appliquer l’orientation avant suppression ([Sharp, Output options](https://sharp.pixelplumbing.com/api-output/), [Sharp, Image operations](https://sharp.pixelplumbing.com/api-operation/)).
5. Stocker uniquement les dérivés assainis et supprimer l’original dès que le traitement réussit ou échoue.
6. Nettoyer par tâche planifiée les envois abandonnés et les contributions rejetées arrivées à expiration.

OWASP recommande une défense en profondeur : formats autorisés, validation de type et de signature, limites, noms générés, stockage séparé, réécriture des images, protection CSRF, modération et mécanisme de signalement ([OWASP, File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)).

## Modération, abus et conformité

- Pour le MVP, approuver manuellement les photos avant exposition publique. Ajouter dès le départ « Signaler » sur chaque contribution, une file d’administration et une adresse de contact publiée.
- Publier des règles courtes : photo du résultat culinaire, contenu dont l’auteur possède les droits, aucune personne identifiable sans son accord, aucun contenu choquant ou publicitaire.
- À l’envoi, expliquer que la photo sera publique et demander une confirmation non précochée attestant les droits nécessaires. Une photo d’une personne identifiable est une donnée personnelle ; la CNIL rappelle le droit à l’image, l’accord requis et le droit de demander le retrait ([CNIL, droit à l’image](https://www.cnil.fr/fr/cnil-direct/question/le-droit-limage-sapplique-t-il-sur-internet?visiteur=pro), [CNIL, demander le retrait](https://www.cnil.fr/fr/demander-le-retrait-de-votre-image-en-ligne)).
- Prévoir suppression par l’auteur et demande de retrait même si son stockage local a été effacé. Un canal de contact permet de traiter les demandes de tiers.
- Si une application native est publiée plus tard, Apple exige pour le contenu utilisateur le filtrage, le signalement, une réponse rapide, le blocage des auteurs abusifs et des coordonnées publiques ([Apple App Review Guidelines, §1.2](https://developer.apple.com/app-store/review/guidelines/)).
- Pour un service disponible dans l’UE, documenter les décisions de retrait et notifier l’auteur quand cela est possible. Le DSA impose aux hébergeurs des explications claires lors d’une restriction de contenu ; l’applicabilité exacte et les exemptions doivent être validées juridiquement selon la taille et le statut du service ([Commission européenne, DSA Transparency Database FAQ](https://digital-strategy.ec.europa.eu/en/faqs/dsa-transparency-database-questions-and-answers)).

Le jeton pseudonyme actuel limite les erreurs ordinaires, mais il est généré par le navigateur et peut être renouvelé. Il ne constitue donc pas une vraie défense contre le spam. Conserver le parcours sans compte est raisonnable pour réduire la friction, mais ajouter un jeton signé côté serveur, une limitation complémentaire par origine/réseau et un challenge anti-bot déclenché seulement en cas de risque ou d’abus.

## Ordre d’implémentation

1. Repositionner l’expérience en « J’ai fait cette recette » et créer la galerie dédiée.
2. Ajouter `pending/approved/rejected`, la file d’approbation et le signalement.
3. Remplacer la simple vérification par réencodage, redimensionnement, miniature et suppression des métadonnées.
4. Ajouter consentement de publication, règles, contact et procédure de retrait.
5. Renforcer l’anti-abus et automatiser la modération seulement si le trafic le nécessite.

## État actuel du projet

Le projet possède déjà de bonnes fondations : formats et limites explicites, vérification de structure et décodage, réclamation temporaire du fichier, nettoyage planifié, propriété pseudonyme, pagination, suppression par l’auteur et administration. Les écarts principaux sont : original publié sans réencodage, absence d’état de modération et de signalement, CORS `*`, identité/rate-limit facilement renouvelable, photo prisonnière du modèle « commentaire », texte obligatoire et vote négatif.
