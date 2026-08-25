"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  createFetchRecipeMainImageTransport,
  RecipeMainImageAcquisition,
  type RecipeImageRevisionSession,
  type RecipeMainImage,
} from "./recipe-main-image-acquisition";

export function useRecipeMainImageAcquisition({
  recipe,
  revisionSession,
}: {
  recipe: RecipeMainImage | null;
  revisionSession: RecipeImageRevisionSession;
}) {
  const [acquisition] = useState(
    () =>
      new RecipeMainImageAcquisition(
        createFetchRecipeMainImageTransport(),
        recipe,
        revisionSession,
        (message) => toast.success(message),
      ),
  );

  useEffect(() => {
    acquisition.updateContext(recipe, revisionSession);
  }, [acquisition, recipe, revisionSession]);

  const state = useSyncExternalStore(
    acquisition.subscribe,
    acquisition.getSnapshot,
    acquisition.getSnapshot,
  );

  return { acquisition, state };
}
