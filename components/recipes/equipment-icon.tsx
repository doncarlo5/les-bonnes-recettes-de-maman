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
import Pan01Icon from "@hugeicons/core-free-icons/Pan01Icon";
import PlateIcon from "@hugeicons/core-free-icons/PlateIcon";
import Pot01Icon from "@hugeicons/core-free-icons/Pot01Icon";
import RiceBowl01Icon from "@hugeicons/core-free-icons/RiceBowl01Icon";
import RollingPinIcon from "@hugeicons/core-free-icons/RollingPinIcon";
import SaladIcon from "@hugeicons/core-free-icons/SaladIcon";
import SpatulaIcon from "@hugeicons/core-free-icons/SpatulaIcon";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

export type EquipmentIconName =
  | "baking-sheet"
  | "blender"
  | "bowl"
  | "cake-pan"
  | "cooking-pot"
  | "dish"
  | "fork"
  | "glass"
  | "knife"
  | "loaf-pan"
  | "mixer"
  | "muffin-pan"
  | "pan"
  | "plate"
  | "pot"
  | "rolling-pin"
  | "salad-bowl"
  | "spatula"
  | "utensils";

type HugeiconsEquipmentIconName = Exclude<
  EquipmentIconName,
  "baking-sheet" | "loaf-pan"
>;

const equipmentIcons: Record<HugeiconsEquipmentIconName, IconSvgElement> = {
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
  pan: Pan01Icon,
  plate: PlateIcon,
  pot: Pot01Icon,
  "rolling-pin": RollingPinIcon,
  "salad-bowl": SaladIcon,
  spatula: SpatulaIcon,
  utensils: KitchenUtensilsIcon,
};

// “Bread Pan” by Joost, from Noun Project, licensed under CC BY 3.0.
// Source: https://thenounproject.com/icon/bread-pan-1646973/
const loafPanMask =
  "data:image/png;base64,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";

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
    icon: "loaf-pan",
    pattern: /\b(moules? a cake|loaf pans?)\b/,
  },
  {
    icon: "muffin-pan",
    pattern:
      /\b(empreintes? a muffins?|muffin cups?|mini[- ]cakes?|mini[- ]loaves?|mini[- ]loaf)\b/,
  },
  {
    icon: "baking-sheet",
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
  const iconName = resolveEquipmentIcon(label);

  if (iconName === "baking-sheet") {
    return (
      // “Oven Tray” from SVG Repo, licensed under CC0.
      // Source: https://www.svgrepo.com/svg/474630/oven-tray
      <svg
        viewBox="0 0 48 48"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
        aria-hidden="true"
        focusable="false"
        data-equipment-icon
      >
        <rect width="40" height="32" x="4" y="8" rx="2" />
        <path d="M4 16h40M4 24h40M4 32h40" />
      </svg>
    );
  }

  if (iconName === "loaf-pan") {
    return (
      <span
        className="block size-[22px] bg-primary"
        style={{
          maskImage: `url("${loafPanMask}")`,
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskImage: `url("${loafPanMask}")`,
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
        }}
        aria-hidden="true"
        data-equipment-icon
      />
    );
  }

  return (
    <HugeiconsIcon
      icon={equipmentIcons[iconName]}
      size={22}
      strokeWidth={1.8}
      className="text-primary"
      aria-hidden="true"
      focusable="false"
      data-equipment-icon
    />
  );
}
