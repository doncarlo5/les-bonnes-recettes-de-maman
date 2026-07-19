# Conserver le rendement comme libellé éditorial localisé

Le Rendement de recette est stocké comme un libellé libre et indépendant en français et en anglais, plutôt que comme un couple numérique quantité/unité.

Les recettes existantes expriment des personnes, des plages, des pièces, des contenants, des alternatives et des approximations. Un modèle numérique unique rendait notamment « Environ 20 gougères » sous la forme ambiguë « 20 environ ». Comme aucun redimensionnement des ingrédients ne dépend de cette donnée, conserver sa formulation éditoriale est plus fidèle et plus simple à modifier.

Cette décision renonce volontairement au calcul automatique à partir du rendement. Si un futur besoin de redimensionnement apparaît, il faudra introduire un modèle structuré distinct sans déduire sa valeur du libellé affiché.

La migration suit un élargissement puis un resserrement : `yieldLabel` est d’abord ajouté avec une lecture de secours depuis `servings`, les recettes et brouillons sont ensuite remplis par lots, puis les écritures applicatives cessent d’utiliser l’ancien champ. `servings` reste temporairement optionnel et déprécié dans le stockage pour permettre un retour arrière.
