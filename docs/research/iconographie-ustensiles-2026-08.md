# Recherche — icônes d’ustensiles

Date de vérification : 4 août 2026.

## Recommandation

Adopter **Hugeicons Free** pour les ustensiles, via `@hugeicons/react` et
`@hugeicons/core-free-icons`, tout en conservant Lucide pour les icônes UI déjà
en place. Ne pas mélanger les deux styles dans une même liste.

Hugeicons est le meilleur compromis ici : ses paquets gratuits MIT contiennent
notamment `BlenderIcon`, `CookingPotIcon`, `ForkIcon`, `GlassWaterIcon`,
`KitchenUtensilsIcon`, `Knife01Icon`, `MixerIcon`, `OvenIcon`, `Pan01Icon`,
`PlateIcon`, `Pot01Icon`, `RiceBowl01Icon`, `RollingPinIcon`, `SpatulaIcon` et
`WhiskIcon`. Les imports nommés sont tree-shakables et la documentation prévoit
explicitement React, Next.js et le SSR. La version vérifiée est
`@hugeicons/react` 1.1.9 (24 juin 2026) avec
`@hugeicons/core-free-icons` 4.2.3 (21 juillet 2026). Sources :
[documentation React officielle](https://hugeicons.com/docs/integrations/react/overview),
[bonnes pratiques et imports](https://hugeicons.com/docs/integrations/react/best-practices),
[dépôt officiel et licence MIT](https://github.com/hugeicons/hugeicons),
[métadonnées npm du composant](https://registry.npmjs.org/%40hugeicons%2Freact/latest),
[métadonnées npm des icônes gratuites](https://registry.npmjs.org/%40hugeicons%2Fcore-free-icons/latest).

Le catalogue gratuit n’offre qu’un style, **Stroke Rounded**. Les dix styles et
la collection complète sont Pro et relèvent d’une licence propriétaire : ce
n’est pas nécessaire pour les besoins recensés.

## Correspondance avec les données actuelles

`convex/recettes.json` contient 47 occurrences et 30 libellés uniques, que l’on
peut ramener à ces familles :

| Libellés français | Icône Hugeicons Free proposée |
|---|---|
| batteur électrique | `MixerIcon` |
| bol, petit bol | `RiceBowl01Icon` |
| saladier | `SaladIcon` ou `RiceBowl02Icon` |
| casserole, grande casserole | `CookingPotIcon` |
| cocotte-minute, saucier SEB | `Pot01Icon` (approximation) |
| couteau à longue lame | `Knife02Icon` |
| maryse | `SpatulaIcon` |
| mixeur | `BlenderIcon` |
| moules à gâteau/cake/manqué/couronne/rectangle | `CakeIcon` (forme générique) |
| empreintes à muffins, mini-cakes | `Cupcake01Icon` |
| plaque de cuisson | `OvenIcon` (approximation) |
| plat de service | `PlateIcon` |
| plat à gratin, plat pour bain-marie, petites cocottes | `Dish01Icon` |
| poêle | `Pan01Icon` |
| rouleau à pâtisserie | `RollingPinIcon` |
| verre | `GlassWaterIcon` |
| fourchette | `ForkIcon` |
| papier sulfurisé | `File01Icon` (approximation) |
| agrafeuse | `ClipIcon` (approximation) |

Il faut donc prévoir un petit résolveur par mots-clés avec
`KitchenUtensilsIcon` comme repli. Aucun des sets comparés ne représente chaque
variante de moule ni les marques/modèles (`saucier SEB`) de façon exacte.

## Alternatives vérifiées

| Option | Situation au 4 août 2026 | Verdict pour ce projet |
|---|---|---|
| **Lucide** | Déjà installé (`lucide-react` 1.25.0 ; dernière version 1.28.0 du 30 juillet 2026), ISC, 1 600+ SVG, composants React typés et tree-shakables. Le core propose entre autres `Blender`, `CookingPot` et `GlassWater`, mais pas de poêle, spatule, batteur ni rouleau dédiés. [Guide React](https://lucide.dev/guide/react), [licence](https://lucide.dev/license), [registre npm](https://registry.npmjs.org/lucide-react/latest). | Zéro nouvelle dépendance, mais couverture trop faible pour différencier les ustensiles. Excellent repli si l’on accepte beaucoup d’icônes génériques. |
| **Tabler Icons** | 6 146 icônes, MIT, React et ES modules tree-shakables ; version 3.46.0 du 28 juillet 2026. On trouve bol, blender, fouet et spatule de gril, mais pas l’ensemble poêle/casserole/rouleau/moules. [Catalogue officiel](https://tabler.io/icons), [paquet React officiel](https://github.com/tabler/tabler-icons/tree/main/packages/icons-react), [registre npm](https://registry.npmjs.org/%40tabler%2Ficons-react/latest). | Bon second choix, mais moins adapté que Hugeicons au vocabulaire du fichier de recettes. |
| **Iconify** | Accès unifié à 300 000+ icônes de 200+ sets ; `@iconify/react` 6.0.2 (15 septembre 2025), MIT pour le composant. Chaque set conserve toutefois sa propre licence. Avec les noms d’icônes distants, la documentation Next.js indique un composant client-only, sans SVG au SSR et avec un léger délai possible. [Documentation React/Next.js](https://iconify.design/docs/icon-components/react/), [limites du chargement à la demande](https://iconify.design/docs/icon-components/), [registre npm](https://registry.npmjs.org/%40iconify%2Freact/latest). | Couverture maximale en mélangeant des sets, mais cohérence visuelle, licences et rendu initial plus difficiles. À garder comme moteur de découverte, pas comme dépendance principale. |

## Intégration minimale envisagée

Installer les deux paquets Hugeicons, puis centraliser les correspondances dans
un composant local `EquipmentIcon`. Les libellés sont éditoriaux et parfois
composés (`plat à gratin ou moule de 24 cm`) : le composant doit normaliser les
accents et faire correspondre des familles de mots, sans enregistrer un nom
d’icône dans la recette. Les icônes restent décoratives (`aria-hidden`) puisque
le texte de l’ustensile est toujours affiché.
