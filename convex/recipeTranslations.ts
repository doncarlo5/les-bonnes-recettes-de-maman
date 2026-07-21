import { resolveYieldLabel } from "../lib/recipe-yield";
import { resolveReferenceServings } from "../lib/recipe-servings";
import {
  resolveRecipeCategories,
  toLegacyTags,
  type RecipeCategory,
} from "../lib/recipe-categories";
import { enrichLocalizedStepIngredients } from "../lib/recipe-step-migration";

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

type LocalizedIngredient = SourceIngredient & { id?: string };
type LocalizedSection = SourceSection & {
  stepDetails?: Array<{
    id: string;
    text: string;
    ingredientUses: Array<{
      ingredientId: string;
      amount?: { quantity: string; unit: string };
    }>;
  }>;
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
  yieldLabel?: string;
  referenceServings?: number;
  servings: { quantity: number; unit: string } | null;
  prepTime: string;
  cookTime: string;
  restTime?: string;
  totalTime: string;
  temperature: string;
  equipment?: string[];
  relatedRecipeSlugs?: string[];
  ingredients: SourceIngredient[];
  sections: SourceSection[];
  subRecipes?: SourceSubRecipe[];
  notes: string[];
};

export type LocalizedRecipe = {
  title: string;
  author: string;
  description: string;
  yieldLabel: string;
  servings: { quantity: number; unit: string } | null;
  prepTime: string;
  cookTime: string;
  restTime: string;
  totalTime: string;
  timeLabel: string;
  temperature: string;
  equipment: string[];
  ingredients: LocalizedIngredient[];
  sections: LocalizedSection[];
  subRecipes: Array<
    Omit<SourceSubRecipe, "ingredients"> & {
      ingredients: LocalizedIngredient[];
    }
  >;
  notes: string[];
};

export type SeedRecipe = {
  slug: string;
  heroImageUrl: string;
  defaultLocale: Locale;
  referenceServings?: number;
  relatedRecipeSlugs: string[];
  translations: Record<Locale, LocalizedRecipe>;
  categories: RecipeCategory[];
  legacyCategoryLabels: string[];
  tags: string[];
  status: "published";
};

const recipeCategoryTags: Record<string, string[]> = {
  amandin: ["dessert", "sucre"],
  "banana-bread-du-kona-inn": ["dessert", "sucre"],
  "cake-au-chevre-et-courgettes": ["sale"],
  "cake-chevre-noix-olives": ["sale"],
  "cake-d-ete-tout-vert": ["sale"],
  "cake-moelleux-au-citron-de-pierre-herme": ["dessert", "sucre"],
  "cake-orange": ["dessert", "sucre"],
  "clafoutis-poires-et-framboises": ["dessert", "sucre"],
  "cocotte-de-cabillaud-aux-courgettes-et-curry": ["plat", "sale"],
  "coulants-au-chocolat": ["dessert", "sucre"],
  "crumble-aux-pommes-du-verger": ["dessert", "sucre"],
  "flan-au-lait-concentre-sucre-nestle": ["dessert", "sucre"],
  "gateau-au-chocolat": ["dessert", "sucre"],
  "gateau-au-citron": ["dessert", "sucre"],
  "gateau-aux-pommes": ["dessert", "sucre"],
  gougeres: ["sale"],
  "macaron-tante-maria": ["dessert", "sucre"],
  "osso-buco": ["plat", "sale", "cocotte-minute"],
  "pain-de-poisson": ["plat", "sale"],
  "pate-feuilletee-maman": ["sucre", "sale", "pâte de base"],
  "pate-sucree-de-pierre-herme": ["dessert", "sucre"],
  mayonnaise: ["sale"],
  "soupe-de-champagne": ["sucre"],
  "cookies-aux-pepites-de-chocolat-et-fleur-de-sel": ["dessert", "sucre"],
  "tarte-aux-amandes-et-confiture-de-framboises": ["dessert", "sucre"],
  tiramisu: ["dessert", "sucre"],
  vacherin: ["dessert", "sucre", "sans cuisson"],
  "veloute-de-courgettes": ["plat", "sale"],
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
  "Gâteau au citron": "Lemon Cake",
  Tiramisu: "Tiramisu",
  "Pâte feuilletée Maman": "Mom's Puff Pastry",
  "Crumble aux pommes du verger": "Orchard Apple Crumble",
  "Cake orange": "Orange Loaf Cake",
  "Cake d’été tout vert": "Green Summer Loaf Cake",
  "Clafoutis poires et framboises": "Pear and Raspberry Clafoutis",
  "Velouté de courgettes": "Zucchini Velouté",
  "Osso buco": "Osso Buco",
  "Cake moelleux au citron de Pierre Hermé": "Pierre Hermé's Moist Lemon Cake",
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
  "Banana bread": "Banana Bread",
  "Variante avec garniture à la cannelle et aux noix de pécan":
    "Cinnamon and Pecan Filling Variation",
  "Soupe de champagne": "Champagne Punch",
  "Cookies aux pépites de chocolat et fleur de sel":
    "Chocolate Chip Cookies with Fleur de Sel",
  Mayonnaise: "Mayonnaise",
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
  "Gâteau de Vichy coupé en deux disques et garni de crème au citron.":
    "Vichy-style cake sliced into two layers and filled with lemon cream.",
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
  "Banana bread moelleux aux bananes bien mûres, parfait avec une salade de poulet.":
    "Moist banana bread made with very ripe bananas, perfect with chicken salad.",
  "Cocktail pétillant au crémant de Loire, Cointreau, Pulco Citron et sirop de sucre de canne, à servir très frais.":
    "Sparkling cocktail with Loire Valley Crémant, Cointreau, Pulco Citron and cane sugar syrup, served very cold.",
  "Gros cookies aux pépites de chocolat, croustillants sur les bords, moelleux au centre et relevés d’une touche de fleur de sel.":
    "Large chocolate chip cookies with crisp edges, soft centers and a touch of fleur de sel.",
  "Mayonnaise maison à la moutarde de Dijon, montée au mixeur avec de l’huile de tournesol et assaisonnée de vinaigre balsamique.":
    "Homemade Dijon mustard mayonnaise blended with sunflower oil and seasoned with balsamic vinegar.",
  "Gâteau macaron aux blancs d’œufs, amandes et extrait d’amande amère, servi avec une crème anglaise à la vanille.":
    "Macaron-style almond cake made with egg whites and bitter almond extract, served with vanilla custard.",
};

const sectionTranslations: Record<string, string> = {
  "Ajout facultatif dans la pâte": "Optional Batter Addition",
  Conservation: "Storage",
  Crème: "Cream",
  "Crème au café": "Coffee Custard",
  "Crème au citron": "Lemon Cream",
  "Crème anglaise à la vanille": "Vanilla Custard",
  Cuisson: "Baking",
  Décor: "Decoration",
  Finition: "Finishing",
  "Glaçage facultatif": "Optional Glaze",
  "Gâteau de Vichy": "Vichy Cake",
  Montage: "Assembly",
  "Notes de cuisson": "Baking Notes",
  Préparation: "Preparation",
  "Préparation de la pâte": "Preparing the Dough",
  "Préparation du macaron": "Macaron Preparation",
  Repos: "Resting",
  Refroidissement: "Cooling",
  Service: "Serving",
  "Suite de la cuisson": "Continuing the Baking",
  "Variante avec garniture à la cannelle et aux noix de pécan":
    "Cinnamon and Pecan Filling Variation",
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
  "bananes bien mûres": "very ripe bananas",
  "bicarbonate de soude": "baking soda",
  "bicarbonate alimentaire": "baking soda",
  "biscuits à la cuillère": "ladyfingers",
  "blancs d’œufs": "egg whites",
  "bouquet garni": "bouquet garni",
  café: "coffee",
  calvados: "calvados",
  cannelle: "cinnamon",
  "cannelle en poudre": "ground cinnamon",
  carottes: "carrots",
  "cassonade en poudre": "brown sugar",
  "cassonade foncée": "dark brown sugar",
  cerfeuil: "chervil",
  chocolat: "chocolate",
  "chocolat en poudre": "cocoa powder",
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
  "crémant de Loire": "Loire Valley Crémant",
  "curry en poudre": "curry powder",
  eau: "water",
  "extrait de café": "coffee extract",
  "extrait de vanille": "vanilla extract",
  "extrait d’amande amère": "bitter almond extract",
  "fleur de sel": "fleur de sel",
  farine: "flour",
  "farine T45": "T45 flour",
  "farine à gâteau": "cake flour",
  "farine T55": "T55 flour",
  "farine semi-complète": "semi-wholemeal flour",
  "filet de cabillaud sans peau et sans arêtes":
    "skinless, boneless cod fillet",
  framboises: "raspberries",
  fécule: "starch",
  "gruyère râpé": "grated Gruyère",
  "gros œuf": "large egg",
  "gousse de vanille": "vanilla bean",
  glaçons: "ice cubes",
  huile: "oil",
  "huile de tournesol": "sunflower oil",
  "huile d’olive": "olive oil",
  "jarret de veau": "veal shank",
  "jaune d’œuf": "egg yolk",
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
  "moutarde de Dijon": "Dijon mustard",
  muscade: "nutmeg",
  "noisettes concassées": "chopped hazelnuts",
  noix: "walnuts",
  "noix de pécan hachées": "chopped pecans",
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
  "sucre en poudre": "granulated sugar",
  "sucre blanc": "white sugar",
  "sucre glace": "icing sugar",
  "sucre semoule": "granulated sugar",
  "sucre roux": "brown sugar",
  "tapenade verte ou pesto vert": "green tapenade or green pesto",
  thym: "thyme",
  "tomates concassées": "crushed tomatoes",
  vanille: "vanilla",
  "vinaigre balsamique": "balsamic vinegar",
  "vin blanc": "white wine",
  "zeste de citron": "lemon zest",
  "glace à la vanille": "vanilla ice cream",
  œuf: "egg",
  œufs: "eggs",
};

const noteTranslations: Record<string, string> = {
  "+ pour déco": "+ extra for decoration",
  "1 boîte": "1 box",
  "150 g noté entre parenthèses": "150 g noted in parentheses",
  "200 g indiqué sur la recette": "200 g indicated on the recipe",
  "397 g": "397 g",
  "Attention à ne pas trop mélanger le mascarpone : il ne doit pas devenir trop liquide.":
    "Be careful not to overmix the mascarpone, as it should not become too runny.",
  "Carré frais indiqué par correction utilisateur":
    "Carré frais noted from user correction",
  "La formulation exacte du pliage était difficile à lire.":
    "The exact folding wording was difficult to read.",
  "La phrase « avec 1 c. à s. » est conservée telle quelle car son sens exact n’est pas totalement explicite.":
    "The phrase “with 1 tbsp.” is kept as written because its exact meaning is not fully clear.",
  "Matériel : plat à gratin.": "Equipment: gratin dish.",
  "Meilleur préparé la veille.": "Best prepared the day before.",
  "PDT sur la recette": "Potato on the recipe",
  "Pierre Hermé ou autre": "Pierre Hermé or another one",
  "blancs en neige": "whipped egg whites",
  "blancs et jaunes séparés": "whites and yolks separated",
  "correction utilisateur": "user correction",
  crème: "cream",
  "découpé en petits dés": "cut into small cubes",
  facultatif: "optional",
  "graines uniquement": "seeds only",
  "grossièrement haché": "roughly chopped",
  "grand moule": "large pan",
  "jus + zeste": "juice + zest",
  "lotte à l’origine, ou mélange saumon, cabillaud, julienne":
    "originally monkfish, or a mix of salmon, cod and ling",
  margarine: "margarine",
  "mesuré avec la boîte vide": "measured with the empty can",
  "noté « 2/3 poires »": "noted as “2/3 pears”",
  "ou 2 petits": "or 2 small ones",
  "ajout manuscrit possible": "possible handwritten addition",
  "bien battus": "well beaten",
  "première variante facultative": "first optional variation",
  "pour la crème au citron": "for the lemon cream",
  "pour la crème anglaise": "for the custard",
  "pour la crème anglaise, jaunes restant après le macaron":
    "for the custard, using the yolks left from the macaron cake",
  "pour la crème anglaise ; à défaut, utiliser de l’extrait de vanille selon le dosage du flacon":
    "for the custard; if unavailable, use vanilla extract according to the bottle directions",
  "pour la cuisson": "for cooking",
  "pour le cake": "for the cake",
  "pour le caramel": "for the caramel",
  "pour le décor": "for decoration",
  "pour le glaçage": "for the glaze",
  "pour le gâteau": "for the cake",
  "pour le moule": "for the pan",
  "pour le plat": "for the dish",
  "pour parsemer": "for sprinkling",
  "pour saupoudrer": "for dusting",
  "pour le sirop": "for the syrup",
  "environ 20 cl, à ajouter progressivement": "about 20 cl, added gradually",
  "mélange de poissons surgelés sans arêtes": "frozen boneless fish mix",
  "facultatif, pour le service": "optional, for serving",
  "variante avec garniture facultative": "optional filling variation",
  "environ 200 g chacune": "about 200 g each",
  "pour le sirop, note manuscrite 0,08 l":
    "for the syrup; handwritten note 0.08 l",
  "écrasées, environ 3 tasses": "mashed, about 3 cups",
  "écrasées, environ 3 à 4 bananes selon leur taille":
    "mashed, about 3 to 4 bananas depending on their size",
  "ou farine pâtissière": "or pastry flour",
  "Un incontournable avec les salades de poulet.":
    "A classic with chicken salads.",
  "Pour une mayonnaise bien fraîche, la laisser reposer 30 min au réfrigérateur avant de servir.":
    "For a well-chilled mayonnaise, refrigerate it for 30 min before serving.",
  "Variante au café : remplacer la vanille par 2 c. à c. d’extrait de café, ajoutées hors du feu.":
    "Coffee variation: replace the vanilla with 2 tsp coffee extract, added off the heat.",
  "Cette recette donne plutôt 5 coulants que 6.":
    "This recipe makes closer to 5 lava cakes than 6.",
  "à convenance": "to taste",
  ramolli: "softened",
  rases: "level",
  "selon le goût": "to taste",
  "selon besoin": "as needed",
  "écrit « chivre » sur la recette": "written “chivre” on the recipe",
};

const stepTranslations: Record<string, string> = {
  "Battre le beurre ramolli avec le sucre jusqu’à obtenir un mélange clair, léger et mousseux.":
    "Beat the softened butter and sugar until light and fluffy.",
  "Ajouter les bananes écrasées et les œufs battus, puis mélanger jusqu’à obtenir une pâte homogène.":
    "Add the mashed bananas and beaten eggs, then mix until smooth.",
  "Dans un autre saladier, mélanger la farine T45, la Maïzena, le bicarbonate de soude et le sel. Tamiser idéalement les ingrédients secs plusieurs fois, puis les incorporer à la préparation à la banane sans trop travailler la pâte.":
    "In another bowl, combine the T45 flour, cornstarch, baking soda and salt. Sift the dry ingredients, ideally several times, then fold them into the banana mixture without overmixing.",
  "Pour la première variante, incorporer les noix de pécan hachées et la pincée de cannelle à la pâte. Ne pas cumuler cet ajout avec la variante comportant une garniture.":
    "For the first variation, fold the chopped pecans and pinch of cinnamon into the batter. Do not combine this option with the filling variation.",
  "Verser la pâte dans 1 moule à cake légèrement graissé.":
    "Pour the batter into 1 lightly greased loaf pan.",
  "Cuire 45 à 60 min, jusqu’à ce que le centre soit ferme et qu’une lame de couteau ou un cure-dent ressorte propre ou presque propre.":
    "Bake for 45 to 60 min, until the center is firm and a knife or toothpick inserted into it comes out clean or almost clean.",
  "Laisser refroidir 10 min dans le moule, puis démouler sur une grille.":
    "Let cool in the pan for 10 min, then unmold onto a rack.",
  "Pour cette variante, ne pas ajouter à la pâte les noix de pécan et la cannelle prévues pour être incorporées directement.":
    "For this variation, omit the pecans and cinnamon intended to be mixed directly into the batter.",
  "Verser la moitié de la pâte dans le moule, saupoudrer une partie du mélange, puis ajouter le reste de pâte.":
    "Pour half the batter into the pan, sprinkle with some of the mixture, then add the remaining batter.",
  "S’il reste du mélange, le répartir sur le dessus et l’enfoncer légèrement dans la pâte.":
    "If any mixture remains, sprinkle it on top and press it lightly into the batter.",
  "Mettre la moutarde de Dijon et le jaune d’œuf dans le bol du mixeur, puis mixer.":
    "Place the Dijon mustard and egg yolk in the blender bowl, then blend.",
  "Continuer à mixer en versant progressivement l’huile de tournesol en un petit filet, jusqu’à obtenir une mayonnaise bien émulsionnée.":
    "Keep blending while gradually pouring in the sunflower oil in a thin stream, until the mayonnaise is well emulsified.",
  "Ajouter quelques gouttes de vinaigre balsamique, puis saler et poivrer à convenance. Mixer une dernière fois pour homogénéiser.":
    "Add a few drops of balsamic vinegar, then season with salt and pepper to taste. Blend once more until smooth.",
  "Dans un bol, mélanger la farine, le bicarbonate, la levure chimique et le sel.":
    "In a bowl, combine the flour, baking soda, baking powder and salt.",
  "Faire fondre le beurre à feu moyen, puis le verser dans un grand bol.":
    "Melt the butter over medium heat, then pour it into a large bowl.",
  "Ajouter le sucre roux et le sucre en poudre au beurre fondu, puis mélanger jusqu’à obtenir une préparation homogène.":
    "Add the brown sugar and granulated sugar to the melted butter, then mix until smooth.",
  "Incorporer l’œuf et les graines de vanille jusqu’à obtenir une texture lisse et brillante.":
    "Mix in the egg and vanilla seeds until smooth and glossy.",
  "Ajouter les ingrédients secs en deux fois avec une cuillère en bois, en mélangeant juste assez pour les incorporer.":
    "Add the dry ingredients in two batches with a wooden spoon, mixing only until incorporated.",
  "Ajouter le chocolat noir grossièrement haché et mélanger une dernière fois sans trop travailler la pâte.":
    "Add the roughly chopped dark chocolate and mix once more without overworking the dough.",
  "Couvrir le bol et placer la pâte au réfrigérateur pendant 30 min.":
    "Cover the bowl and chill the dough for 30 min.",
  "Préchauffer le four à 180 °C et recouvrir une plaque de papier cuisson.":
    "Preheat the oven to 180 °C and line a baking sheet with parchment paper.",
  "Former de grosses boules de pâte avec une cuillère à glace ou une cuillère à soupe, puis les espacer largement sur la plaque.":
    "Shape the dough into large balls with an ice cream scoop or tablespoon, spacing them well apart on the baking sheet.",
  "Saupoudrer chaque boule d’une petite pincée de fleur de sel.":
    "Sprinkle each ball with a small pinch of fleur de sel.",
  "Enfourner pour 8 min, sortir la plaque et la taper légèrement sur le plan de travail pour aider les cookies à s’étaler.":
    "Bake for 8 min, remove the baking sheet and tap it lightly on the counter to help the cookies spread.",
  "Poursuivre la cuisson 2 min, puis taper de nouveau la plaque à la sortie du four.":
    "Bake for another 2 min, then tap the baking sheet again after removing it from the oven.",
  "Déposer les cookies sur une grille et les laisser reposer au moins 10 min avant de les conserver ou de les déguster.":
    "Transfer the cookies to a rack and let them rest for at least 10 min before storing or serving.",
  "Placer tous les ingrédients au réfrigérateur à l’avance afin qu’ils soient bien frais.":
    "Chill all the ingredients in advance so they are very cold.",
  "Dans un saladier, mélanger le Cointreau, le Pulco Citron et le Canadou.":
    "In a punch bowl, combine the Cointreau, Pulco Citron and Canadou.",
  "Au dernier moment, ajouter le crémant de Loire.":
    "At the last moment, add the Loire Valley Crémant.",
  "Ajouter des glaçons, remuer délicatement et servir aussitôt, très frais.":
    "Add ice cubes, stir gently and serve immediately, very cold.",
  "Préchauffer le four à 140 °C.": "Preheat the oven to 140 °C.",
  "Préchauffer le four à 160 °C.": "Preheat the oven to 160 °C.",
  "Préchauffer le four à 190 °C.": "Preheat the oven to 190 °C.",
  "Préchauffer le four à 210 °C (th. 7).":
    "Preheat the oven to 210 °C (gas mark 7).",
  "Séparer les blancs d’œufs des jaunes.":
    "Separate the egg whites from the yolks.",
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
  "Faire fondre le beurre dans une casserole.":
    "Melt the butter in a saucepan.",
  "Ajouter le sucre, l’œuf et la vanille.": "Add the sugar, egg and vanilla.",
  "Au bout de 25 min, quand le gâteau commence à monter et à dorer, ajouter la crème et continuer la cuisson.":
    "After 25 min, when the cake starts to rise and brown, add the cream and continue baking.",
  "Ce gâteau se conserve 3 à 4 jours.": "This cake keeps for 3 to 4 days.",
  "Huiler le moule en couronne.": "Oil the ring mold.",
  "Battre énergiquement les jaunes d’œufs et le sucre semoule jusqu’à ce que le mélange blanchisse.":
    "Beat the egg yolks and granulated sugar vigorously until the mixture turns pale.",
  "Ajouter l’extrait de vanille et la crème.":
    "Add the vanilla extract and cream.",
  "Battre les blancs en neige en ajoutant à la fin le sucre glace.":
    "Whip the egg whites, adding the icing sugar at the end.",
  "Ajouter délicatement les blancs à la préparation et verser la moitié dans le moule.":
    "Gently fold the whites into the mixture and pour half into the mold.",
  "Déposer les meringues grossièrement écrasées, puis terminer par le reste de la préparation.":
    "Add the roughly crushed meringues, then finish with the remaining mixture.",
  "Faire congeler 3 h.": "Freeze for 3 h.",
  "Pour démouler, tremper le moule quelques secondes dans l’eau tiède.":
    "To unmold, dip the mold in warm water for a few seconds.",
  "Battre les blancs en neige très ferme.":
    "Whip the egg whites until very stiff.",
  "Tourner avec le sucre 5 min au batteur électrique.":
    "Beat with the sugar for 5 min using an electric mixer.",
  "Ajouter ensuite les amandes, la levure et l’extrait d’amande amère.":
    "Then add the almonds, baking powder and bitter almond extract.",
  "Cuire à four doux, 140 °C, pendant 45 min.":
    "Bake in a low oven at 140 °C for 45 min.",
  "Faire bouillir 1/2 litre de lait avec 1 c. à café très rase de Maïzena.":
    "Bring 1/2 liter of milk to a boil with 1 very level teaspoon of cornstarch.",
  "Mélanger 6 jaunes d’œufs avec 100 g de sucre fin.":
    "Mix 6 egg yolks with 100 g caster sugar.",
  "Ajouter le lait bouillant en tournant.":
    "Add the boiling milk while stirring.",
  "Remettre dans la casserole et faire prendre la crème 1 à 2 min à peine.":
    "Return to the saucepan and let the custard thicken for just 1 to 2 min.",
  "Ajouter 2 c. à c. d’extrait de café.": "Add 2 tsp coffee extract.",
  "Servir frais.": "Serve chilled.",
  "Faire fondre le chocolat avec le beurre.":
    "Melt the chocolate with the butter.",
  "Mélanger le sucre et les jaunes d’œufs.": "Mix the sugar and egg yolks.",
  "Ajouter le chocolat et la farine, puis les blancs en neige.":
    "Add the chocolate and flour, then the whipped egg whites.",
  "Cuire à four moyen pendant 30 min, à 180 °C.":
    "Bake in a medium oven for 30 min at 180 °C.",
  "Préparation non indiquée sur la page transmise.":
    "Preparation was not shown on the provided page.",
  "Mélanger le sucre avec 3 jaunes d’œufs + 1 œuf entier.":
    "Mix the sugar with 3 egg yolks + 1 whole egg.",
  "Battre les blancs en neige ferme.": "Whip the egg whites until stiff.",
  "Les incorporer à la pâte en intercalant la farine.":
    "Fold them into the batter, alternating with the flour.",
  "Cuire à four moyen pendant 45 min.": "Bake in a medium oven for 45 min.",
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
  "Battre les jaunes avec le sucre fin.":
    "Beat the yolks with the caster sugar.",
  "Ajouter le mascarpone aux jaunes sucrés. Mélanger au batteur à vitesse 1 pendant 30 secondes maximum, juste pour commencer à homogénéiser. Terminer à la maryse en écrasant délicatement les éventuels morceaux de mascarpone contre les parois, sans trop travailler la préparation.":
    "Add the mascarpone to the sweetened yolks. Mix at speed 1 for no more than 30 seconds, just until the mixture starts to come together. Finish with a spatula, gently pressing any remaining pieces of mascarpone against the sides of the bowl without overworking the mixture.",
  "Incorporer les blancs aux jaunes et au mascarpone.":
    "Fold the whites into the yolks and mascarpone.",
  "Mélanger le café et la c. à s. d’alcool.":
    "Mix the coffee with the tablespoon of alcohol.",
  "Tremper rapidement chaque biscuit dans le mélange café-alcool : une face, puis l’autre, sans le laisser se détremper. Le déposer immédiatement dans le plat.":
    "Quickly dip each biscuit into the coffee and alcohol mixture, one side and then the other, without letting it become soggy. Place it in the dish immediately.",
  "Ranger les biscuits côte à côte et les tasser légèrement pour former une couche uniforme.":
    "Arrange the biscuits side by side and press them down lightly to form an even layer.",
  "Ajouter le mélange.": "Add the mixture.",
  "Saupoudrer de chocolat en poudre.": "Dust with cocoa powder.",
  "Mettre au frigo 10 à 12 h.": "Refrigerate for 10 to 12 h.",
  "Mettre la farine sur le plan de travail.":
    "Place the flour on the work surface.",
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
  "Laisser reposer 15 min avant utilisation.":
    "Let rest for 15 min before using.",
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
  "La lame du couteau doit ressortir sèche.":
    "A knife blade should come out dry.",
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
  "Faire cuire tous ces légumes dans 50 cl d’eau avec du sel et le thym.":
    "Cook all the vegetables in 50 cl water with the salt and thyme.",
  "Laisser mijoter 15 min puis mixer.": "Simmer for 15 min, then blend.",
  "Ajouter le fromage fondu et la crème, puis poivrer et ajouter la muscade selon le goût.":
    "Add the processed cheese and cream, then season with pepper and nutmeg to taste.",
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
  "Cuire 30 min à 180 °C.": "Bake for 30 min at 180 °C.",
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
  "Couper les filets de cabillaud en morceaux.":
    "Cut the cod fillets into pieces.",
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
  "Placer la pâte sur le plan de travail.":
    "Place the dough on the work surface.",
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
  "Verser le tout dans le moule beurré.":
    "Pour everything into the buttered pan.",
  "Cuire au bain-marie dans un four à th. 7 pendant 40 min.":
    "Bake in a water bath in a th. 7 oven for 40 min.",
  "Vérifier la cuisson avec un couteau ; le dessus doit être légèrement doré.":
    "Check doneness with a knife; the top should be lightly browned.",
  "Laisser bien refroidir avant de démouler.":
    "Let cool completely before unmolding.",
  "Servir avec une belle mayonnaise maison et garnir de salade autour du plat.":
    "Serve with a generous homemade mayonnaise and garnish the platter with salad.",
  "Faire fondre le beurre et le chocolat 2 min au micro-ondes.":
    "Melt the butter and chocolate for 2 min in the microwave.",
  "Mélanger les œufs, le sucre et la farine.": "Mix the eggs, sugar and flour.",
  "Verser cette préparation dans le mélange beurre-chocolat.":
    "Pour this mixture into the butter-chocolate mixture.",
  "Répartir dans les 6 moules.": "Divide among the 6 molds.",
  "Cuire 10 min à four chaud à 180 °C.":
    "Bake for 10 min in a hot oven at 180 °C.",
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
  "Napper le moule à cake avec le caramel.": "Coat the loaf pan with caramel.",
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
  "Préchauffer le four à 175 °C.": "Preheat the oven to 175 °C.",
  "À l’aide d’un batteur électrique, battre le sucre et le beurre jusqu’à obtenir un mélange léger et mousseux.":
    "Using an electric mixer, beat the sugar and butter until light and fluffy.",
  "Ajouter les bananes écrasées et les œufs, puis battre jusqu’à ce que le mélange soit homogène.":
    "Add the mashed bananas and eggs, then beat until smooth.",
  "Tamiser ensemble les ingrédients secs trois fois.":
    "Sift the dry ingredients together three times.",
  "Incorporer les ingrédients secs au mélange à la banane sans trop mélanger.":
    "Fold the dry ingredients into the banana mixture without overmixing.",
  "Verser la pâte dans 2 moules à cake légèrement graissés.":
    "Pour the batter into 2 lightly greased loaf pans.",
  "Cuire 45 min à 1 h, jusqu’à ce que le centre soit ferme et que les bords commencent à se détacher des moules.":
    "Bake for 45 min to 1 h, until the center is firm and the edges begin to pull away from the pans.",
  "Laisser refroidir sur une grille pendant 10 min avant de démouler.":
    "Let cool on a rack for 10 min before unmolding.",
  "Mélanger les noix de pécan hachées, la cassonade foncée et la cannelle.":
    "Mix the chopped pecans, dark brown sugar and cinnamon.",
  "Verser la moitié de la pâte dans le moule, saupoudrer avec ce mélange, puis ajouter le reste de pâte.":
    "Pour half the batter into the pan, sprinkle with this mixture, then add the remaining batter.",
  "S’il reste du mélange, en mettre sur le dessus et l’enfoncer légèrement.":
    "If any mixture remains, sprinkle it on top and press it in lightly.",
  "Ce banana bread se congèle très bien.":
    "This banana bread freezes very well.",
  "Ajouter le lait, les œufs et l’huile.": "Add the milk, eggs and oil.",
  "Enfourner à 180 °C pendant 25 min.": "Bake at 180 °C for 25 min.",
  "Au bout de 25 min, quand le gâteau commence à monter et à dorer, verser la crème sur le gâteau et poursuivre la cuisson 15 min.":
    "After 25 min, when the cake begins to rise and brown, pour the cream over it and bake for another 15 min.",
  "Fendre la gousse de vanille et gratter les graines.":
    "Split the vanilla bean and scrape out the seeds.",
  "Faire bouillir 50 cl de lait avec la gousse, les graines de vanille et 1 c. à café très rase de Maïzena.":
    "Bring 50 cl milk to a boil with the vanilla pod, seeds and 1 very level tsp cornstarch.",
  "Retirer la gousse, puis verser progressivement le lait bouillant sur les jaunes en remuant.":
    "Remove the vanilla pod, then gradually pour the hot milk over the yolks while stirring.",
  "Remettre dans la casserole et faire épaissir la crème 1 à 2 min à feu doux, sans la laisser bouillir.":
    "Return to the saucepan and thicken over low heat for 1 to 2 min without letting it boil.",
  "Laisser refroidir et servir la crème anglaise bien fraîche à côté du macaron.":
    "Let the custard cool, chill it well and serve it alongside the macaron cake.",
  "Ajouter le chocolat et la farine, puis incorporer délicatement les blancs en neige.":
    "Add the chocolate and flour, then gently fold in the whipped egg whites.",
  "Verser la pâte dans le moule.": "Pour the batter into the pan.",
  "Verser la pâte dans le moule et cuire 45 min à 160 °C.":
    "Pour the batter into the pan and bake for 45 min at 160 °C.",
  "Laisser refroidir complètement le gâteau de Vichy.":
    "Let the Vichy cake cool completely.",
  "Couper horizontalement le gâteau en deux disques à l’aide d’un couteau à longue lame.":
    "Slice the cake horizontally into two layers with a long-bladed knife.",
  "Étaler la crème au citron sur le disque inférieur, puis replacer délicatement le disque supérieur.":
    "Spread the lemon cream over the bottom layer, then gently replace the top layer.",
  "Réserver 70 g de margarine. Mettre le reste de la margarine en morceaux dans un puits formé au centre de la farine, puis ajouter le sel.":
    "Reserve 70 g margarine. Put the remaining margarine in pieces into a well in the flour, then add the salt.",
  "Malaxer en ajoutant progressivement l’eau, jusqu’à obtenir une pâte homogène.":
    "Knead while gradually adding the water, until the dough is smooth.",
  "Étaler la pâte au rouleau, puis répartir les 70 g de margarine réservés sur toute la surface.":
    "Roll out the dough, then spread the reserved 70 g margarine over the entire surface.",
  "Effectuer un premier tour simple : replier un tiers de la pâte vers le centre, puis rabattre l’autre tiers par-dessus.":
    "Make the first single turn: fold one third of the dough toward the center, then fold the other third over it.",
  "Étaler de nouveau la pâte, puis effectuer une seconde fois le même pliage en trois.":
    "Roll out the dough again, then repeat the same letter fold a second time.",
  "Cuire le mélange de poissons surgelés dans un court-bouillon prêt à l’emploi, environ 10 à 15 min, puis bien l’égoutter.":
    "Poach the frozen fish mix in prepared court-bouillon for about 10 to 15 min, then drain well.",
  "Ajouter le poisson dans la jatte et mélanger le tout au robot jusqu’à obtenir la consistance souhaitée.":
    "Add the fish to the bowl and process until the desired consistency is reached.",
  "Laisser complètement refroidir avant de démouler, puis réserver au réfrigérateur jusqu’au service.":
    "Let cool completely before unmolding, then refrigerate until serving.",
  "Servir froid avec une mayonnaise maison et garnir de salade autour du plat.":
    "Serve cold with homemade mayonnaise and arrange salad around the platter.",
  "Répartir dans 5 empreintes à muffins, en forme de petits cupcakes.":
    "Divide among 5 muffin cups.",
  "Laisser tiédir, puis passer délicatement une cuillère à soupe entre chaque coulant et son moule pour le démouler sans le casser.":
    "Let cool until warm, then gently slide a tablespoon between each lava cake and its cup to unmold it without breaking it.",
  "Servir chaque coulant tiède avec une boule de glace à la vanille.":
    "Serve each lava cake warm with a scoop of vanilla ice cream.",
};

const unitTranslations: Record<string, string> = {
  "": "",
  "à 10 personnes": "to 10 people",
  "à 6 personnes": "to 6 people",
  boîte: "can",
  belles: "large",
  bouquet: "bunch",
  cafetière: "coffee pot",
  "c. à café": "tsp",
  "c. à café très rase": "very level tsp",
  "c. à c.": "tsp",
  "c. à s.": "tbsp",
  cakes: "loaves",
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
  tasse: "cup",
  tasses: "cups",
  verre: "glass",
};

const quantityTranslations: Record<string, string> = {
  "325 à 350": "325 to 350",
  "5 à 7": "5 to 7",
  "quelques gouttes": "a few drops",
};

const yieldLabelTranslations: Record<string, string> = {
  "1 cake": "1 loaf",
  "Environ 1 litre": "About 1 litre",
  "Environ 1,3 kg de pâte": "About 1.3 kg of dough",
  "Environ 500 g de pâte": "About 500 g of dough",
  "Environ 20 gougères": "About 20 gougères",
  "Environ 20 gros cookies": "About 20 large cookies",
  "Environ 5 coulants": "About 5 lava cakes",
  "Un petit bol": "One small bowl",
};

const timeTranslations: Record<string, string> = {
  "Jusqu’à complet refroidissement": "Until completely cool",
  "3 h au congélateur": "3 h in the freezer",
};

const equipmentTranslations: Record<string, string> = {
  "1 moule à gâteau": "1 cake pan",
  "1 moule à cake": "1 loaf pan",
  "1 plat pour bain-marie": "1 roasting dish for the water bath",
  "1 moule à manqué": "1 round cake pan",
  "1 moule en couronne": "1 ring mold",
  "1 casserole": "1 saucepan",
  "1 couteau à longue lame": "1 long-bladed knife",
  "1 rouleau à pâtisserie": "1 rolling pin",
  "5 empreintes à muffins": "5 muffin cups",
  "1 batteur électrique": "1 electric mixer",
  "1 maryse": "1 silicone spatula",
  "1 plat de service": "1 serving dish",
  "1 plat à gratin": "1 baking dish",
  "1 moule à cake ou 12 moules à mini-cakes":
    "1 loaf pan or 12 mini-loaf molds",
  "1 cocotte-minute": "1 pressure cooker",
  "1 plaque de cuisson": "1 baking sheet",
  "1 poêle": "1 frying pan",
  "6 petites cocottes": "6 small cocottes",
  "1 mixeur": "1 blender",
};

export function localizeRecipe(
  recipe: SourceRecipe,
  locale: Locale,
): LocalizedRecipe {
  if (locale === "fr") {
    return {
      title: recipe.title,
      author: recipe.author,
      description: recipe.description,
      yieldLabel: resolveYieldLabel({
        locale: "fr",
        slug: recipe.slug,
        yieldLabel: recipe.yieldLabel,
        servings: recipe.servings,
      }),
      servings: recipe.servings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      restTime: recipe.restTime ?? "",
      totalTime: recipe.totalTime,
      timeLabel: getTimeLabel(recipe, "fr"),
      temperature: recipe.temperature,
      equipment: recipe.equipment ?? [],
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
    yieldLabel: resolveYieldLabel({
      locale: "en",
      slug: recipe.slug,
      yieldLabel: recipe.yieldLabel
        ? translate(yieldLabelTranslations, recipe.yieldLabel)
        : undefined,
      servings: translateServings(recipe.servings),
    }),
    servings: translateServings(recipe.servings),
    prepTime: translateTime(recipe.prepTime),
    cookTime: translateTime(recipe.cookTime),
    restTime: translateTime(recipe.restTime ?? ""),
    totalTime: translateTime(recipe.totalTime),
    timeLabel: getTimeLabel(recipe, "en"),
    temperature:
      recipe.temperature === "feu doux" ? "low heat" : recipe.temperature,
    equipment: (recipe.equipment ?? []).map(translateEquipment),
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
  const referenceServings = resolveReferenceServings(
    recipe.referenceServings,
    recipe.servings,
  );
  const categoryFields = resolveRecipeCategories({ tags: inferTags(recipe) });
  const fr = enrichLocalizedStepIngredients(localizeRecipe(recipe, "fr"));
  const en = enrichLocalizedStepIngredients(localizeRecipe(recipe, "en"));
  return {
    slug: recipe.slug,
    heroImageUrl:
      recipe.heroImageUrl ||
      fallbackHeroImageUrls[recipe.slug] ||
      defaultHeroImageUrl,
    defaultLocale: "fr",
    ...(referenceServings ? { referenceServings } : {}),
    relatedRecipeSlugs: recipe.relatedRecipeSlugs ?? [],
    translations: {
      fr,
      en,
    },
    ...categoryFields,
    tags: toLegacyTags(
      categoryFields.categories,
      categoryFields.legacyCategoryLabels,
    ),
    status: "published",
  };
}

function translateIngredient(ingredient: SourceIngredient): SourceIngredient {
  return {
    name: translate(ingredientTranslations, ingredient.name),
    quantity: translate(quantityTranslations, ingredient.quantity),
    unit: translate(unitTranslations, ingredient.unit),
    notes: ingredient.notes
      ? translate(noteTranslations, ingredient.notes)
      : "",
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

function translateTime(value: string) {
  const exact = translate(timeTranslations, value);
  if (exact !== value) return exact;

  return value
    .replace(/(\d)\s+à\s+(\d)/g, "$1 to $2")
    .replace("au réfrigérateur", "in the refrigerator")
    .replace("au congélateur", "in the freezer")
    .replace("idéalement 1 nuit", "ideally overnight")
    .replace("de repos, hors préparation", "resting, excluding preparation")
    .replace("hors refroidissement", "excluding cooling")
    .replace("selon le format", "depending on size");
}

function translateEquipment(value: string) {
  return translate(equipmentTranslations, value);
}

function getTimeLabel(recipe: SourceRecipe, locale: Locale) {
  const fallback = locale === "fr" ? "Temps libre" : "Flexible timing";

  if (recipe.totalTime)
    return locale === "en" ? translateTime(recipe.totalTime) : recipe.totalTime;
  if (recipe.cookTime)
    return locale === "en" ? translateTime(recipe.cookTime) : recipe.cookTime;
  if (recipe.prepTime)
    return locale === "en" ? translateTime(recipe.prepTime) : recipe.prepTime;

  return fallback;
}

function inferTags(recipe: SourceRecipe) {
  return recipeCategoryTags[recipe.slug] ?? ["sucre", "sale"];
}

function translate(translations: Record<string, string>, value: string) {
  return translations[value] ?? value;
}
