<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

## Production-only workflow

This repository targets the Convex production deployment selected by
`CONVEX_DEPLOY_KEY` in `.env.local`. Use `npx convex deploy` for backend changes
and `npm run sync:recipe:production -- <slug>` to publish one seeded recipe.
Reserve `npm run sync:recipes:production` for an explicitly requested full
catalog sync. Do not run `npx convex dev` or create a development deployment.

<!-- convex-ai-end -->
