# Engineering Guidelines

> Static reference. Extracted from the pre-refactor monolithic `AGENTS.md`.
> Covers: Documentation Policy, TypeScript, React Patterns, Styling, Design Tokens,
> Responsive Breakpoints, Title Display/Sorting, Forum Description Copy.

## Documentation Policy

**NO scattered MD files in project root!** Documentation belongs in one of three places:

1. **`AGENTS.md`** (root) — Dynamic handover orchestrator only: active status, live Kanban board,
   handover protocol, and reverse-chronological handover log. No static reference content.
2. **`docs/context/*.md`** — Static project reference: architecture, structure, data reference,
   engineering guidelines, UI patterns, category playbooks, scraper operations.
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

## Styling (Tailwind CSS)

- Mobile-first: write mobile styles first, then add `sm:`, `md:`, `lg:` for larger breakpoints
- Minimum 44x44px touch targets on mobile (use `min-h-11 min-w-11` or `p-3`)
- Base font: 16px (Tailwind default)
- Max content width: 75 characters for readability
- **Use design tokens** — never hardcode colours or shadows (see token table below)

### Design Token Reference

All colours are defined in `src/index.css` as a Tailwind CSS 4 `@theme` block. Use the
corresponding utility classes:

| Token | Hex | Usage |
| ------- | ----- | ------- |
| `bg-bg-base` | `#111315` | Page background |
| `bg-bg-surface` | `#1a1a1a` | Cards, content panels |
| `bg-bg-elevated` | `#212529` | Navigation, overlays |
| `bg-bg-overlay` | `#343a40` | Hover states, chips |
| `border-border-default` | `#343a40` | Default borders |
| `border-border-hover` | `#495057` | Hover border colour |
| `text-gold` | `#f69a07` | Headings, active nav, accents |
| `text-gold-bright` | `#ffc107` | CTAs, active filter chips |
| `text-text-primary` | `#f8f9fa` | Body text, headings |
| `text-text-secondary` | `#9ca3af` | Supporting text |
| `text-text-muted` | `#6c757d` | Timestamps, labels, placeholders |
| `shadow-subtle` | — | Cards resting state |
| `shadow-medium` | — | Cards hovered state |

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
