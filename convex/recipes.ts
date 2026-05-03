import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const coulantAuChocolat = {
  title: "Coulants au chocolat",
  slug: "coulants-au-chocolat",
  author: "Maman",
  description:
    "Des petits coulants au chocolat tout simples, à servir tièdes avec une boule de glace vanille.",
  heroImageUrl:
    "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1400&q=85",
  totalMinutes: 12,
  servings: {
    quantity: 6,
    unit: "moules",
  },
  ingredients: [
    { name: "chocolat noir", quantity: 100, unit: "g" },
    { name: "oeufs", quantity: 2 },
    { name: "farine", quantity: 25, unit: "g" },
    { name: "beurre", quantity: 50, unit: "g" },
    { name: "sucre semoule", quantity: 50, unit: "g" },
  ],
  sections: [
    {
      title: "Préparation",
      steps: [
        "Faire fondre le beurre et le chocolat pendant 2 min au micro-ondes.",
        "Mélanger les oeufs, le sucre et la farine.",
        "Verser cette préparation dans le mélange beurre-chocolat.",
        "Répartir dans les 6 moules.",
      ],
    },
    {
      title: "Cuisson",
      steps: ["Cuire 10 min à four chaud à 180 degrés."],
    },
    {
      title: "Finition",
      steps: [
        "Laisser refroidir légèrement avant de démouler.",
        "Servir tiède avec une boule de glace vanille.",
      ],
    },
  ],
  tags: ["dessert", "chocolat", "four"],
  status: "published" as const,
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("recipes")
      .withIndex("by_status_and_title", (q) => q.eq("status", "published"))
      .collect();
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", coulantAuChocolat.slug))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, coulantAuChocolat);
      return existing._id;
    }

    return await ctx.db.insert("recipes", coulantAuChocolat);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recipes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
