# WTN Insights

WTN Insights is a Next.js App Router application for World Tennis Number ratings, match history and analytics.

## Requirements

- Node.js `>=22.13.0`
- npm

## Local development

1. Copy `.env.example` to `.env.local` if you need to override the WTN endpoint.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

## Vercel deployment

Import the repository into Vercel as a standard Next.js project. Do not configure a custom output directory: `npm run build` runs `next build` and creates the required `.next` directory automatically.

The application works without required secrets. The optional server-only environment variable below can be configured in Vercel's **Project Settings → Environment Variables** for Preview and Production deployments:

| Variable | Required | Purpose |
| --- | --- | --- |
| `WTN_GRAPHQL_ENDPOINT` | No | Overrides the default public WTN GraphQL endpoint used by `/api/wtn`. Use a complete HTTPS URL. |

`WTN_GRAPHQL_ENDPOINT` is intentionally not prefixed with `NEXT_PUBLIC_`; it remains available only to the route handler. If it is unset, the built-in public WTN endpoint is used.

## Commands

- `npm run dev` — start the standard Next.js development server.
- `npm run build` — create the Vercel-compatible `.next` production artifact.
- `npm run start` — serve the built Next.js production artifact.
- `npm run lint` — lint the project.
- `npm run test:unit` — run unit and UI regression tests.
- `npm test` — run unit tests, build the production artifact, and smoke-test the production routes.

## Routes

- `/` — Overview
- `/matches` — Match history
- `/analytics` — Analytics
- `/api/wtn?tennisId=DEMO` — example-data response from the server-side WTN route

The UI, court themes, player loading, analytics, charts and API normalization are unchanged by the deployment migration.
