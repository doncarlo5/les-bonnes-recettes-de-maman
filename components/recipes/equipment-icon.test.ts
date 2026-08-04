import { describe, expect, it } from "vitest";
import {
  normalizeEquipmentLabel,
  resolveEquipmentIcon,
} from "./equipment-icon";

describe("normalizeEquipmentLabel", () => {
  it("normalizes quantities, casing, accents and spacing", () => {
    expect(normalizeEquipmentLabel("  12   POÊLES  ")).toBe("poeles");
    expect(normalizeEquipmentLabel("1 rouleau à pâtisserie")).toBe(
      "rouleau a patisserie",
    );
    expect(normalizeEquipmentLabel("1/2 bol")).toBe("bol");
    expect(normalizeEquipmentLabel("2× poêles")).toBe("poeles");
    expect(normalizeEquipmentLabel("2 x frying pans")).toBe("frying pans");
    expect(normalizeEquipmentLabel("1 1/2 bols")).toBe("bols");
  });
});

describe("resolveEquipmentIcon", () => {
  it.each([
    ["1 rouleau à pâtisserie", "rolling-pin"],
    ["1 rolling pin", "rolling-pin"],
    ["1 maryse", "spatula"],
    ["1 silicone spatula", "spatula"],
    ["1 batteur électrique", "mixer"],
    ["1 electric mixer", "mixer"],
    ["1 mixeur", "blender"],
    ["1 blender", "blender"],
    ["1 poêle", "pan"],
    ["1 frying pan", "pan"],
    ["1 cocotte-minute", "pot"],
    ["1 pressure cooker", "pot"],
    ["1 saucier SEB", "pot"],
    ["6 petites cocottes", "dish"],
    ["6 small cocottes", "dish"],
    ["1 grande casserole", "cooking-pot"],
    ["1 large saucepan", "cooking-pot"],
    ["1 couteau à longue lame", "knife"],
    ["1 long-bladed knife", "knife"],
    ["fourchette", "fork"],
    ["fork", "fork"],
    ["1 verre", "glass"],
    ["1 glass", "glass"],
    ["1 saladier", "salad-bowl"],
    ["1 salad bowl", "salad-bowl"],
    ["1 petit bol", "bowl"],
    ["1 small bowl", "bowl"],
    ["5 empreintes à muffins", "muffin-pan"],
    ["5 muffin cups", "muffin-pan"],
    ["1 plaque de cuisson", "oven"],
    ["1 baking sheet", "oven"],
    ["1 plat de service", "plate"],
    ["1 serving dish", "plate"],
    ["1 plat pour bain-marie", "dish"],
    ["1 roasting dish for the water bath", "dish"],
    ["1 moule en couronne", "cake-pan"],
    ["1 ring mold", "cake-pan"],
  ] as const)("maps %s to %s", (label, icon) => {
    expect(resolveEquipmentIcon(label)).toBe(icon);
  });

  it("uses the first specific match for a compound label", () => {
    expect(
      resolveEquipmentIcon("1 plat à gratin ou 1 moule de 24 cm"),
    ).toBe("dish");
    expect(
      resolveEquipmentIcon("1 baking dish or 1 24 cm round pan"),
    ).toBe("dish");
  });

  it.each([
    ["2 rouleaux à pâtisserie", "rolling-pin"],
    ["2 spatulas", "spatula"],
    ["2 batteurs électriques", "mixer"],
    ["2 blenders", "blender"],
    ["12 POÊLES", "pan"],
    ["2 frying pans", "pan"],
    ["2 pressure cookers", "pot"],
    ["2 casseroles", "cooking-pot"],
    ["3 couteaux", "knife"],
    ["3 knives", "knife"],
    ["2 fourchettes", "fork"],
    ["2 glasses", "glass"],
    ["2 saladiers", "salad-bowl"],
    ["2 bols", "bowl"],
    ["2 baking sheets", "oven"],
    ["2 plats de service", "plate"],
    ["2 baking dishes", "dish"],
    ["2 moules", "cake-pan"],
  ] as const)("maps the plural label %s to %s", (label, icon) => {
    expect(resolveEquipmentIcon(label)).toBe(icon);
  });

  it.each([
    ["1/2 plat", "dish"],
    ["2× plats", "dish"],
    ["2 x dishes", "dish"],
  ] as const)("maps the quantified generic dish %s to %s", (label, icon) => {
    expect(resolveEquipmentIcon(label)).toBe(icon);
  });

  it.each(["papier sulfurisé", "parchment paper", "agrafeuse", "stapler"])(
    "uses the generic icon for %s",
    (label) => {
      expect(resolveEquipmentIcon(label)).toBe("utensils");
    },
  );
});
