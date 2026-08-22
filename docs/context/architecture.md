# Architecture & Platform Reference

> Static reference. Extracted from the pre-refactor monolithic `AGENTS.md`.
> Covers: Project Overview, Architecture, Tech Stack, Deployment, Constraints, Performance Targets.

## Project Overview

A mobile-first React web application that serves as a companion for the Artix Entertainment game DragonFable. It aggregates game information (badges, quests, locations, etc.) from scattered forum threads into a unified, searchable interface.

**Current Status**: Static-site companion with active Badges, Pets/Guests, Accessories, Weapons, and Housing sections.

## Architecture

### Static-First Approach (MVP)

```text
User → Static Site (Vercel/Netlify CDN) → Lazy-loaded JSON Assets
```

- No backend server or database
- Forum-scraped JSON datasets stored in the repository
- Large content datasets emitted as JSON assets and loaded lazily at runtime
- Client-side search and filtering (in-memory after dataset load)
- Content updates via git commits → auto-deploy

### Future Architecture (Post-MVP)

```text
User → Static Site → REST API (Express) → PostgreSQL
```

Will be adopted when we need: user accounts, community contributions, admin panel, or dataset grows beyond what's comfortable as static JSON.

## Tech Stack

| Layer | Technology | Version |
| ------- | ----------- | --------- |
| Framework | React | 18+ |
| Language | TypeScript | 5+ |
| Build | Vite | Latest |
| Styling | Tailwind CSS | 4 |
| Routing | React Router | v6 |
| Icons | Lucide React | Latest |
| Hosting | Vercel or Netlify | - |
| Linting | ESLint | Latest |
| Formatting | Prettier | Latest |

## Deployment

- **Platform**: Vercel or Netlify (static site)
- **Trigger**: Auto-deploy on push to `main` branch
- **Preview**: PR previews for testing changes
- **Domain**: TBD

Build pipeline: `npm run build` runs `npm run validate && tsc -b && vite build`. A dataset
validation or script typecheck failure fails the deploy, so validators must pass locally before
pushing.

## Constraints and Decisions

| Decision | Rationale |
| ---------- | ----------- |
| Static site (no backend) | Zero infrastructure cost, instant deploys, simple to maintain for solo developer |
| JSON data in repo | Version controlled, no database to manage, easy to edit, validated at build time |
| Client-side search | Lazy-loaded JSON assets keep the initial app shell small while in-memory search remains fast once a section dataset is loaded |
| Mobile-first | Players likely use companion during gameplay (phone beside computer) |
| Forum hotlinks first | Provides value immediately without needing to reproduce all forum content |
| Tailwind CSS | Rapid responsive development, consistent design tokens, small bundle |
| No testing framework yet | Added when complexity warrants it; manual QA sufficient for MVP static site |

## Performance Targets

- Initial load: < 2 seconds on 3G
- Search response: < 50ms (client-side)
- Total bundle (incl. data): < 500KB gzipped
- Lighthouse: 90+ performance, 90+ accessibility

**Current loading strategy note:** large forum datasets are emitted as JSON assets and fetched lazily rather than bundled into the main JavaScript payload. This keeps the primary app chunk small while preserving the static-site deployment model.
