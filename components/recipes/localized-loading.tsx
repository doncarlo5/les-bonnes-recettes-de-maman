"use client";

import { useLocaleDictionary } from "@/i18n/use-locale-dictionary";
import styles from "./localized-loading.module.css";

export function LocalizedLoading() {
  const { dict } = useLocaleDictionary();

  return (
    <main className={styles.page}>
      <div className={styles.loader} role="status" aria-live="polite">
        <p className="sr-only">{dict.loading.recipes}</p>

        <svg
          className={styles.scene}
          viewBox="0 0 480 300"
          aria-hidden="true"
        >
          <g className={styles.ingredient}>
            <path
              d="M 181 70 C 205 47, 241 39, 273 52"
              fill="none"
              pathLength="100"
            />
          </g>

          <g className={styles.pan}>
            <path
              className={styles.panBody}
              d="M 64 169 L 278 169 C 275 187, 265 202, 247 213 L 99 213 C 78 203, 66 188, 64 169 Z"
            />
            <path
              className={styles.panNeck}
              d="M 282 168 C 286 175, 286 184, 282 191"
            />
            <path
              className={styles.panHandle}
              d="M 288 174 C 333 162, 399 157, 428 172 C 439 178, 438 195, 426 200 C 394 211, 333 192, 288 184 Z"
            />
          </g>
        </svg>

        <div className={styles.progress} aria-hidden="true">
          <span className={styles.progressIndicator} />
        </div>
      </div>
    </main>
  );
}
