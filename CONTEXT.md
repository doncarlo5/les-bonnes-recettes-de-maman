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

**Image principale de recette**:
Image unique associee a une Recette, utilisee comme couverture dans la liste, le detail et les apercus de partage.
_Avoid_: Galerie, illustration, image admin

## Example Dialogue

Dev: "Est-ce qu'une Recette brouillon peut avoir une traduction anglaise incomplete ?"

Domain expert: "Oui. La Recette peut etre en brouillon tant que son contenu principal n'est pas pret. Pour la publier, le contenu francais essentiel doit etre complet."

Dev: "Est-ce qu'une recherche sur citron doit lire les etapes ?"

Domain expert: "Non. Une Recherche de recette porte sur les titres et les ingredients, pas sur tout le texte editorial."
