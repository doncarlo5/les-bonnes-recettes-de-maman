/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as commentAdmin from "../commentAdmin.js";
import type * as commentMaintenance from "../commentMaintenance.js";
import type * as commentModel from "../commentModel.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as recipeCatalog_index from "../recipeCatalog/index.js";
import type * as recipeCatalog_materialization from "../recipeCatalog/materialization.js";
import type * as recipeCatalog_rawCatalog from "../recipeCatalog/rawCatalog.js";
import type * as recipeCatalog_validation from "../recipeCatalog/validation.js";
import type * as recipeDeletion from "../recipeDeletion.js";
import type * as recipeIdeaAdmin from "../recipeIdeaAdmin.js";
import type * as recipeIdeaMaintenance from "../recipeIdeaMaintenance.js";
import type * as recipeIdeas from "../recipeIdeas.js";
import type * as recipeLocales from "../recipeLocales.js";
import type * as recipeMakeUploads from "../recipeMakeUploads.js";
import type * as recipeMakes from "../recipeMakes.js";
import type * as recipeTranslations_index from "../recipeTranslations/index.js";
import type * as recipeTranslations_sync from "../recipeTranslations/sync.js";
import type * as recipes from "../recipes.js";
import type * as restoreRecipeImages from "../restoreRecipeImages.js";
import type * as sharingPosterAssets from "../sharingPosterAssets.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  commentAdmin: typeof commentAdmin;
  commentMaintenance: typeof commentMaintenance;
  commentModel: typeof commentModel;
  comments: typeof comments;
  crons: typeof crons;
  http: typeof http;
  migrations: typeof migrations;
  "recipeCatalog/index": typeof recipeCatalog_index;
  "recipeCatalog/materialization": typeof recipeCatalog_materialization;
  "recipeCatalog/rawCatalog": typeof recipeCatalog_rawCatalog;
  "recipeCatalog/validation": typeof recipeCatalog_validation;
  recipeDeletion: typeof recipeDeletion;
  recipeIdeaAdmin: typeof recipeIdeaAdmin;
  recipeIdeaMaintenance: typeof recipeIdeaMaintenance;
  recipeIdeas: typeof recipeIdeas;
  recipeLocales: typeof recipeLocales;
  recipeMakeUploads: typeof recipeMakeUploads;
  recipeMakes: typeof recipeMakes;
  "recipeTranslations/index": typeof recipeTranslations_index;
  "recipeTranslations/sync": typeof recipeTranslations_sync;
  recipes: typeof recipes;
  restoreRecipeImages: typeof restoreRecipeImages;
  sharingPosterAssets: typeof sharingPosterAssets;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
