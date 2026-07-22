"use client";

import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";
import { RecipeLoaderAnimation } from "./recipe-loader-animation";
import styles from "./localized-loading.module.css";

export function LocalizedLoading() {
  const { dict } = useLocaleDictionary();

  return (
    <main className={styles.page}>
      <div className={styles.loader} role="status" aria-live="polite">
        <p className="sr-only">{dict.loading.page}</p>
        <RecipeLoaderAnimation />
      </div>
    </main>
  );
}
