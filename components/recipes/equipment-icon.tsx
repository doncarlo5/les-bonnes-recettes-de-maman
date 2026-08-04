import BlenderIcon from "@hugeicons/core-free-icons/BlenderIcon";
import CakeIcon from "@hugeicons/core-free-icons/CakeIcon";
import CookingPotIcon from "@hugeicons/core-free-icons/CookingPotIcon";
import Cupcake01Icon from "@hugeicons/core-free-icons/Cupcake01Icon";
import Dish01Icon from "@hugeicons/core-free-icons/Dish01Icon";
import ForkIcon from "@hugeicons/core-free-icons/ForkIcon";
import GlassWaterIcon from "@hugeicons/core-free-icons/GlassWaterIcon";
import KitchenUtensilsIcon from "@hugeicons/core-free-icons/KitchenUtensilsIcon";
import Knife02Icon from "@hugeicons/core-free-icons/Knife02Icon";
import MixerIcon from "@hugeicons/core-free-icons/MixerIcon";
import OvenIcon from "@hugeicons/core-free-icons/OvenIcon";
import Pan01Icon from "@hugeicons/core-free-icons/Pan01Icon";
import PlateIcon from "@hugeicons/core-free-icons/PlateIcon";
import Pot01Icon from "@hugeicons/core-free-icons/Pot01Icon";
import RiceBowl01Icon from "@hugeicons/core-free-icons/RiceBowl01Icon";
import RollingPinIcon from "@hugeicons/core-free-icons/RollingPinIcon";
import SaladIcon from "@hugeicons/core-free-icons/SaladIcon";
import SpatulaIcon from "@hugeicons/core-free-icons/SpatulaIcon";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

export type EquipmentIconName =
  | "blender"
  | "bowl"
  | "cake-pan"
  | "cooking-pot"
  | "dish"
  | "fork"
  | "glass"
  | "knife"
  | "mixer"
  | "muffin-pan"
  | "oven"
  | "pan"
  | "plate"
  | "pot"
  | "rolling-pin"
  | "salad-bowl"
  | "spatula"
  | "utensils";

const equipmentIcons: Record<EquipmentIconName, IconSvgElement> = {
  blender: BlenderIcon,
  bowl: RiceBowl01Icon,
  "cake-pan": CakeIcon,
  "cooking-pot": CookingPotIcon,
  dish: Dish01Icon,
  fork: ForkIcon,
  glass: GlassWaterIcon,
  knife: Knife02Icon,
  mixer: MixerIcon,
  "muffin-pan": Cupcake01Icon,
  oven: OvenIcon,
  pan: Pan01Icon,
  plate: PlateIcon,
  pot: Pot01Icon,
  "rolling-pin": RollingPinIcon,
  "salad-bowl": SaladIcon,
  spatula: SpatulaIcon,
  utensils: KitchenUtensilsIcon,
};

const equipmentIconRules: ReadonlyArray<{
  icon: EquipmentIconName;
  pattern: RegExp;
}> = [
  {
    icon: "rolling-pin",
    pattern: /\b(rouleau(?:x)?|rolling pins?)\b/,
  },
  { icon: "spatula", pattern: /\b(maryses?|spatulas?)\b/ },
  {
    icon: "mixer",
    pattern:
      /\b(batteurs?(?: electriques?)?|electric mixers?|hand mixers?|mixers?)\b/,
  },
  { icon: "blender", pattern: /\b(mixeurs?|blenders?)\b/ },
  { icon: "pan", pattern: /\b(poeles?|frying pans?|skillets?)\b/ },
  {
    icon: "pot",
    pattern:
      /\b(cocottes?[- ]minutes?|pressure cookers?|sauciers?(?: seb)?|sauce makers?)\b/,
  },
  {
    icon: "dish",
    pattern: /\b(petites? cocottes?|small cocottes?)\b/,
  },
  {
    icon: "cooking-pot",
    pattern: /\b(casseroles?|saucepans?|cooking pots?)\b/,
  },
  { icon: "knife", pattern: /\b(couteaux?|knives?|knife)\b/ },
  { icon: "fork", pattern: /\b(fourchettes?|forks?)\b/ },
  { icon: "glass", pattern: /\b(verres?|glasses?|glass)\b/ },
  {
    icon: "salad-bowl",
    pattern: /\b(saladiers?|salad bowls?)\b/,
  },
  { icon: "bowl", pattern: /\b(bols?|bowls?)\b/ },
  {
    icon: "muffin-pan",
    pattern:
      /\b(empreintes? a muffins?|muffin cups?|mini[- ]cakes?|mini[- ]loaves?|mini[- ]loaf)\b/,
  },
  {
    icon: "oven",
    pattern: /\b(plaques? de cuisson|baking sheets?|baking trays?)\b/,
  },
  {
    icon: "plate",
    pattern: /\b(plats? de service|serving dishes|serving dish|serving plates?)\b/,
  },
  {
    icon: "dish",
    pattern:
      /\b(plats? a gratin|plats? pour bain[- ]marie|baking dishes|baking dish|roasting dishes|roasting dish|water bath dishes|water bath dish)\b/,
  },
  {
    icon: "dish",
    pattern: /\b(plats?|dishes|dish)\b/,
  },
  {
    icon: "cake-pan",
    pattern:
      /\b(moules?|molds?|cake pans?|loaf pans?|baking pans?|round pans?|ring pans?)\b/,
  },
];

export function normalizeEquipmentLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(
      /^\s*(?:(?:\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:[x×]\s*)?)+/u,
      "",
    )
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveEquipmentIcon(label: string): EquipmentIconName {
  const normalizedLabel = normalizeEquipmentLabel(label);
  return (
    equipmentIconRules.find(({ pattern }) => pattern.test(normalizedLabel))
      ?.icon ?? "utensils"
  );
}

export function EquipmentIcon({ label }: { label: string }) {
  return (
    <HugeiconsIcon
      icon={equipmentIcons[resolveEquipmentIcon(label)]}
      size={22}
      strokeWidth={1.8}
      className="text-primary"
      aria-hidden="true"
      focusable="false"
      data-equipment-icon
    />
  );
}
