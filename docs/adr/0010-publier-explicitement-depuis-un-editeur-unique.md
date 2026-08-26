# Publier explicitement depuis un éditeur unique

L’administration présente une Recette sur une seule page structurée en trois blocs repliables : Essentiel, Recette et Compléments. Les modifications sont sauvegardées en privé après une courte pause et avant de quitter la recette, sans jamais modifier automatiquement le carnet public.

La Publication de recette est une commande explicite. Elle attend la fin de la sauvegarde du contenu et de l’image, vérifie l’État de préparation puis remplace atomiquement la Version publiée par la révision exacte enregistrée. Une tentative hors ligne n’est jamais rejouée automatiquement : l’éditeur doit confirmer à nouveau après reconnexion. La première publication rend la recette visible ; les suivantes préservent la Visibilité publique existante, notamment lorsqu’elle est suspendue.

Le stockage distinct `recipes` / `recipeDrafts` et les Route Handlers JSON restent des détails internes. L’interface emploie « À compléter », « En ligne » et « Publier les modifications », sans exposer le Brouillon de travail ni la synchronisation comme étapes éditoriales.
