# Conserver les Route Handlers pour l’éditeur autosauvegardé

L’éditeur de recette conserve des Route Handlers authentifiés plutôt que de migrer ses mutations vers des Server Actions. Son autosauvegarde temporisée, sa récupération hors ligne, ses uploads et ses conflits de révision reposent sur des réponses JSON et des statuts HTTP explicites ; garder ce transport rend ces états observables et coordonne les écritures du Brouillon de travail sans changer le modèle de publication.
