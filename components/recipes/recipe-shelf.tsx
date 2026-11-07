"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CakeSlice,
  Candy,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CookingPot,
  Salad,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { RecipeCategory } from "@/lib/recipe-categories";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import type { RecipeSummary } from "./types";
import styles from "./recipe-shelf.module.css";

const defaultRecipeImageUrl =
  "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1400&q=85";

/** How long the shelf must stay still before the centred book opens. */
const SETTLE_DELAY_MS = 280;
const DRAG_STEP_PX = 44;
const WHEEL_STEP_PX = 60;
const SPINE_GAP_PX = 4;
const OPEN_GAP_PX = 20;
const SLOT_EASE = [0.32, 0.72, 0, 1] as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
const FLICK_VELOCITY = 0.5; // px per ms
const EDGE_RESISTANCE = 0.3;

const toneClasses = [
  styles.tone0,
  styles.tone1,
  styles.tone2,
  styles.tone3,
  styles.tone4,
  styles.tone5,
];

const categoryIcons: Record<RecipeCategory, LucideIcon> = {
  dessert: CakeSlice,
  plat: CookingPot,
  sucre: Candy,
  sale: Salad,
};

type ShelfLayout = {
  mobile: boolean;
  pageWidth: number;
  bookHeight: number;
  openWidth: number;
};

const desktopLayout: ShelfLayout = {
  mobile: false,
  pageWidth: 256,
  bookHeight: 352,
  openWidth: 512,
};

type RecipeShelfProps = {
  locale: Locale;
  dict: Dictionary;
  recipes: RecipeSummary[];
};

export function RecipeShelf({ locale, dict, recipes }: RecipeShelfProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const layout = useShelfLayout();
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportWidth = useElementWidth(viewportRef);
  const searchParams = useSearchParams();
  const [initialSlug] = useState(() => searchParams.get("livre"));
  const [activeSlug, setActiveSlug] = useState<string | null>(initialSlug);
  const [openSlug, setOpenSlug] = useState<string | null>(initialSlug);
  // How the last move happened: keyboard moves skip the opening flourish.
  const [moveSource, setMoveSource] = useState<"initial" | "pointer" | "keyboard">("initial");
  const [dragResidual, setDragResidual] = useState<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startIndex: number;
    dragging: boolean;
    lastX: number;
    lastTime: number;
    velocity: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const wheelRef = useRef(0);

  const foundActiveIndex = recipes.findIndex((recipe) => recipe.slug === activeSlug);
  const activeIndex = foundActiveIndex === -1 ? 0 : foundActiveIndex;
  const activeRecipe = recipes[activeIndex];
  const effectiveActiveSlug = activeRecipe?.slug ?? null;
  const openIndex = recipes.findIndex((recipe) => recipe.slug === openSlug);

  // The centred book opens only once the shelf stops moving.
  useEffect(() => {
    if (effectiveActiveSlug === openSlug) return;
    const timer = window.setTimeout(
      () => setOpenSlug(effectiveActiveSlug),
      reduceMotion ? 0 : SETTLE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [effectiveActiveSlug, openSlug, reduceMotion]);

  // Keep the open book in the URL so back navigation and shared links land on it.
  useEffect(() => {
    if (!openSlug || openIndex === -1) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("livre") === openSlug) return;
    params.set("livre", openSlug);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${params.toString()}${window.location.hash}`,
    );
  }, [openIndex, openSlug]);

  // Horizontal wheel / trackpad scrolling steps through the shelf.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    function onWheel(event: WheelEvent) {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.shiftKey ? event.deltaY : 0;
      if (delta === 0) return;
      event.preventDefault();
      wheelRef.current += delta;
      const steps = Math.trunc(wheelRef.current / WHEEL_STEP_PX);
      if (steps === 0) return;
      wheelRef.current -= steps * WHEEL_STEP_PX;
      moveBy(steps);
    }
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  });

  if (!activeRecipe) return null;

  const spines = recipes.map((recipe) => getSpine(recipe, layout));
  const slotWidths = recipes.map((_, index) =>
    index === openIndex ? layout.openWidth : spines[index].width,
  );
  const gapAfter = (index: number) =>
    index === openIndex || index + 1 === openIndex ? OPEN_GAP_PX : SPINE_GAP_PX;
  let offset = 0;
  for (let index = 0; index < activeIndex; index += 1) {
    offset += slotWidths[index] + gapAfter(index);
  }
  const trackX = viewportWidth / 2 - (offset + slotWidths[activeIndex] / 2);
  const slotTransition = reduceMotion
    ? { duration: 0 }
    : moveSource === "keyboard"
      ? { duration: 0.22, ease: EASE_OUT }
      : { duration: 0.42, ease: SLOT_EASE };
  const trackTransition = viewportWidth === 0
    ? { duration: 0 }
    : dragResidual !== null
      ? { duration: 0.12, ease: EASE_OUT }
      : slotTransition;

  function select(index: number, source: "pointer" | "keyboard" = "pointer") {
    const next = recipes[Math.max(0, Math.min(recipes.length - 1, index))];
    if (!next) return;
    setMoveSource(source);
    setActiveSlug(next.slug);
  }

  function moveBy(steps: number, source: "pointer" | "keyboard" = "pointer") {
    select(activeIndex + steps, source);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const keyMoves: Record<string, () => void> = {
      ArrowLeft: () => moveBy(-1, "keyboard"),
      ArrowRight: () => moveBy(1, "keyboard"),
      Home: () => select(0, "keyboard"),
      End: () => select(recipes.length - 1, "keyboard"),
      Enter: () => router.push(`/${locale}/recettes/${activeRecipe.slug}`),
    };
    const action = keyMoves[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // A second finger must not hijack a drag already in progress.
    if (dragRef.current) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startIndex: activeIndex,
      dragging: false,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    if (!drag.dragging) {
      if (Math.abs(dx) < 8) return;
      drag.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) {
      drag.velocity = (event.clientX - drag.lastX) / elapsed;
      drag.lastX = event.clientX;
      drag.lastTime = event.timeStamp;
    }
    const wanted = drag.startIndex - Math.round(dx / DRAG_STEP_PX);
    const target = Math.max(0, Math.min(recipes.length - 1, wanted));
    // The shelf follows the finger between steps, with resistance past either end.
    const residual = dx + (target - drag.startIndex) * DRAG_STEP_PX;
    setDragResidual(wanted === target ? residual : residual * EDGE_RESISTANCE);
    if (target !== activeIndex) select(target);
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.dragging;
    dragRef.current = null;
    setDragResidual(null);
    // A quick flick carries the shelf a few books further.
    const recent = event.timeStamp - drag.lastTime < 80;
    if (drag.dragging && recent && Math.abs(drag.velocity) > FLICK_VELOCITY) {
      const extra = Math.max(-6, Math.min(6, Math.round(-drag.velocity * 4)));
      if (extra !== 0) select(activeIndex + extra);
    }
  }

  function onSpineClick(index: number) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    select(index);
  }

  const shelf = dict.recipeList.shelf;
  const position = shelf.position
    .replace("{current}", String(activeIndex + 1))
    .replace("{total}", String(recipes.length));

  return (
    <section aria-label={shelf.label} className="grid gap-4">
      <div
        ref={viewportRef}
        role="region"
        aria-roledescription={shelf.roleDescription}
        aria-label={shelf.label}
        aria-describedby="recipe-shelf-hint"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="relative -mx-4 cursor-grab touch-pan-y select-none overflow-hidden px-4 pt-6 pb-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing md:mx-0 md:rounded-3xl md:px-0"
        style={{ height: layout.bookHeight + 52 }}
      >
        <p id="recipe-shelf-hint" className="sr-only">{shelf.hint}</p>
        <p aria-live="polite" className="sr-only">
          {`${activeRecipe.title}, ${position}`}
        </p>
        <motion.ul
          className="absolute bottom-5 left-0 flex items-end"
          initial={false}
          animate={{ transform: `translateX(${trackX + (dragResidual ?? 0)}px)` }}
          transition={trackTransition}
        >
          {recipes.map((recipe, index) => (
            <motion.li
              key={recipe._id}
              initial={false}
              animate={{
                width: slotWidths[index],
                marginInlineEnd: index === recipes.length - 1 ? 0 : gapAfter(index),
              }}
              transition={slotTransition}
              className={cn(
                "relative flex shrink-0 items-end justify-center [perspective:1400px]",
                index === openIndex ? "z-10" : "z-0",
              )}
              style={{ height: layout.bookHeight }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {index === openIndex ? (
                  <OpenBook
                    key="book"
                    recipe={recipe}
                    locale={locale}
                    dict={dict}
                    layout={layout}
                    toneClass={spines[index].toneClass}
                    skipIntro={moveSource !== "pointer" || reduceMotion}
                    fadeIn={moveSource !== "initial"}
                  />
                ) : (
                  <Spine
                    key="spine"
                    recipe={recipe}
                    locale={locale}
                    spine={spines[index]}
                    isActive={index === activeIndex}
                    reduceMotion={reduceMotion}
                    onClick={() => onSpineClick(index)}
                  />
                )}
              </AnimatePresence>
            </motion.li>
          ))}
        </motion.ul>
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-x-0 bottom-2 h-3", styles.plank)}
        />
        {activeIndex !== openIndex ? (
          // Warm the cover image while the shelf settles, so it is there when the book turns.
          <span aria-hidden className="pointer-events-none absolute size-px overflow-hidden opacity-0">
            <Image
              src={activeRecipe.heroImageUrl || defaultRecipeImageUrl}
              alt=""
              fill
              sizes={layout.mobile ? "80vw" : "256px"}
            />
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label={shelf.previous}
          disabled={activeIndex === 0}
          onClick={() => moveBy(-1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="type-meta min-w-16 text-center text-muted-foreground tabular-nums">
          {position}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label={shelf.next}
          disabled={activeIndex === recipes.length - 1}
          onClick={() => moveBy(1)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </section>
  );
}

type SpineInfo = {
  width: number;
  height: number;
  toneClass: string;
};

function Spine({
  recipe,
  locale,
  spine,
  isActive,
  reduceMotion,
  onClick,
}: {
  recipe: RecipeSummary;
  locale: Locale;
  spine: SpineInfo;
  isActive: boolean;
  reduceMotion: boolean;
  onClick: () => void;
}) {
  const category = recipe.categories[0];
  const CategoryIcon = category ? categoryIcons[category] : null;

  return (
    <motion.div
      onClick={onClick}
      title={recipe.title}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -60 }}
      animate={{ opacity: 1, rotateY: 0, y: isActive ? -6 : 0 }}
      exit={reduceMotion
        ? { opacity: 0, transition: { duration: 0.12 } }
        : { rotateY: -90, y: -14, opacity: 0.6, transition: { duration: 0.16, ease: EASE_OUT } }}
      transition={reduceMotion ? { duration: 0.15 } : { duration: 0.2, ease: EASE_OUT }}
      className={cn(
        "relative flex shrink-0 cursor-pointer flex-col items-center overflow-hidden rounded-[3px] pt-6 pb-3 shadow-[0_1px_2px_oklch(0_0_0/0.25)] [transform-origin:center_bottom]",
        styles.spine,
        spine.toneClass,
      )}
      style={{ width: spine.width, height: spine.height }}
    >
      <span
        className={cn(
          "min-h-0 flex-1 font-heading text-[0.95rem] font-semibold leading-none tracking-[0.01em]",
          styles.spineTitle,
          locale !== "en" && styles.bottomToTop,
        )}
      >
        {recipe.title}
      </span>
      {CategoryIcon ? (
        <CategoryIcon aria-hidden className="mt-4 size-4 shrink-0 stroke-[1.6] opacity-80" />
      ) : null}
    </motion.div>
  );
}

function OpenBook({
  recipe,
  locale,
  dict,
  layout,
  toneClass,
  skipIntro,
  fadeIn,
}: {
  recipe: RecipeSummary;
  locale: Locale;
  dict: Dictionary;
  layout: ShelfLayout;
  toneClass: string;
  skipIntro: boolean;
  fadeIn: boolean;
}) {
  // Three beats: the book leaves the shelf, turns to its front cover, then opens.
  const [opened, setOpened] = useState(skipIntro);
  const { pageWidth, bookHeight, mobile } = layout;
  const imageUrl = recipe.heroImageUrl || defaultRecipeImageUrl;

  return (
    <motion.div
      className="absolute bottom-0 left-1/2 [transform-style:preserve-3d]"
      style={{ width: layout.openWidth, height: bookHeight, marginLeft: -layout.openWidth / 2 }}
      initial={skipIntro
        ? fadeIn ? { opacity: 0 } : false
        : { rotateY: 80, y: -18, opacity: 0 }}
      animate={{
        rotateY: 0,
        y: 0,
        opacity: 1,
        x: mobile || opened ? 0 : -pageWidth / 2,
      }}
      // Leaving is quicker than arriving; the blur hides the overlap with the spine.
      exit={{
        opacity: 0,
        scale: 0.96,
        filter: "blur(2px)",
        transition: { duration: 0.15, ease: EASE_OUT },
      }}
      transition={{
        default: fadeIn ? { duration: 0.15 } : { duration: 0.24, ease: EASE_OUT },
        x: { duration: 0.4, ease: EASE_IN_OUT },
      }}
      onAnimationComplete={() => setOpened(true)}
    >
      {/* Right-hand page (or the single page on mobile). */}
      <div
        className={cn(
          "absolute top-0 bottom-0 flex flex-col overflow-hidden bg-card text-card-foreground shadow-[0_18px_40px_-20px_oklch(0_0_0/0.55)]",
          mobile ? "inset-x-0 rounded-xl" : "right-0 rounded-r-xl rounded-l-[2px]",
        )}
        style={{ width: pageWidth }}
      >
        {mobile ? (
          <span className="relative block aspect-[4/3] shrink-0 bg-muted">
            <Image src={imageUrl} alt="" fill sizes="80vw" className="object-cover" />
          </span>
        ) : null}
        <BookPreview recipe={recipe} locale={locale} dict={dict} compact={mobile} />
        {!mobile ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/12 to-transparent"
          />
        ) : null}
      </div>

      {/* Front cover, hinged on its left edge; its back is the left-hand page. */}
      <motion.div
        aria-hidden
        className="absolute top-0 bottom-0 right-0 [transform-origin:left_center] [transform-style:preserve-3d]"
        style={{ width: pageWidth }}
        initial={false}
        animate={{
          rotateY: opened ? -180 : 0,
          opacity: mobile && opened ? 0 : 1,
        }}
        transition={skipIntro
          ? { duration: 0 }
          : { duration: 0.4, ease: EASE_IN_OUT, opacity: { duration: 0.18, delay: 0.22 } }}
      >
        <div
          className={cn(
            "absolute inset-0 flex flex-col overflow-hidden rounded-r-xl rounded-l-[3px] p-3 shadow-lg",
            styles.face,
            styles.cover,
            toneClass,
          )}
        >
          <span className="relative block flex-1 overflow-hidden rounded-md bg-muted">
            <Image src={imageUrl} alt="" fill sizes="256px" className="object-cover" />
          </span>
          <span className="type-card-title mt-3 line-clamp-2 px-1 pb-1 text-center">
            {recipe.title}
          </span>
        </div>
        {!mobile ? (
          <div
            className={cn(
              "absolute inset-0 overflow-hidden rounded-l-xl rounded-r-[2px] bg-muted [transform:rotateY(180deg)]",
              styles.face,
            )}
          >
            <Image src={imageUrl} alt="" fill sizes="256px" className="object-cover" />
            <span className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/20 to-transparent" />
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

function BookPreview({
  recipe,
  locale,
  dict,
  compact,
}: {
  recipe: RecipeSummary;
  locale: Locale;
  dict: Dictionary;
  compact: boolean;
}) {
  const times = [
    recipe.prepTime ? `${dict.recipeDetail.prepTime} ${recipe.prepTime}` : null,
    recipe.cookTime ? `${dict.recipeDetail.cookTime} ${recipe.cookTime}` : null,
  ].filter((value): value is string => value !== null);
  const timeText = times.length > 0 ? times.join(" · ") : recipe.timeLabel;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "gap-2 p-4" : "gap-3 p-6 pl-7")}>
      <h3 className="line-clamp-3 font-heading text-[1.6rem] leading-[1.08] font-semibold text-balance hyphens-auto text-foreground">{recipe.title}</h3>
      <dl className="grid gap-1.5 text-sm font-semibold text-muted-foreground">
        {timeText ? (
          <div className="flex items-start gap-2">
            <dt className="sr-only">{dict.recipeList.shelf.time}</dt>
            <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 stroke-[1.8] text-primary" />
            <dd>{timeText}</dd>
          </div>
        ) : null}
        {recipe.yieldLabel ? (
          <div className="flex items-start gap-2">
            <dt className="sr-only">{dict.recipeList.shelf.yield}</dt>
            <Users aria-hidden className="mt-0.5 size-4 shrink-0 stroke-[1.8] text-primary" />
            <dd>{recipe.yieldLabel}</dd>
          </div>
        ) : null}
      </dl>
      {recipe.categories.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={dict.recipeList.categoriesLabel}>
          {recipe.categories.map((category) => (
            <li
              key={category}
              className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground"
            >
              {dict.recipeList.categories[category]}
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href={`/${locale}/recettes/${recipe.slug}`}
        className={cn(buttonVariants(), "mt-auto self-start rounded-full")}
      >
        {dict.recipeList.shelf.readRecipe}
      </Link>
    </div>
  );
}

function getSpine(recipe: RecipeSummary, layout: ShelfLayout): SpineInfo {
  const hash = hashString(recipe.slug);
  const length = recipe.stepCount ?? recipe.ingredients.length;
  const thickness = Math.min(1, Math.max(0, (length - 3) / 11));
  return {
    width: Math.round(40 + thickness * 22),
    height: layout.bookHeight - 8 - (hash % 5) * 10,
    toneClass: toneClasses[hash % toneClasses.length],
  };
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

const mobileQuery = "(max-width: 767px)";

function useShelfLayout(): ShelfLayout {
  const mobile = useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(mobileQuery);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const viewport = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    () => window.innerWidth,
    () => 1024,
  );
  if (!mobile) return desktopLayout;
  const pageWidth = Math.min(300, Math.round(viewport * 0.78));
  return { mobile, pageWidth, bookHeight: 430, openWidth: pageWidth };
}

function useElementWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
