# Engineering Guidelines

> Static reference. Extracted from the pre-refactor monolithic `AGENTS.md`.
> Covers: Documentation Policy, TypeScript, React Patterns, Styling, Design Tokens,
> Responsive Breakpoints, Title Display/Sorting, Forum Description Copy.

## Documentation Policy

**NO scattered MD files in project root!** Documentation belongs in one of three places:

1. **`AGENTS.md`** (root) — Dynamic handover orchestrator only: active status, live Kanban board,
   handover protocol, and reverse-chronological handover log. No static reference content.
2. **`docs/context/*.md`** — Static project reference: architecture, structure, data reference,
   engineering guidelines, UI patterns, category playbooks, scraper operations, plus handover/task
   archives.
3. **Spec folders** (`.kiro/specs/{feature}/`) — Feature-specific living documentation.

**Rules:**

- DO NOT create standalone MD files in project root (except `README.md` and `AGENTS.md`)
- Static/durable knowledge goes in `docs/context/`; volatile task state goes in `AGENTS.md`
- Temporary debug/test notes should be deleted after use
- Feature documentation goes in `.kiro/specs/{feature}/STATUS.md` as a living document
- Keep it contained, clearly sectioned, and easy to navigate

**Why:** Scattered MD files create clutter and make it hard to find information. Separating static
reference from dynamic task state keeps the orchestrator small enough to load every session while
preserving full project context on demand.

## TypeScript

- Strict mode enabled
- No `any` types (use `unknown` if truly needed)
- Prefer interfaces over types for object shapes
- Export types from dedicated type files

## React Patterns

- Functional components only
- Custom hooks for shared logic (prefix with `use`)
- React.lazy for page-level code splitting
- Props interfaces defined above component

## Testing

- `npm test` runs Node's built-in test runner through `tsx`; no separate framework dependency is
  required.
- `npm run test:ui:smoke` runs representative route, responsive-overflow, and reduced-motion checks
  in Chromium. `npm run test:ui` adds broader browser behavior and structural performance budgets.
  Both use the existing Playwright library with Node's test runner rather than a second UI framework.
- Prefer tests around public behavior and stable boundaries: filtering semantics, display
  normalization, related-item matching, data loaders, URL/state helpers, and shared UI contracts that
  can be exercised without brittle DOM assertions.
- Do not chase arbitrary coverage percentages or add tests for every private helper. Test private
  implementation details only when that detail is the safest boundary for a real user-facing rule.
- Add a narrow regression test when fixing a bug in a shared utility, scraper output normalizer, or
  filter/data-loading path.

### Test Cadence

- During iteration, run the narrowest useful check: one focused test file, one affected validator, a
  targeted typecheck, or a small smoke path.
- Before committing or pushing substantial UI/public-behavior changes, run `npm test`,
  `npm run test:ui`, `npm run build`, and `npm run lint`. Substantial non-UI changes retain the
  `npm test` / build / lint gate unless they affect a browser contract.
- For docs-only changes, do not run the full gate by default. Run a relevant command only when the
  docs change executable commands, release/deploy expectations, or code contracts.
- For UI layout or interaction changes, run the focused browser test while iterating and add a visual
  smoke check when the change affects navigation, responsive layout, image presentation,
  accessibility, or a critical user flow. Browser tests assert behavior and structural budgets;
  screenshots are diagnostic artifacts, not brittle pixel-perfect snapshots.
- For accessibility-sensitive work, keep deterministic browser assertions for landmarks, heading
  order, accessible names, keyboard behavior, focus, and announcement timing. Use Lighthouse as a
  representative audit at phase/release boundaries; it supplements rather than replaces the stable
  behavior tests.
- For scraper or data changes, run the affected validator and `node scripts/verify-datasets.mjs`.
  Use targeted scrapes/audits when needed; broad scrapes remain human-run.

## UI Primitives (Radix / shadcn)

- Accessibility-sensitive interactive widgets (disclosures, command menu, and future dialogs /
  popovers / tooltips) are built on headless primitives — never hand-rolled `useState` toggles when a
  primitive gives correct keyboard/focus/ARIA behavior.
- Follow the shadcn/ui pattern **without** running `shadcn init`: no `components.json`, no shadcn
  token layer, and no `clsx` / `cva` / `tailwind-merge`. Write thin token-styled wrappers in
  `src/components/shared/ui/` and style with the `@theme` tokens. `shadcn init` would collide with the
  hand-built Tailwind v4 tokens.
- Add the specific primitive package (pinned, exact version) rather than an umbrella. Current
  additions: `@radix-ui/react-collapsible` (disclosures), `@radix-ui/react-dialog` (mobile sheets),
  `@radix-ui/react-toggle-group` (segment pickers), `@radix-ui/react-tooltip` (access-pill tooltips),
  and `cmdk` (search palette).
- Scope a primitive's provider (e.g. `TooltipProvider`) close to its usage rather than at the app
  root when the primitive is only used on lazy pages — that keeps the dependency in the lazy chunk
  instead of the main bundle. Only wrap a bounded number of instances (tooltips belong on detail-page
  pills, not on every card-gallery pill).
- Keep a wrapper's public API stable so existing consumers stay drop-in.
- Only adopt a primitive when it actually models the control. A binary primitive is the wrong home
  for a genuinely tri-state control — `TriStateFilterPill` (neutral/include/exclude) stays a semantic
  `<button>` because Radix has no tri-state primitive; forcing `Toggle`/`Checkbox` would add a
  dependency and degrade the ARIA semantics.

## Styling (Tailwind CSS)

- Mobile-first: write mobile styles first, then add `sm:`, `md:`, `lg:` for larger breakpoints
- Minimum 44x44px touch targets on mobile (use `min-h-11 min-w-11` or `p-3`)
- Base font: 16px (Tailwind default)
- Max content width: 75 characters for readability
- **Use design tokens** — never hardcode colours or shadows (see token table below)

### Design Token Reference

All colours are defined in `src/index.css` as a Tailwind CSS 4 `@theme` block. Use the
corresponding utility classes:

| Token                   | Hex       | Usage                            |
| ----------------------- | --------- | -------------------------------- |
| `bg-bg-base`            | `#111315` | Page background                  |
| `bg-bg-surface`         | `#1a1a1a` | Cards, content panels            |
| `bg-bg-elevated`        | `#212529` | Navigation, overlays             |
| `bg-bg-overlay`         | `#343a40` | Hover states, chips              |
| `border-border-default` | `#343a40` | Default borders                  |
| `border-border-hover`   | `#495057` | Hover border colour              |
| `text-gold`             | `#f69a07` | Headings, active nav, accents    |
| `text-gold-bright`      | `#ffc107` | CTAs, active filter chips        |
| `text-text-primary`     | `#f8f9fa` | Body text, headings              |
| `text-text-secondary`   | `#9ca3af` | Supporting text                  |
| `text-text-muted`       | `#6c757d` | Timestamps, labels, placeholders |
| `shadow-subtle`         | —         | Cards resting state              |
| `shadow-medium`         | —         | Cards hovered state              |

## Responsive Breakpoints

- Mobile: default (< 640px)
- Tablet: `sm:` (640px+)
- Desktop: `lg:` (1024px+)

## File Naming

- Components: PascalCase (`BadgeCard.tsx`)
- Hooks: camelCase with `use` prefix (`useBadges.ts`)
- Utils: camelCase (`search.ts`)
- Data: kebab-case (`badges.json`)

## Item Title Display and Sorting

- Display item titles with leading articles in natural reading order. Forum titles like
  `Golden Egg, The` should render as `The Golden Egg`.
- Sort item titles by an article-insensitive key, so `The King's Crown` sorts under `K`, not `T`.
- Keep existing slugs and source URLs stable; this rule is presentation and ordering only unless a
  scraper explicitly needs to normalize newly generated data.

## Forum Description Copy

- Use the forum's own category and subtype descriptions for section cards, list-page headers, and
  landing-page blurbs whenever the forum provides usable text.
- Write original UI copy only when the forum has no direct description or when a combined app
  surface needs a concise blend of multiple forum descriptions.
