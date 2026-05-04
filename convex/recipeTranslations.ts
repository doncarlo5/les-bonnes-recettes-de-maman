type Locale = "fr" | "en";

type SourceIngredient = {
  name: string;
  quantity: string;
  unit: string;
  notes: string;
};

type SourceSection = {
  title: string;
  steps: string[];
};

type SourceSubRecipe = {
  title: string;
  ingredients: SourceIngredient[];
};

export type SourceRecipe = {
  title: string;
  slug: string;
  author: string;
  description: string;
  heroImageUrl: string;
  servings: { quantity: number; unit: string } | null;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  temperature: string;
  ingredients: SourceIngredient[];
  sections: SourceSection[];
  subRecipes?: SourceSubRecipe[];
  notes: string[];
};

export type LocalizedRecipe = {
  title: string;
  author: string;
  description: string;
  servings: { quantity: number; unit: string } | null;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  timeLabel: string;
  temperature: string;
  ingredients: SourceIngredient[];
  sections: SourceSection[];
  subRecipes: SourceSubRecipe[];
  notes: string[];
};

export type SeedRecipe = {
  slug: string;
  heroImageUrl: string;
  defaultLocale: Locale;
  translations: Record<Locale, LocalizedRecipe>;
  tags: string[];
  status: "published";
};

const defaultHeroImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

const fallbackHeroImageUrls: Record<string, string> = {
  amandin:
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1400&q=85",
  "tarte-aux-amandes-et-confiture-de-framboises":
    "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=1400&q=85",
  "gateau-aux-pommes":
    "https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&w=1400&q=85",
  vacherin:
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1400&q=85",
  "macaron-tante-maria":
    "https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=1400&q=85",
  "gateau-au-chocolat":
    "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1400&q=85",
  moka: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=85",
  "gateau-au-citron":
    "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=1400&q=85",
  tiramisu:
    "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1400&q=85",
  "pate-feuilletee-maman":
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1400&q=85",
  "crumble-aux-pommes-du-verger":
    "https://images.unsplash.com/photo-1601000937859-3031d2be1caa?auto=format&fit=crop&w=1400&q=85",
  "cake-orange":
    "https://images.unsplash.com/photo-1587132137056-bfbf0166836e?auto=format&fit=crop&w=1400&q=85",
  "cake-d-ete-tout-vert":
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1400&q=85",
  "clafoutis-poires-et-framboises":
    "https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?auto=format&fit=crop&w=1400&q=85",
  "veloute-de-courgettes":
    "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=1400&q=85",
  "osso-buco":
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=85",
  "cake-moelleux-au-citron-de-pierre-herme":
    "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=1400&q=85",
  gougeres:
    "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1400&q=85",
  "cake-chevre-noix-olives":
    "https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=1400&q=85",
  "cake-au-chevre-et-courgettes":
    "https://images.unsplash.com/photo-1543353071-10c8ba85a904?auto=format&fit=crop&w=1400&q=85",
  "cocotte-de-cabillaud-aux-courgettes-et-curry":
    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1400&q=85",
  "pate-sucree-de-pierre-herme":
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1400&q=85",
  "pain-de-poisson":
    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1400&q=85",
  "coulants-au-chocolat":
    "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1400&q=85",
  "flan-au-lait-concentre-sucre-nestle":
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1400&q=85",
};

const titleTranslations: Record<string, string> = {
  Amandin: "Amandin Almond Cake",
  "Tarte aux amandes et confiture de framboises":
    "Almond Tart with Raspberry Jam",
  "Gâteau aux pommes": "Apple Cake",
  Vacherin: "Vacherin",
  "Macaron tante Maria": "Aunt Maria's Macaron Cake",
  "Gâteau au chocolat": "Chocolate Cake",
  Moka: "Mocha Cake",
  "Gâteau au citron": "Lemon Cake",
  Tiramisu: "Tiramisu",
  "Pâte feuilletée Maman": "Mom's Puff Pastry",
  "Crumble aux pommes du verger": "Orchard Apple Crumble",
  "Cake orange": "Orange Loaf Cake",
  "Cake d’été tout vert": "Green Summer Loaf Cake",
  "Clafoutis poires et framboises": "Pear and Raspberry Clafoutis",
  "Velouté de courgettes": "Zucchini Velouté",
  "Osso buco": "Osso Buco",
  "Cake moelleux au citron de Pierre Hermé":
    "Pierre Hermé's Moist Lemon Cake",
  Gougères: "Gougères",
  "Cake chèvre / noix / olives": "Goat Cheese, Walnut and Olive Loaf",
  "Cake au chèvre et courgettes": "Goat Cheese and Zucchini Loaf",
  "Cocotte de cabillaud aux courgettes et curry":
    "Cod, Zucchini and Curry Cocottes",
  "Pâte sucrée de Pierre Hermé": "Pierre Hermé's Sweet Tart Dough",
  "Pain de poisson": "Fish Loaf",
  "Coulants au chocolat": "Chocolate Lava Cakes",
  "Flan au lait concentré sucré Nestlé": "Nestlé Sweetened Condensed Milk Flan",
  "Crème au café": "Coffee Custard",
};

const descriptionTranslations: Record<string, string> = {
  "Gâteau aux amandes, citron et blancs montés en neige, avec glaçage citron facultatif.":
    "Almond and lemon cake folded with whipped egg whites, with an optional lemon glaze.",
  "Tarte sur pâte sablée, garnie de confiture de framboises et d’une préparation aux amandes.":
    "Shortcrust tart filled with raspberry jam and an almond mixture.",
  "Gâteau aux pommes avec une pâte simple et une crème versée en cours de cuisson.":
    "Apple cake with a simple batter and a cream poured over partway through baking.",
  "Dessert glacé en moule couronne à base d’œufs, crème fraîche et meringues.":
    "Frozen ring-mold dessert made with eggs, crème fraîche and meringues.",
  "Gâteau macaron aux blancs d’œufs, amandes et extrait d’amande amère, accompagné d’une crème au café.":
    "Macaron-style cake made with egg whites, almonds and bitter almond extract, served with coffee custard.",
  "Gâteau au chocolat simple avec blancs montés en neige.":
    "Simple chocolate cake folded with whipped egg whites.",
  "Recette de moka au chocolat et extrait de café. La préparation n’était pas indiquée sur la page.":
    "Mocha cake recipe with chocolate and coffee extract. The preparation was not shown on the page.",
  "Gâteau de Vichy garni ou accompagné d’une crème au citron.":
    "Vichy-style cake filled with or served alongside lemon cream.",
  "Tiramisu au mascarpone, café et biscuits à la cuillère, parfumé au marsala, xérès ou malaga.":
    "Tiramisu with mascarpone, coffee and ladyfingers, flavored with marsala, sherry or malaga.",
  "Pâte feuilletée maison à base de farine, margarine Astra, sel et eau.":
    "Homemade puff pastry made with flour, Astra margarine, salt and water.",
  "Crumble aux pommes, cassonade, poudre d’amandes, cannelle et calvados.":
    "Apple crumble with brown sugar, almond flour, cinnamon and calvados.",
  "Cake à l’orange et au beurre salé avec glaçage ou sirop à l’orange.":
    "Orange and salted-butter loaf cake with an orange glaze or syrup.",
  "Cake salé aux herbes, pesto ou tapenade verte, gruyère et noisettes.":
    "Savory herb loaf with green pesto or tapenade, Gruyère and hazelnuts.",
  "Clafoutis aux poires, avec quelques framboises facultatives.":
    "Pear clafoutis with a few optional raspberries.",
  "Velouté de courgettes avec pomme de terre, ail, oignon, crème fraîche et fromage fondu.":
    "Zucchini velouté with potato, garlic, onion, crème fraîche and processed cheese.",
  "Osso buco de jarret de veau aux tomates, carottes, vin blanc et bouquet garni.":
    "Veal shank osso buco with tomatoes, carrots, white wine and a bouquet garni.",
  "Cake moelleux au citron imbibé d’un sirop citronné.":
    "Moist lemon loaf cake soaked with lemon syrup.",
  "Gougères au comté, poivre et noix de muscade.":
    "Comté gougères with pepper and nutmeg.",
  "Cake salé au chèvre, noix, olives et comté râpé.":
    "Savory loaf with goat cheese, walnuts, olives and grated Comté.",
  "Cake salé au chèvre, courgette, gruyère râpé et cerfeuil.":
    "Savory loaf with goat cheese, zucchini, grated Gruyère and chervil.",
  "Cocottes de cabillaud aux courgettes, curry, crème liquide et parmesan.":
    "Small cocottes of cod with zucchini, curry, cream and parmesan.",
  "Pâte sucrée sablée pour tartes, à base de beurre pommade, sucre glace et poudre d’amandes.":
    "Sweet shortcrust tart dough made with softened butter, icing sugar and almond flour.",
  "Pain de poisson au concentré de tomate, crème fraîche et œufs, servi froid avec mayonnaise maison.":
    "Fish loaf with tomato paste, crème fraîche and eggs, served cold with homemade mayonnaise.",
  "Petits coulants au chocolat noir à servir tièdes avec une boule de glace vanille.":
    "Small dark-chocolate lava cakes served warm with a scoop of vanilla ice cream.",
  "Flan au lait concentré sucré cuit au bain-marie avec caramel.":
    "Sweetened condensed milk flan baked in a water bath with caramel.",
};

const sectionTranslations: Record<string, string> = {
  Conservation: "Storage",
  Crème: "Cream",
  "Crème au café": "Coffee Custard",
  "Crème au citron": "Lemon Cream",
  Cuisson: "Baking",
  Décor: "Decoration",
  Finition: "Finishing",
  "Glaçage facultatif": "Optional Glaze",
  "Gâteau de Vichy": "Vichy Cake",
  "Notes de cuisson": "Baking Notes",
  Préparation: "Preparation",
  "Préparation du macaron": "Macaron Preparation",
  Repos: "Resting",
  Service: "Serving",
  "Suite de la cuisson": "Continuing the Baking",
};

const ingredientTranslations: Record<string, string> = {
  Astra: "Astra margarine",
  Maïzena: "cornstarch",
  "Vache qui rit / Kiri": "Laughing Cow / Kiri cheese",
  ail: "garlic",
  amandes: "almonds",
  "amandes effilées grillées": "toasted sliced almonds",
  "amandes en poudre": "ground almonds",
  beurre: "butter",
  "beurre fondu et refroidi": "melted and cooled butter",
  "beurre salé": "salted butter",
  "beurre salé tempéré": "salted butter, at room temperature",
  "beurre à température ambiante": "butter at room temperature",
  "biscuits à la cuillère": "ladyfingers",
  "blancs d’œufs": "egg whites",
  "bouquet garni": "bouquet garni",
  café: "coffee",
  calvados: "calvados",
  cannelle: "cinnamon",
  "cannelle en poudre": "ground cinnamon",
  carottes: "carrots",
  "cassonade en poudre": "brown sugar",
  cerfeuil: "chervil",
  chocolat: "chocolate",
  "chocolat noir": "dark chocolate",
  chèvre: "goat cheese",
  "chèvre bûche": "goat cheese log",
  ciboulette: "chives",
  citron: "lemon",
  citrons: "lemons",
  "comté râpé": "grated Comté",
  "concentré de tomate": "tomato paste",
  "confiture de framboises": "raspberry jam",
  courgette: "zucchini",
  courgettes: "zucchini",
  crème: "cream",
  "crème fraîche": "crème fraîche",
  "crème fraîche liquide": "liquid crème fraîche",
  "crème fraîche épaisse": "thick crème fraîche",
  "crème liquide": "heavy cream",
  "curry en poudre": "curry powder",
  eau: "water",
  "extrait de café": "coffee extract",
  "extrait de vanille": "vanilla extract",
  "extrait d’amande amère": "bitter almond extract",
  farine: "flour",
  "farine T55": "T55 flour",
  "farine semi-complète": "semi-wholemeal flour",
  "filet de cabillaud sans peau et sans arêtes": "skinless, boneless cod fillet",
  framboises: "raspberries",
  fécule: "starch",
  "gruyère râpé": "grated Gruyère",
  huile: "oil",
  "huile de tournesol": "sunflower oil",
  "huile d’olive": "olive oil",
  "jarret de veau": "veal shank",
  "jaunes d’œufs": "egg yolks",
  "jus de citron": "lemon juice",
  "jus d’orange": "orange juice",
  lait: "milk",
  "lait concentré sucré": "sweetened condensed milk",
  "lait entier": "whole milk",
  levure: "baking powder",
  "levure chimique": "baking powder",
  "marsala, xérès ou malaga": "marsala, sherry or malaga",
  mascarpone: "mascarpone",
  meringues: "meringues",
  muscade: "nutmeg",
  "noisettes concassées": "chopped hazelnuts",
  noix: "walnuts",
  "noix de muscade": "nutmeg",
  oignon: "onion",
  oignons: "onions",
  "olives entières": "whole olives",
  orange: "orange",
  "parmesan râpé": "grated parmesan",
  persil: "parsley",
  "petites courgettes": "small zucchini",
  poires: "pears",
  poisson: "fish",
  poivre: "pepper",
  "poivre du moulin": "freshly ground pepper",
  "pomme de terre": "potato",
  pommes: "apples",
  "poudre d’amandes": "almond flour",
  "pâte sablée": "shortcrust pastry",
  rhum: "rum",
  sel: "salt",
  sucre: "sugar",
  "sucre fin": "caster sugar",
  "sucre glace": "icing sugar",
  "sucre semoule": "granulated sugar",
  "tapenade verte ou pesto vert": "green tapenade or green pesto",
  thym: "thyme",
  "tomates concassées": "crushed tomatoes",
  vanille: "vanilla",
  "vin blanc": "white wine",
  "zeste de citron": "lemon zest",
  œuf: "egg",
  œufs: "eggs",
};

const noteTranslations: Record<string, string> = {
  "+ pour déco": "+ extra for decoration",
  "1 boîte": "1 box",
  "150 g noté entre parenthèses": "150 g noted in parentheses",
  "200 g indiqué sur la recette": "200 g indicated on the recipe",
  "397 g": "397 g",
  "Carré frais indiqué par correction utilisateur":
    "Carré frais noted from user correction",
  "La formulation exacte du pliage était difficile à lire.":
    "The exact folding wording was difficult to read.",
  "La note manuscrite « 3/4 mm » a été normalisée en « 3 à 4 mm ».":
    "The handwritten note “3/4 mm” was normalized to “3 to 4 mm.”",
  "La phrase « avec 1 c. à s. » est conservée telle quelle car son sens exact n’est pas totalement explicite.":
    "The phrase “with 1 tbsp.” is kept as written because its exact meaning is not fully clear.",
  "Le titre manuscrit paraît être « Macaron tante Maria ».":
    "The handwritten title appears to be “Macaron tante Maria.”",
  "Le « x2 » est noté pour la pâte.": "The “x2” note applies to the batter.",
  "Les anciennes lignes barrées n’ont pas été conservées.":
    "Older crossed-out lines were not kept.",
  "Matériel : plat à gratin.": "Equipment: gratin dish.",
  "Meilleur préparé la veille.": "Best prepared the day before.",
  "PDT sur la recette": "Potato on the recipe",
  "Pierre Hermé ou autre": "Pierre Hermé or another one",
  "Titre normalisé en « Pain de poisson » à la demande de l’utilisateur.":
    "Title normalized to “Fish Loaf” at the user's request.",
  "blancs en neige": "whipped egg whites",
  "blancs et jaunes séparés": "whites and yolks separated",
  "correction utilisateur": "user correction",
  crème: "cream",
  "découpé en petits dés": "cut into small cubes",
  facultatif: "optional",
  "grand moule": "large pan",
  "jus + zeste": "juice + zest",
  "lotte à l’origine, ou mélange saumon, cabillaud, julienne":
    "originally monkfish, or a mix of salmon, cod and ling",
  margarine: "margarine",
  "mesuré avec la boîte vide": "measured with the empty can",
  "noté « 2/3 poires »": "noted as “2/3 pears”",
  "ou 2 petits": "or 2 small ones",
  "pour la crème au citron": "for the lemon cream",
  "pour la cuisson": "for cooking",
  "pour le cake": "for the cake",
  "pour le caramel": "for the caramel",
  "pour le décor": "for decoration",
  "pour le glaçage": "for the glaze",
  "pour le gâteau": "for the cake",
  "pour le moule": "for the pan",
  "pour le plat": "for the dish",
  "pour le sirop": "for the syrup",
  "pour le sirop, note manuscrite 0,08 l": "for the syrup; handwritten note 0.08 l",
  "pâte x2": "batter x2",
  ramolli: "softened",
  rases: "level",
  "« 2/3 poires » a été interprété comme 2 à 3 poires.":
    "“2/3 pears” was interpreted as 2 to 3 pears.",
  "écrit « chivre » sur la recette": "written “chivre” on the recipe",
};

const stepTranslations: Record<string, string> = {
  "Séparer les blancs d’œufs des jaunes.": "Separate the egg whites from the yolks.",
  "Ajouter le sucre dans les jaunes, puis la poudre d’amandes, puis le jus de 1/2 citron et le zeste.":
    "Add the sugar to the yolks, then the almond flour, then the juice of 1/2 lemon and the zest.",
  "Monter les blancs en neige et les ajouter délicatement au mélange aux amandes.":
    "Whip the egg whites and gently fold them into the almond mixture.",
  "Cuire 35 min à 160 °C.": "Bake for 35 min at 160 °C.",
  "Mélanger un peu de jus de citron avec du sucre glace et déposer sur le gâteau refroidi.":
    "Mix a little lemon juice with icing sugar and spread over the cooled cake.",
  "Mélanger le beurre ramolli avec le sucre et les jaunes d’œufs.":
    "Mix the softened butter with the sugar and egg yolks.",
  "Ajouter les amandes, puis les blancs d’œufs montés en neige.":
    "Add the almonds, then the whipped egg whites.",
  "Étaler la confiture sur la pâte, puis ajouter le mélange aux amandes.":
    "Spread the jam over the pastry, then add the almond mixture.",
  "Cuire 30 à 35 min à 160 °C.": "Bake for 30 to 35 min at 160 °C.",
  "Décorer avec des amandes effilées grillées et du sucre glace.":
    "Decorate with toasted sliced almonds and icing sugar.",
  "Mélanger la farine, le sucre, la levure et le sel.":
    "Mix the flour, sugar, baking powder and salt.",
  "Ajouter le lait, l’œuf et l’huile.": "Add the milk, egg and oil.",
  "Travailler le tout.": "Work everything together.",
  "Verser dans un moule à manqué garni de tranches de pommes.":
    "Pour into a round cake pan lined with apple slices.",
  "Mettre à four moyen.": "Place in a medium oven.",
  "Faire fondre le beurre dans une casserole.": "Melt the butter in a saucepan.",
  "Ajouter le sucre, l’œuf et la vanille.": "Add the sugar, egg and vanilla.",
  "Au bout de 25 min, quand le gâteau commence à monter et à dorer, ajouter la crème et continuer la cuisson.":
    "After 25 min, when the cake starts to rise and brown, add the cream and continue baking.",
  "Ce gâteau se conserve 3 à 4 jours.": "This cake keeps for 3 to 4 days.",
  "Huiler le moule en couronne.": "Oil the ring mold.",
  "Battre énergiquement les jaunes d’œufs et le sucre semoule jusqu’à ce que le mélange blanchisse.":
    "Beat the egg yolks and granulated sugar vigorously until the mixture turns pale.",
  "Ajouter l’extrait de vanille et la crème.": "Add the vanilla extract and cream.",
  "Battre les blancs en neige en ajoutant à la fin le sucre glace.":
    "Whip the egg whites, adding the icing sugar at the end.",
  "Ajouter délicatement les blancs à la préparation et verser la moitié dans le moule.":
    "Gently fold the whites into the mixture and pour half into the mold.",
  "Déposer les meringues grossièrement écrasées, puis terminer par le reste de la préparation.":
    "Add the roughly crushed meringues, then finish with the remaining mixture.",
  "Faire congeler 3 h.": "Freeze for 3 h.",
  "Pour démouler, tremper le moule quelques secondes dans l’eau tiède.":
    "To unmold, dip the mold in warm water for a few seconds.",
  "Battre les blancs en neige très ferme.": "Whip the egg whites until very stiff.",
  "Tourner avec le sucre 5 min au batteur électrique.":
    "Beat with the sugar for 5 min using an electric mixer.",
  "Ajouter ensuite les amandes et la levure.": "Then add the almonds and baking powder.",
  "Cuire à four doux, 140 °C, pendant 3/4 h.":
    "Bake in a low oven at 140 °C for 45 min.",
  "Faire bouillir 1/2 litre de lait avec 1 c. à café très rase de Maïzena.":
    "Bring 1/2 liter of milk to a boil with 1 very level teaspoon of cornstarch.",
  "Mélanger 6 jaunes d’œufs avec 100 g de sucre fin.":
    "Mix 6 egg yolks with 100 g caster sugar.",
  "Ajouter le lait bouillant en tournant.": "Add the boiling milk while stirring.",
  "Remettre dans la casserole et faire prendre la crème 1 à 2 min à peine.":
    "Return to the saucepan and let the custard thicken for just 1 to 2 min.",
  "Ajouter 2 c. à c. d’extrait de café.": "Add 2 tsp coffee extract.",
  "Servir frais.": "Serve chilled.",
  "Faire fondre le chocolat avec le beurre.": "Melt the chocolate with the butter.",
  "Mélanger le sucre et les jaunes d’œufs.": "Mix the sugar and egg yolks.",
  "Ajouter le chocolat et la farine, puis les blancs en neige.":
    "Add the chocolate and flour, then the whipped egg whites.",
  "Cuire à four moyen pendant 1/2 h, à 180 °C.":
    "Bake in a medium oven for 30 min at 180 °C.",
  "Préparation non indiquée sur la page transmise.":
    "Preparation was not shown on the provided page.",
  "Mélanger le sucre avec 3 jaunes d’œufs + 1 œuf entier.":
    "Mix the sugar with 3 egg yolks + 1 whole egg.",
  "Battre les blancs en neige ferme.": "Whip the egg whites until stiff.",
  "Les incorporer à la pâte en intercalant la farine.":
    "Fold them into the batter, alternating with the flour.",
  "Cuire à four moyen pendant 3/4 h.": "Bake in a medium oven for 45 min.",
  "Casser les œufs, ajouter le sucre et le beurre.":
    "Crack the eggs, then add the sugar and butter.",
  "Faire fondre.": "Melt.",
  "Râper finement le zeste de citron, l’ajouter ainsi que le jus à la composition.":
    "Finely grate the lemon zest and add it to the mixture with the juice.",
  "Tourner sur le feu pour faire prendre la crème, mais attention qu’elle ne tourne pas.":
    "Stir over heat until the cream thickens, taking care that it does not curdle.",
  "Faire le café.": "Make the coffee.",
  "Battre les blancs et ajouter le sucre glace.":
    "Whip the egg whites and add the icing sugar.",
  "Battre les jaunes avec le sucre fin.": "Beat the yolks with the caster sugar.",
  "Incorporer le mascarpone aux jaunes, délicatement.":
    "Gently fold the mascarpone into the yolks.",
  "Incorporer les blancs aux jaunes et au mascarpone.":
    "Fold the whites into the yolks and mascarpone.",
  "Mélanger le café et la c. à s. d’alcool.":
    "Mix the coffee with the tablespoon of alcohol.",
  "Tremper les gâteaux 1 par 1 et les mettre dans le plat.":
    "Dip the biscuits one by one and place them in the dish.",
  "Écraser les gâteaux + compact.": "Press the biscuits down to compact them.",
  "Ajouter le mélange.": "Add the mixture.",
  "Saupoudrer de chocolat en poudre.": "Dust with cocoa powder.",
  "Mettre au frigo 10 à 12 h.": "Refrigerate for 10 to 12 h.",
  "Mettre la farine sur le plan de travail.": "Place the flour on the work surface.",
  "Faire un puits et mettre la margarine en morceaux, puis le sel et l’eau.":
    "Make a well and add the margarine in pieces, then the salt and water.",
  "Garder 70 g de margarine.": "Reserve 70 g of margarine.",
  "Malaxer et ajouter l’eau au fur et à mesure.":
    "Knead, adding the water gradually.",
  "Étaler et tartiner sur toute la surface.":
    "Roll out and spread over the whole surface.",
  "Replier : 2 fois dans un bout, 1 fois l’autre.":
    "Fold: twice from one end, once from the other.",
  "Étaler et plier à nouveau.": "Roll out and fold again.",
  "Laisser reposer 1/4 h avant utilisation.": "Let rest for 15 min before using.",
  "Préchauffer le four à 180 °C.": "Preheat the oven to 180 °C.",
  "Éplucher les pommes, les couper en 4, ôter le cœur et les pépins, puis les détailler en tranches épaisses.":
    "Peel the apples, quarter them, remove the core and seeds, then cut into thick slices.",
  "Les déposer dans une assiette creuse et les arroser de calvados.":
    "Place them in a deep plate and drizzle with calvados.",
  "Dans un grand bol, mélanger la farine, la poudre d’amandes, la cannelle, la cassonade et le beurre.":
    "In a large bowl, mix the flour, almond flour, cinnamon, brown sugar and butter.",
  "Ajouter la pincée de sel. Remuer délicatement.":
    "Add the pinch of salt. Stir gently.",
  "Beurrer le plat et disposer les tranches de pommes parfumées au calvados.":
    "Butter the dish and arrange the calvados-flavored apple slices.",
  "Les couvrir du mélange farine-poudre d’amandes-beurre-cassonade et mettre au four pendant 35 min environ.":
    "Cover with the flour-almond-butter-brown sugar mixture and bake for about 35 min.",
  "Déguster le crumble tiède ou froid.": "Serve the crumble warm or cold.",
  "Mélanger les œufs et le sucre jusqu’à obtenir un mélange mousseux.":
    "Mix the eggs and sugar until foamy.",
  "Ajouter la farine et la levure.": "Add the flour and baking powder.",
  "Ajouter le beurre fondu, puis le jus d’orange et le zeste.":
    "Add the melted butter, then the orange juice and zest.",
  "Cuire 40 min à 180 °C.": "Bake for 40 min at 180 °C.",
  "Pour un glaçage : mélanger du sucre glace avec un peu de jus d’orange.":
    "For a glaze: mix icing sugar with a little orange juice.",
  "Ou pour un sirop : faire chauffer 1 jus d’orange avec 50 g de sucre.":
    "Or for a syrup: heat the juice of 1 orange with 50 g sugar.",
  "Poser le moule, beurré si pas en silicone, sur la plaque alu perforée.":
    "Place the pan, buttered if it is not silicone, on the perforated aluminum tray.",
  "Laver et égoutter les herbes, les ciseler ou les couper à l’éminceur.":
    "Wash and drain the herbs, then snip or slice them finely.",
  "Dans un cul-de-poule, mélanger la farine et la levure.":
    "In a mixing bowl, combine the flour and baking powder.",
  "Ajouter les œufs, puis le lait, l’huile et le gruyère, bien mélanger.":
    "Add the eggs, then the milk, oil and Gruyère, mixing well.",
  "Terminer par les herbes, la tapenade ou le pesto, les noisettes, et assaisonner si nécessaire.":
    "Finish with the herbs, tapenade or pesto, hazelnuts, and season if needed.",
  "Verser dans le moule à cake, puis enfourner pendant environ 40 min pour un grand cake ou 30 min pour des petits.":
    "Pour into the loaf pan, then bake for about 40 min for a large loaf or 30 min for small ones.",
  "La lame du couteau doit ressortir sèche.": "A knife blade should come out dry.",
  "Laisser refroidir et démouler.": "Let cool and unmold.",
  "Accompagner d’une salade verte.": "Serve with a green salad.",
  "Allumer le four à 200 °C.": "Turn the oven on to 200 °C.",
  "Mélanger le sucre, la farine, les amandes en poudre, le sel et la cannelle.":
    "Mix the sugar, flour, ground almonds, salt and cinnamon.",
  "Ajouter ensuite 3 œufs, 20 cl de crème et 20 cl de lait.":
    "Then add 3 eggs, 20 cl cream and 20 cl milk.",
  "Mixer le tout.": "Blend everything.",
  "Mettre les poires dans le moule, puis verser la pâte.":
    "Place the pears in the pan, then pour in the batter.",
  "Cuire 10 min à 200 °C puis 35 à 40 min à 180 °C.":
    "Bake 10 min at 200 °C, then 35 to 40 min at 180 °C.",
  "Faire cuire tous ces légumes dans 50 cl d’eau avec du sel.":
    "Cook all the vegetables in 50 cl water with salt.",
  "Laisser mijoter 15 min puis mixer.": "Simmer for 15 min, then blend.",
  "Ajouter le fromage fondu et la crème.": "Add the processed cheese and cream.",
  "Fariner la viande.": "Dust the meat with flour.",
  "Faire dorer sur toutes les faces dans la cocotte avec un fond d’huile.":
    "Brown on all sides in the casserole with a little oil.",
  "Ajouter les carottes coupées en rondelles épaisses, les oignons émincés et l’ail haché.":
    "Add the carrots cut into thick slices, sliced onions and chopped garlic.",
  "Ajouter les tomates et le vin blanc.": "Add the tomatoes and white wine.",
  "Saler, poivrer et ajouter le bouquet garni.":
    "Season with salt and pepper and add the bouquet garni.",
  "Cuire 45 min à feu doux après rotation de la soupape.":
    "Cook over low heat for 45 min after the pressure valve turns.",
  "Préchauffer le four à 165 °C.": "Preheat the oven to 165 °C.",
  "Mélanger le zeste de citron avec le sucre.":
    "Rub the lemon zest into the sugar.",
  "Ajouter les œufs 1 à 1 et bien mélanger.":
    "Add the eggs one at a time, mixing well.",
  "Ajouter la crème fraîche.": "Add the crème fraîche.",
  "Ajouter le rhum et le sel.": "Add the rum and salt.",
  "Mélanger la farine et la levure.": "Mix the flour and baking powder.",
  "Ajouter la farine et la levure en plusieurs fois au mélange.":
    "Add the flour and baking powder to the mixture in several additions.",
  "Ajouter le beurre et mélanger.": "Add the butter and mix.",
  "Beurrer et fariner le moule à cake.": "Butter and flour the loaf pan.",
  "Verser la préparation et cuire environ 60 min.":
    "Pour in the batter and bake for about 60 min.",
  "Préparer le sirop : porter à ébullition l’eau et le sucre.":
    "Prepare the syrup: bring the water and sugar to a boil.",
  "Ajouter le jus de citron hors du feu.": "Off the heat, add the lemon juice.",
  "Sortir le cake du four et l’imbiber de sirop.":
    "Remove the cake from the oven and soak it with syrup.",
  "Laisser refroidir sur une grille avant de déguster.":
    "Let cool on a rack before serving.",
  "Faire fondre le beurre dans l’eau avec le sel.":
    "Melt the butter in the water with the salt.",
  "Quand ça mousse, ajouter la farine tamisée.":
    "When it foams, add the sifted flour.",
  "Laisser 2 min dans la casserole pour l’évaporation de l’eau.":
    "Leave in the saucepan for 2 min so the water evaporates.",
  "Ajouter le poivre et la muscade, puis les œufs 1 à 1, et enfin le fromage râpé.":
    "Add the pepper and nutmeg, then the eggs one by one, and finally the grated cheese.",
  "Faire des petits tas sur une plaque et mettre un peu de comté pour décorer.":
    "Make small mounds on a baking sheet and add a little Comté for decoration.",
  "Cuire 30 min à 190 °C.": "Bake for 30 min at 190 °C.",
  "Mélanger les œufs, la farine, la levure, le sel et le poivre.":
    "Mix the eggs, flour, baking powder, salt and pepper.",
  "Ajouter petit à petit l’huile et le lait chaud avec le fromage râpé.":
    "Gradually add the oil and warm milk with the grated cheese.",
  "Ajouter le chèvre écrasé, les noix et les olives.":
    "Add the mashed goat cheese, walnuts and olives.",
  "Cuire 1/2 h à 180 °C.": "Bake for 30 min at 180 °C.",
  "Faire rissoler la courgette coupée en rondelles dans l’huile d’olive pendant 15 min, puis disposer sur du sopalin.":
    "Brown the sliced zucchini in olive oil for 15 min, then place on paper towels.",
  "Fouetter les œufs, la farine, la levure, le sel et le poivre.":
    "Whisk the eggs, flour, baking powder, salt and pepper.",
  "Incorporer petit à petit l’huile et le lait chauffé.":
    "Gradually incorporate the oil and warmed milk.",
  "Ajouter le gruyère râpé et mélanger.": "Add the grated Gruyère and mix.",
  "Incorporer les courgettes, le chèvre coupé en morceaux et le cerfeuil ciselé.":
    "Fold in the zucchini, goat cheese pieces and chopped chervil.",
  "Mélanger le tout et mettre dans un moule non graissé.":
    "Mix everything and place in an ungreased pan.",
  "Cuire 45 min à 180 °C.": "Bake for 45 min at 180 °C.",
  "Peler l’oignon et l’émincer.": "Peel and slice the onion.",
  "Peler les courgettes et les couper en petits cubes.":
    "Peel the zucchini and cut into small cubes.",
  "Hacher le persil.": "Chop the parsley.",
  "Couper les filets de cabillaud en morceaux.": "Cut the cod fillets into pieces.",
  "Dans une poêle, faire revenir l’oignon émincé avec les courgettes sur feu moyen pendant 10 min environ.":
    "In a skillet, sauté the sliced onion with the zucchini over medium heat for about 10 min.",
  "Saler, poivrer, saupoudrer de curry et ajouter le persil haché.":
    "Season with salt and pepper, sprinkle with curry and add the chopped parsley.",
  "Mélanger et poursuivre la cuisson quelques minutes.":
    "Mix and continue cooking for a few minutes.",
  "Retirer du feu, ajouter les morceaux de filet de cabillaud aux courgettes et mélanger.":
    "Remove from the heat, add the cod pieces to the zucchini and mix.",
  "Répartir la préparation dans les cocottes.":
    "Divide the mixture among the cocottes.",
  "Arroser de crème liquide et saupoudrer de parmesan.":
    "Drizzle with cream and sprinkle with parmesan.",
  "Glisser au four pendant 15 à 20 min environ.":
    "Bake for about 15 to 20 min.",
  "Servir dès la sortie du four.": "Serve straight from the oven.",
  "Dans un saladier, mettre le beurre pommade.":
    "Place the softened butter in a mixing bowl.",
  "Ajouter le sucre glace et mélanger vigoureusement à l’aide d’une cuillère en bois pour obtenir une texture homogène.":
    "Add the icing sugar and mix vigorously with a wooden spoon until smooth.",
  "Verser l’œuf légèrement battu, la pincée de sel, la poudre d’amandes et la farine tamisée.":
    "Add the lightly beaten egg, pinch of salt, almond flour and sifted flour.",
  "Mélanger grossièrement à l’aide de la cuillère en bois.":
    "Mix roughly with the wooden spoon.",
  "Placer la pâte sur le plan de travail.": "Place the dough on the work surface.",
  "Avec la paume de la main, fraiser légèrement pour obtenir une pâte homogène.":
    "With the palm of your hand, smear the dough lightly until homogeneous.",
  "Former une boule.": "Form a ball.",
  "Placer la boule entre 2 feuilles de papier sulfurisé et l’abaisser sur une épaisseur de 3 à 4 mm.":
    "Place the ball between 2 sheets of parchment paper and roll it out to 3 to 4 mm thick.",
  "Mettre au frigo 2 à 3 h, idéalement 1 nuit.":
    "Refrigerate for 2 to 3 h, ideally overnight.",
  "Préparer un moule à cake avec du papier sulfurisé au fond.":
    "Prepare a loaf pan with parchment paper on the bottom.",
  "Cuire le poisson au court-bouillon acheté tout prêt selon la quantité, environ 10 à 15 min.":
    "Cook the fish in ready-made court-bouillon according to the quantity, about 10 to 15 min.",
  "Mélanger dans une jatte le concentré, les œufs, la crème et la Maïzena diluée.":
    "In a bowl, mix the tomato paste, eggs, cream and diluted cornstarch.",
  "Ajouter le sel et le poivre, puis goûter pour vérifier l’assaisonnement.":
    "Add salt and pepper, then taste to check the seasoning.",
  "Ajouter le poisson dans la jatte et mélanger le tout au robot pour obtenir la consistance souhaitée et réduire les arêtes s’il y en a.":
    "Add the fish to the bowl and blend everything in a food processor to the desired consistency and to break down any bones.",
  "Verser le tout dans le moule beurré.": "Pour everything into the buttered pan.",
  "Cuire au bain-marie dans un four à th. 7 pendant 40 min.":
    "Bake in a water bath in a th. 7 oven for 40 min.",
  "Vérifier la cuisson avec un couteau ; le dessus doit être légèrement doré.":
    "Check doneness with a knife; the top should be lightly browned.",
  "Laisser bien refroidir avant de démouler.": "Let cool completely before unmolding.",
  "Servir avec une belle mayonnaise maison et garnir de salade autour du plat.":
    "Serve with a generous homemade mayonnaise and garnish the platter with salad.",
  "Faire fondre le beurre et le chocolat 2 min au micro-ondes.":
    "Melt the butter and chocolate for 2 min in the microwave.",
  "Mélanger les œufs, le sucre et la farine.": "Mix the eggs, sugar and flour.",
  "Verser cette préparation dans le mélange beurre-chocolat.":
    "Pour this mixture into the butter-chocolate mixture.",
  "Répartir dans les 6 moules.": "Divide among the 6 molds.",
  "Cuire 10 min à four chaud à 180 °C.": "Bake for 10 min in a hot oven at 180 °C.",
  "Laisser refroidir avant de démouler avec 1 c. à s.":
    "Let cool before unmolding with 1 tbsp.",
  "Servir tiède avec une boule de glace vanille.":
    "Serve warm with a scoop of vanilla ice cream.",
  "Casser les œufs.": "Crack the eggs.",
  "Ajouter la boîte de lait concentré sucré Nestlé.":
    "Add the can of Nestlé sweetened condensed milk.",
  "Avec la boîte vide, mesurer 1 boîte et 1/3 de lait entier.":
    "Using the empty can, measure 1 and 1/3 cans of whole milk.",
  "Mixer le mélange au plongeur mixeur pendant 5 min.":
    "Blend the mixture with an immersion blender for 5 min.",
  "Napper le moule à cake avec le caramel.":
    "Coat the loaf pan with caramel.",
  "Verser le mélange doucement.": "Pour the mixture in gently.",
  "Placer dans un bain-marie au four préchauffé à 170 °C pendant 30 à 45 min.":
    "Place in a water bath in a 170 °C preheated oven for 30 to 45 min.",
  "Le flan est cuit quand la lame ressort sèche.":
    "The flan is done when the knife blade comes out dry.",
  "Laisser refroidir, mettre au frigo et démouler au moment de servir.":
    "Let cool, refrigerate, and unmold when ready to serve.",
  "Le bain-marie doit être bouillant au moment de mettre le flan.":
    "The water bath should be boiling when the flan goes in.",
  "Faire le caramel dans la poêle sans eau.":
    "Make the caramel in a pan without water.",
  "Ne pas remuer.": "Do not stir.",
};

const unitTranslations: Record<string, string> = {
  "": "",
  "à 10 personnes": "to 10 people",
  "à 6 personnes": "to 6 people",
  boîte: "can",
  belles: "large",
  bouquet: "bunch",
  cafetière: "coffee pot",
  "c. à café très rase": "very level tsp",
  "c. à c.": "tsp",
  "c. à s.": "tbsp",
  cl: "cl",
  environ: "about",
  g: "g",
  "gros citron": "large lemon",
  grosses: "large",
  litre: "liter",
  moules: "molds",
  paquet: "packet",
  personnes: "people",
  "petit verre": "small glass",
  "petite boîte": "small can",
  pincée: "pinch",
  pincées: "pinches",
  sachet: "packet",
  verre: "glass",
};

const tagTranslations: Record<string, string> = {
  dessert: "dessert",
  chocolat: "chocolate",
  four: "oven",
  sucre: "sweet",
  salé: "savory",
  poisson: "fish",
  végétarien: "vegetarian",
};

export function localizeRecipe(recipe: SourceRecipe, locale: Locale): LocalizedRecipe {
  if (locale === "fr") {
    return {
      title: recipe.title,
      author: recipe.author,
      description: recipe.description,
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      totalTime: recipe.totalTime,
      timeLabel: getTimeLabel(recipe, "fr"),
      temperature: recipe.temperature,
      ingredients: recipe.ingredients,
      sections: recipe.sections,
      subRecipes: recipe.subRecipes ?? [],
      notes: recipe.notes,
    };
  }

  return {
    title: translate(titleTranslations, recipe.title),
    author: recipe.author,
    description: translate(descriptionTranslations, recipe.description),
    servings: translateServings(recipe.servings),
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    timeLabel: getTimeLabel(recipe, "en"),
    temperature: recipe.temperature,
    ingredients: recipe.ingredients.map(translateIngredient),
    sections: recipe.sections.map((section) => ({
      title: translate(sectionTranslations, section.title),
      steps: section.steps.map((step) => translate(stepTranslations, step)),
    })),
    subRecipes: (recipe.subRecipes ?? []).map((subRecipe) => ({
      title: translate(titleTranslations, subRecipe.title),
      ingredients: subRecipe.ingredients.map(translateIngredient),
    })),
    notes: recipe.notes.map((note) => translate(noteTranslations, note)),
  };
}

export function toSeedRecipe(recipe: SourceRecipe): SeedRecipe {
  return {
    slug: recipe.slug,
    heroImageUrl:
      recipe.heroImageUrl ||
      fallbackHeroImageUrls[recipe.slug] ||
      defaultHeroImageUrl,
    defaultLocale: "fr",
    translations: {
      fr: localizeRecipe(recipe, "fr"),
      en: localizeRecipe(recipe, "en"),
    },
    tags: inferTags(recipe, "fr"),
    status: "published",
  };
}

function translateIngredient(ingredient: SourceIngredient): SourceIngredient {
  return {
    name: translate(ingredientTranslations, ingredient.name),
    quantity: ingredient.quantity,
    unit: translate(unitTranslations, ingredient.unit),
    notes: ingredient.notes ? translate(noteTranslations, ingredient.notes) : "",
  };
}

function translateServings(
  servings: SourceRecipe["servings"],
): SourceRecipe["servings"] {
  if (!servings) return null;
  return {
    quantity: servings.quantity,
    unit: translate(unitTranslations, servings.unit),
  };
}

function getTimeLabel(recipe: SourceRecipe, locale: Locale) {
  const fallback = locale === "fr" ? "Temps libre" : "Flexible timing";

  if (recipe.totalTime) return recipe.totalTime;
  if (recipe.cookTime) return recipe.cookTime;
  if (recipe.prepTime) return recipe.prepTime;

  return fallback;
}

function inferTags(recipe: SourceRecipe, locale: Locale) {
  const text = `${recipe.title} ${recipe.description} ${recipe.ingredients
    .map((ingredient) => ingredient.name)
    .join(" ")}`.toLowerCase();
  const tags: string[] = [];

  if (
    [
      "gâteau",
      "tarte",
      "crumble",
      "clafoutis",
      "tiramisu",
      "flan",
      "chocolat",
      "citron",
    ].some((word) => text.includes(word))
  ) {
    tags.push("dessert");
  }

  if (["cabillaud", "poisson"].some((word) => text.includes(word))) {
    tags.push("poisson");
  }

  if (["cake salé", "gougères", "courgettes", "chèvre"].some((word) => text.includes(word))) {
    tags.push("salé");
  }

  if (text.includes("chocolat")) tags.push("chocolat");
  if (text.includes("four") || recipe.temperature) tags.push("four");

  const normalizedTags = tags.length ? tags : ["recette"];
  return locale === "fr"
    ? normalizedTags
    : normalizedTags.map((tag) => translate(tagTranslations, tag));
}

function translate(translations: Record<string, string>, value: string) {
  return translations[value] ?? value;
}
