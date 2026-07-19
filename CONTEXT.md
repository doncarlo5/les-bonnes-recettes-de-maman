# Les Bonnes Recettes de Maman

This context defines the editorial language for recipes managed and published by the application.

## Language

**Recette**:
Objet editorial complet, brouillon ou publie, identifie par un slug public et compose de contenus localises en francais et en anglais.
_Avoid_: Article, fiche, page

**Categorie de recette**:
Facette publique qui aide a parcourir le carnet selon le moment de service ou le gout dominant.
Une Recette peut appartenir a plusieurs categories.
_Avoid_: Tag technique, source, collection

**Recherche de recette**:
Action de retrouver des Recettes a partir de mots presents dans leur titre ou leurs ingredients.
_Avoid_: Recherche plein texte, recherche globale

**Rendement de recette**:
Libellé éditorial localisé qui décrit ce que produit une Recette en convives, pièces, contenants ou quantité approximative.
_Avoid_: Portions, nombre de personnes, servings

**Mode cuisine**:
Expérience publique et focalisée qui accompagne la préparation d’une Recette, une étape à la fois, sans modifier son contenu éditorial.
_Avoid_: Tutoriel, assistant de recette, lecteur pas-à-pas

**Progression de cuisine**:
Position et ingrédients cochés conservés localement sur l’appareil pendant l’utilisation du Mode cuisine.
_Avoid_: Avancement de recette, statut de préparation, historique de cuisson

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

## Example Dialogue

Dev: "Est-ce qu'une Recette brouillon peut avoir une traduction anglaise incomplete ?"

Domain expert: "Oui. La Recette peut etre en brouillon tant que son contenu principal n'est pas pret. Pour la publier, le contenu francais essentiel doit etre complet."

Dev: "Est-ce qu'une recherche sur citron doit lire les etapes ?"

Domain expert: "Non. Une Recherche de recette porte sur les titres et les ingredients, pas sur tout le texte editorial."
