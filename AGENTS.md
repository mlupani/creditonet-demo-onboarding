# Crédito Net — demo de onboarding

Demo navegable de Crédito Net (onboarding, bandejas, producto, organismo, plan de cuotas, motor de riesgo). Los datos son de ejemplo y viven en el front; no hay backend.

## Cómo trabajar

- Stack: Next.js (App Router), React y TypeScript.
- Desarrollo: `npm run dev` y abrir http://localhost:3000.
- Antes de abrir un PR: `npm run lint`, `npm test` y `npm run build`.
- Los cambios entran por pull request contra `main`.
- La documentación funcional de los módulos está en `docs/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
