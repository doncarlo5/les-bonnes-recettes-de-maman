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
import type * as recipeIdeaAdmin from "../recipeIdeaAdmin.js";
import type * as recipeIdeaMaintenance from "../recipeIdeaMaintenance.js";
import type * as recipeIdeas from "../recipeIdeas.js";
import type * as recipeTranslations from "../recipeTranslations.js";
import type * as recipes from "../recipes.js";

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
  recipeIdeaAdmin: typeof recipeIdeaAdmin;
  recipeIdeaMaintenance: typeof recipeIdeaMaintenance;
  recipeIdeas: typeof recipeIdeas;
  recipeTranslations: typeof recipeTranslations;
  recipes: typeof recipes;
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
