# Les Bonnes Recettes de Maman

This context defines the editorial language for recipes managed and published by the application.

## Language

**Recette**:
Objet editorial complet, brouillon ou publie, identifie par un slug public et compose de contenus localises en francais et en anglais.
_Avoid_: Article, fiche, page

**Idée de recette**:
Contribution publique légère qui conserve un texte libre en vue d'une future Recette, sans constituer elle-même un contenu éditorial structuré.
_Avoid_: Note, Brouillon de travail, Recette incomplète

**Idée ajoutée**:
Idée de recette reliée à une Recette dont la Version publiée est actuellement visible dans le carnet public.
_Avoid_: Idée traitée, Brouillon lié, Recette en cours

**Categorie de recette**:
Facette publique qui aide a parcourir le carnet selon le moment de service ou le gout dominant.
Une Recette peut appartenir a plusieurs categories.
Le vocabulaire est fermé : `dessert`, `plat`, `sucre` et `sale`. Un ancien libellé non reconnu est conservé temporairement pour correction éditoriale, mais ne participe jamais aux filtres publics.
_Avoid_: Tag technique, source, collection

**Recherche de recette**:
Action de retrouver des Recettes a partir de mots presents dans leur titre ou leurs ingredients.
_Avoid_: Recherche plein texte, recherche globale

**Rendement de recette**:
Libellé éditorial localisé qui décrit ce que produit une Recette en convives, pièces, contenants ou quantité approximative.
Un Rendement de recette non vide suffit pour publier lorsque les Portions de référence ne sont pas pertinentes.
_Avoid_: Portions, nombre de personnes, servings

**Portions de référence**:
Nombre entier de personnes pour lequel les quantités d’ingrédients d’une Recette ont été écrites et à partir duquel elles peuvent être redimensionnées.
Elles sont facultatives : sans elles, la Recette reste publiable si elle possède un Rendement de recette, mais le redimensionnement des ingrédients est indisponible.
_Avoid_: Rendement de recette, quantité obtenue

**Mode cuisine**:
Expérience publique et focalisée qui accompagne la préparation d’une Recette, une étape à la fois, sans modifier son contenu éditorial.
_Avoid_: Tutoriel, assistant de recette, lecteur pas-à-pas

**Progression de cuisine**:
Position et ingrédients cochés conservés localement sur l’appareil pendant l’utilisation du Mode cuisine.
_Avoid_: Avancement de recette, statut de préparation, historique de cuisson

**Ingrédient**:
Élément alimentaire d’une Recette, principal ou rattaché à une sous-recette, défini par un nom et éventuellement une quantité, une unité et une note.
_Avoid_: Produit, composant technique

**Étape de préparation**:
Instruction ordonnée qui décrit une action à accomplir pendant la préparation d’une Recette.
_Avoid_: Tâche, instruction libre

**Ingrédient de l’étape**:
Référence explicite depuis une Étape de préparation vers un Ingrédient utilisé à ce moment, avec une quantité d’usage facultative qui remplace la quantité globale pour cette étape.
_Avoid_: Ingrédient détecté, mention d’ingrédient, quantité dupliquée

**Image principale de recette**:
Image unique associee a une Recette, utilisee comme couverture dans la liste, le detail et les apercus de partage.
_Avoid_: Galerie, illustration, image admin

**Date d'ajout**:
Date technique de creation d'une Recette dans le carnet, utilisee pour le tri public par date.
Elle ne signifie pas date de publication ni derniere modification.
_Avoid_: Date de publication, date de mise a jour

**Version publiée**:
Dernier contenu d'une Recette explicitement approuvé par une publication.
Sa Visibilité publique peut être suspendue sans effacer cette version, et elle peut coexister avec un Brouillon de travail plus récent.
_Avoid_: Version active, recette en ligne

**Visibilité publique**:
État qui indique si la Version publiée d'une Recette est actuellement exposée dans le carnet public.
_Avoid_: Statut du brouillon, publication, recette active

**Brouillon de travail**:
Version privée et modifiable d'une Recette, enregistrée au fil de l'édition et sans effet sur la Version publiée avant approbation.
_Avoid_: Modifications, révision, copie temporaire

**État de préparation**:
Évaluation éditoriale qui distingue ce qui bloque la publication d'une Recette des recommandations facultatives.
_Avoid_: Validation technique, statut de formulaire

**Écart de publication**:
Situation où le Brouillon de travail diffère de la Version publiée et nécessite une nouvelle publication pour devenir public.
_Avoid_: État sale, modifications enregistrées, conflit

**Commentaire de recette**:
Contribution publique d’un Participant à une Recette, composée d’un texte et éventuellement d’une signature et d’une photo.
_Avoid_: Note éditoriale, avis vérifié, message

**Participant**:
Visiteur public pseudonyme représenté par son navigateur, sans compte ni identité vérifiée.
_Avoid_: Utilisateur authentifié, auteur de recette, administrateur

**Réaction**:
Choix exclusif pouce haut ou pouce bas d’un Participant sur un Commentaire de recette.
_Avoid_: Note, score, vote multiple

## Example Dialogue

Dev: "Est-ce qu'une Recette brouillon peut avoir une traduction anglaise incomplete ?"

Domain expert: "Oui. La Recette peut etre en brouillon tant que son contenu principal n'est pas pret. Pour la publier, le contenu francais essentiel doit etre complet."

Dev: "Est-ce qu'une recherche sur citron doit lire les etapes ?"

Domain expert: "Non. Une Recherche de recette porte sur les titres et les ingredients, pas sur tout le texte editorial."
