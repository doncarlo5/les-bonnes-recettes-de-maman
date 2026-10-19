import { z } from "zod";
const optionalUrl = z.url().max(2_048);

export const openverseCreditSchema = z.strictObject({
  title: z.string().max(1_000),
  creator: z.string().max(1_000),
  creatorUrl: optionalUrl,
  imageUrl: optionalUrl,
  landingUrl: optionalUrl,
  license: z.string().max(1_000),
  licenseVersion: z.string().max(1_000),
  licenseUrl: optionalUrl,
  source: z.string().max(1_000),
  attribution: z.string().max(1_000),
  alt: z.string().max(1_000),
});

export const openverseImageCreditSchema = openverseCreditSchema.extend({
  provider: z.literal("openverse"),
});

export const recipeImageCreditSchema = z.discriminatedUnion("provider", [
  z.strictObject({
    provider: z.literal("unsplash"),
    photographerName: z.string(),
    photographerUrl: z.string(),
    photoUrl: z.string(),
    alt: z.string(),
  }),
  openverseImageCreditSchema,
]);

