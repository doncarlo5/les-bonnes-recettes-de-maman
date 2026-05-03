"use client";

import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";
import { EmptyState } from "./empty-state";

type LocalizedEmptyStateProps = {
  variant: "globalNotFound" | "recipeNotFound";
};

export function LocalizedEmptyState({ variant }: LocalizedEmptyStateProps) {
  const { locale, dict } = useLocaleDictionary();

  if (variant === "recipeNotFound") {
    return (
      <EmptyState
        eyebrow={dict.notFound.recipeEyebrow}
        title={dict.notFound.recipeTitle}
        description={dict.notFound.recipeDescription}
        actionLabel={dict.notFound.recipeAction}
        actionHref={`/${locale}`}
      />
    );
  }

  return (
    <EmptyState
      eyebrow={dict.notFound.globalEyebrow}
      title={dict.notFound.globalTitle}
      description={dict.notFound.globalDescription}
      actionLabel={dict.notFound.globalAction}
      actionHref={`/${locale}`}
    />
  );
}
