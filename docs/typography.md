# Typography

The product uses Newsreader for its modern-heirloom editorial identity and Source Sans 3 for readable content and task-oriented interface text. Browser fonts are loaded through `next/font/google`; the matching variable TTF files in `assets/fonts` are reserved for server-rendered Open Graph images.

## Semantic roles

| Utility | Typeface and metrics | Use |
| --- | --- | --- |
| `type-display` | Newsreader, fluid 44–96px, 600, `0.98`, `-0.035em` | Public hero and recipe titles |
| `type-page-title` | Newsreader, fluid 40–72px, 600, `1.05`, `-0.02em` | Public and admin page-level titles |
| `type-section-title` | Newsreader, fluid 30–48px, 600, `1.1` | Major public editorial sections |
| `type-content-title` | Newsreader, fluid 24–36px, 600, `1.15` | Recipe content sections and sidebars |
| `type-card-title` | Newsreader, fluid 28–48px, 600, `1` | Public recipe cards and rows |
| `type-subsection-title` | Newsreader, fluid 20–24px, 600, `1.2` | Nested public recipe headings and values |
| `type-editorial-lead` | Newsreader italic, fluid 18–30px, `1.5`, `65ch` max | Short public descriptions and editorial leads |
| `type-byline` | Newsreader italic, fluid 18–24px, `1.4` | Authors, taglines, and compact editorial accents |
| `type-wordmark` | Newsreader, fluid 20–24px, 600, `1` | Site wordmark only |
| `type-body` | Source Sans 3, 16px, `1.6` | General readable copy |
| `type-body-spacious` | Source Sans 3, fluid 16–18px, `1.7` | Recipe instructions and notes |
| `type-body-sm` | Source Sans 3, 14px, `1.5` | Supporting interface copy |
| `type-panel-title` | Source Sans 3, fluid 18–24px, 800, `1.25` | Admin panels, drawers, lists, and dialogs |
| `type-label` | Source Sans 3, 12px, 700, uppercase, `0.16em` tracking | Eyebrows, compact labels, and badges |
| `type-meta` | Source Sans 3, 12px, 700, `1.4`, tabular figures | Credits, counts, revisions, and numeric metadata |
| `type-control` | Source Sans 3, 16px mobile / 14px desktop, `1.4` | Editable inputs and textareas |

Newsreader is limited to the public editorial experience and admin page titles. Admin panels, controls, drawers, dialogs, tables, and list items use Source Sans 3.

## Usage rules

- Choose heading elements from the document outline, then apply a visual role. Keep one `h1` per page and do not skip heading levels.
- Use balanced wrapping only for short editorial headings. Use pretty wrapping on short descriptions; leave long-form instructions naturally wrapped.
- Keep prose around 60–75 characters per line. `type-editorial-lead` caps its own measure; other long-form containers must provide an equivalent cap.
- Apply `tabular-nums` to changing or aligned values not already covered by `type-meta`.
- Keep editable controls at 16px below the `md` breakpoint so iOS Safari does not zoom on focus.
- Visible text must not be smaller than 12px. Target WCAG AA contrast: 4.5:1 for regular text and 3:1 for large text.
- Truncated meaningful text must expose the full value with an accessible title, tooltip, or destination.
- Use `content-link` for conventional inline links. Use `link-underline` only for the branded animated underline treatment.
- Store copy in natural case; use `type-label` when uppercase presentation is required.

## Review matrix

Review home, recipe listing, recipe detail, empty/error states, admin list, editor workspace, drawers, and forms at 360px, 390px, 430px, 768px, and 1280px. Check light and dark themes, French and English copy, long titles, 200% zoom, keyboard focus, and reduced motion.
