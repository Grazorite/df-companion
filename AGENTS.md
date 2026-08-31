# AGENTS.md — DragonFable Companion · Dynamic Handover Orchestrator

> **This file is volatile state only.** Current milestones, live task board, handover protocol, and
> session log. It is designed to be read in full at the start of every session.
>
> **All static project knowledge lives in [`docs/context/`](./docs/context/README.md).** Do not
> re-add architecture, data shapes, UI rules, or command reference here.

## Context Map — load on demand

| Need | File |
| ------ | ------ |
| Stack, hosting, perf budgets, platform decisions | [`docs/context/architecture.md`](./docs/context/architecture.md) |
| Where files live, naming rules | [`docs/context/project_structure.md`](./docs/context/project_structure.md) |
| Dataset shapes, counts, glossary, DA/DC/price/access-flag rules | [`docs/context/data_reference.md`](./docs/context/data_reference.md) |
| TypeScript / React / styling / docs conventions | [`docs/context/engineering_guidelines.md`](./docs/context/engineering_guidelines.md) |
| Cards, detail pages, images, filters, pills, stats tables | [`docs/context/ui_patterns.md`](./docs/context/ui_patterns.md) |
| Per-category consolidation, splits, special cases | [`docs/context/category_playbooks.md`](./docs/context/category_playbooks.md) |
| Scraper commands, workflows, verification, shared libs | [`docs/context/scraper_operations.md`](./docs/context/scraper_operations.md) |
| Handover log entries older than the current session | [`docs/context/handover-log-archive.md`](./docs/context/handover-log-archive.md) |

**Automation:** Kanban and log upkeep are enforced by
[`.kiro/skills/project-tracker/SKILL.md`](./.kiro/skills/project-tracker/SKILL.md).

---

## 📊 Active Project Status

**Last updated:** 2026-08-31
**Branch:** `main` · **Deploy:** Vercel auto-deploy on `main` — pushing to `main` ships to production

> Read the live HEAD with `git log --oneline -1` rather than trusting a SHA pinned here; commits that
> only sync this file would otherwise invalidate their own status line.
**Build gate:** `npm run build` = `npm run validate && tsc -b && vite build`

### Milestone: M5 — Content Breadth (in progress)

| Metric | Value |
| -------- | ------- |
| Shipped content sections | 6 of 10 |
| Total dataset entries | 7,157 (sum of the six `src/data/*-manifest.json` totals) |
| Badges | 161 |
| Pets / Guests | 304 (221 pets · 83 guests) |
| Accessories | 2,585 across 8 subtypes |
| Weapons | 3,286 across 4 subtypes / 11 shards |
| Housing | 623 across 7 subtypes |
| Classes / Abilities | 198 across 2 subtypes (Consumables + Armors + Regular/Misc populated) |

### Current Focus

1. **Propagate scraper fixes into stale datasets.** Weapons full pass is still outstanding (see
   Kanban). Pets, guests, and accessories have been completed.
2. **Complete Classes subtype for Classes / Abilities.** Consumables, Armors, and first-pass
   Regular / Miscellaneous data are populated; parser special cases and default-weapon app-route
   relations are still pending.

### Agent Assignments

| Agent / Role | Owns | Current assignment |
| -------------- | ------ | -------------------- |
| `orchestrator` (primary session agent) | AGENTS.md upkeep, task sequencing, handover | Keep Kanban + log current every task completion |
| `context-gatherer` (sub-agent) | Codebase investigation before edits | Dispatch before touching unfamiliar scraper/UI paths |
| `scraper-owner` (role) | `scripts/**`, dataset JSON, validators | Full-category re-scrape backlog |
| `ui-owner` (role) | `src/components/**`, `src/pages/**`, `src/hooks/**` | Shared-component consolidation follow-ups |
| `human` (user) | **All broad/full scrapes**, forum cookie, deploy approval | Run full-category scrapes locally |

> Broad scrapes are human-run **by rule, not by convention**: the agent supplies the exact command,
> prerequisites, and expected output files, then stops and waits. See
> `docs/context/scraper_operations.md`.

---

## 📋 Live Kanban Board

### 🔜 To Do

- [ ] **Full weapons re-scrape** — propagate base/DC variant consolidation and Method 1/2 grouping
      beyond letter `#`. `npm run scrape:weapons`.
- [ ] **Ship Locations & Quests section** (`/locations`) — forum category: Locations / Quests / Events / Shops
- [ ] **Ship Monsters section** (`/monsters`)
- [ ] **Ship NPCs section** (`/npcs`)
- [ ] **Ship Stackable Items section** (`/items`)
- [ ] **Audit mixed progression labels across all family-capable datasets** — find Roman/numeric +
      named-sibling mixes, spot-check with user before any broad auto-split
- [ ] **Introduce a test framework** — deferred by decision; revisit when complexity warrants

### 🚧 In Progress

- [ ] **Complete Classes subtype scraper/data** — Armors populated and cleaned up; Regular /
      Miscellaneous first-pass data populated, with parser special cases and Special Character audit
      still pending.

### ✅ Done

#### Content sections shipped

- [x] Badges section — `/badges`, 161 entries, 5 categories + subcategories, retired handling
- [x] Pets / Guests section — `/pets`, `/pets/:slug`, `/guests/:slug`, 304 entries
- [x] Accessories section — `/accessories`, 8 subtypes, 2,585 entries, A-L/M-Z shards for helms + capes
- [x] Weapons section — `/weapons`, 4 subtypes, 3,286 entries across 11 shards
- [x] Housing section — `/housing`, 7 subtypes, 623 entries
- [x] Classes / Abilities starter — `/classes`, Consumables + Armors populated, Regular/Misc
      first-pass data populated

#### Scrapers & data pipeline

- [x] `scrape-badges.ts` + `add_images.py` + `add_subcategories.py`
- [x] `scrape-pets.ts` + `images:pets`
- [x] `scrape-guests.ts` + `images:guests` + local A/C CharPage capture (Playwright/Ruffle)
- [x] `scrape-accessories.ts` with per-subtype strategies
- [x] `scrape-weapons.ts` with `--url/--urls` and `--special-only` refresh modes
- [x] `scrape-housing.ts` with additive-by-slug merge and `--limit` dry-run
- [x] `scrape-classes.ts` starter path for Classes / Abilities Consumables
- [x] **Full Consumables re-scrape** (2026-08-24, user-run) — populated `effectType` metadata across
      Consumables from the sorted effects page and verified 54 entries / 50 effect-type-bearing
      entries. `npm run scrape:classes -- --subtype=consumable --fresh`
- [x] **Full Armors re-scrape** (2026-08-25, user-run + targeted agent repairs) — populated 29
      cleaned class armor entries with DoomKnight, Gnomish, Shadow/Ancient, and Reforged time-class
      families consolidated. Broad scrape was user-run; follow-up agent commands were targeted.
- [x] Validators: `validate-badges/pets/accessories/weapons/housing/class-abilities.mjs`
- [x] `verify-datasets.mjs` cross-post-family invariant checks wired into `build`
- [x] Auto-regenerated manifests for every dataset write
- [x] Graceful deleted-post handling (`isPostUnavailableError`) across all scrapers
- [x] Shared scraper libs: `forum`, `printable-parser`, `also-see`, `obtain-formatting`,
      `access-flag-repair`, `family-merge-guard`, `tags`, `cross-post-family`, `data-manifests`
- [x] **Full pets re-scrape** (2026-08-24, user-run) — propagated additive family elements/traits +
      per-variant `traits` beyond the targeted entries. `npm run scrape:pets`
- [x] **Full guests re-scrape** (2026-08-24, user-run) — `npm run scrape:guests`. Was not previously a
      tracked board item; recorded here because it shipped alongside the pets pass.
- [x] **Full accessories re-scrape** (2026-08-28, user-run + targeted agent repairs) — propagated
      variant-level descriptions, DA/DC access scoping, and shared variant-label fixes across 2,585
      entries. Follow-up targeted repairs covered the Cider Mug split, pirate scarf/hat families,
      Cultist Hood, Artix's Cape, Cysero's Gas-e Tank Mark, Scarred Dravir Wings, Phoenix/Royal Doom,
      Golden Ring related inference, and Orion/Mazurek accessory family consolidation.
- [x] **Multi-variant pets detection (Sprint 5)** — `ItemFamily` emitted for all multi-level /
      multi-obtain pets. Spec: `.kiro/specs/multi-variant-items/SPRINT5_GUIDE.md`. Closed 2026-08-24
      after user confirmation; the board had been stale rather than the work incomplete.
- [x] **`Navigator's Hat` DA/DC variants confirmed correct** — the alternating per-variant DA and DC
      obtain methods are the intended shape, verified manually by the user against the forum thread on
      2026-08-24. No re-scrape was needed; the board item was stale, not the data.

#### Shared UI system

- [x] Radix Tooltip on `AccessPills` — DA/DC/DM detail-page pills now carry accessible tooltips
      (keyboard focus, Escape, `aria-describedby`) spelling out the abbreviations, replacing the
      native `title`. New `src/components/shared/ui/tooltip.tsx`; `@radix-ui/react-tooltip@1.2.16`
      added; `TooltipProvider` scoped inside the component so the dep stays in lazy detail chunks.
- [x] `SegmentToggle` rebuilt on Radix ToggleGroup (`type="multiple"`) — group semantics + roving
      tabindex keyboard nav; external API unchanged so all five call sites are drop-in.
      `TriStateFilterPill` deliberately kept a semantic button (no Radix tri-state primitive) with a
      focus-visible polish. New `src/components/shared/ui/toggle-group.tsx`;
      `@radix-ui/react-toggle-group@1.1.19` added.
- [x] Global Command palette (`cmdk`) — cross-section search opened by `Cmd/Ctrl+K`, the desktop
      sidebar button, or the mobile `More` action. Lazy-mounted (`CommandPaletteLoader`) so `cmdk`
      stays out of the main bundle; index built on first open from the cached section loaders
      (`useGlobalSearch` / `searchIndex`). Token-styled wrapper in `src/components/shared/ui/command.tsx`.
- [x] Attack/skill accordions on Radix Collapsible — `GuestAttacks` and `ExpandableImageList` now use
      the shared Radix primitive for keyboard operation, `aria-controls`/`aria-expanded`, and animated
      open/close (named groups keep nested chevrons independent).
- [x] `CollapsibleSection` rebuilt on the Radix Collapsible primitive (accessibility spike) —
      real-button trigger with keyboard operation, focus-visible ring, `aria-controls`/`aria-expanded`,
      and an animated open/close driven by `--radix-collapsible-content-height`. Same public API;
      new `src/components/shared/ui/collapsible.tsx` wrapper; `@radix-ui/react-collapsible@1.1.20`
      added. No `shadcn init` / no `components.json`.
- [x] Cross-category badge-award inline links — explicit item notes such as
      `Own this armor to obtain the Time Walker badge` now hotlink badge names inline, while Badge
      pages hotlink awarding item names inline through `badge-relations.json`.
- [x] Shared detail page width — all category detail pages, loading states, not-found states, and
      pets/guests breadcrumb strips now use `DetailPageLayout` / `max-w-5xl`.
- [x] Housing effect type parser correction — restrict Housing effect type metadata to bold/underlined
      sorted-effects headings and render compact `Effect Type:` metadata on Housing detail pages.
- [x] Housing bogus effect type cleanup — removed one-letter A-Z effect types from scraped Housing
      JSON and documented that effect-bearing items may legitimately lack an effect type.
- [x] Cross-category War tag scraper support — extended WarLoot detection/filter support to guests,
      accessories, and weapons while keeping badges/housing excluded.
- [x] Pet War tag and card pill bug batch — fixed Rush of Zardlings image data, added War as a
      pet category filter, excluded WarLoot tag art from pet main-image scraping, and restored shared
      Free card pill styling.
- [x] Housing and shared display bug batch — fixed housing effect quote rendering, Left/Right family
      consolidation, variant-scoped Housing notes, searchable sub-details, bullet indentation
      preservation, and DA/DC obtain-pill diagnosis
- [x] Item-family model (`ItemFamily` / `LevelVariant`) with additive elements + per-variant traits
- [x] Shared obtain cards (`ObtainSection`, `ObtainVariantCard`) with Method 1/2 labelling
- [x] Tri-state filter pills + data-driven filter visibility + exclusion URL params
- [x] Stale L2 filter toggle rendering fix — list pages no longer re-canonicalize every URL param
      after filter clicks; only debounced search text syncs through an effect, while filter buttons
      write their params directly.
- [x] Mobile navigation and filter layout polish — subtype selectors wrap on phone widths, and the
      bottom navigation uses a compact primary set plus a More panel for the expanding category list.
- [x] Shared related-items hook (`useRelatedItems`) for explicit / reverse / inferred Also See
- [x] Inferred Also See relaxed obtain fingerprint (location + priceType + normalized recipe)
- [x] Shared image system: `ItemImage` placeholder, `imageLabels` captions, `ExpandableImageList`
- [x] Image selector independent from variant selector on pets/guests/accessories; weapons link only
      on captioned per-variant matches
- [x] Shared `MetricStrip`, `NotesList` / `OtherInformationSection` (nested bullets, quotes, popups)
- [x] Shared access pill tones (`accessPillStyles`) + navigation `from` context for back links
- [x] Design token system in `src/index.css` `@theme`
- [x] Default-weapon parser audit — parenthetical `(… Default)` titles remain the default classifier;
      incidental lowercase/default-image/Also See mentions are not tagged. `ChickenBlade (ChickenCow
      Default)` now scrapes as one default family with `1`, `1 (DA)`, `1 (DA, DC)`, and `1 (DC)`
      variants.

#### Documentation

- [x] `docs/context/` static reference set (7 files) with source-section mapping index
- [x] `AGENTS.md` rebuilt as dynamic handover orchestrator
- [x] `.kiro/skills/project-tracker/SKILL.md` Kanban + session-close automation

---

## 🔄 Zero-Instruction Handover Protocol

An incoming agent must be able to resume with **no verbal briefing**. Follow this exactly.

### On session start

1. **Read this file top to bottom.** It is the single source of current truth.
2. **Read the newest Handover Log entry** — it states what changed, what is verified, and what is
   explicitly *not* verified.
3. **Pick the top unblocked `In Progress` item**, else the top `To Do` item. Do not invent work.
4. **Load only the context files you need** from the Context Map. Do not bulk-read `docs/context/`.
5. **Confirm the working tree is clean** (`git status --porcelain`) before starting. If dirty,
   reconcile against the newest log entry before editing.

### While working

1. **Move the item to `In Progress`** in the Kanban board before the first edit.
2. **Investigate before editing.** For unfamiliar paths, dispatch `context-gatherer` rather than
   guessing. Never propose changes to code you have not read.
3. **Respect the category playbooks.** Consolidation/split rules and hardcoded exceptions are
   deliberate; changing one requires updating `docs/context/category_playbooks.md` in the same change.
4. **Verify before claiming done.** Minimum gate:

   ```bash
   npm run typecheck:scripts && npx tsc --noEmit -p tsconfig.json
   node scripts/verify-datasets.mjs
   # plus the validator(s) for any dataset you touched
   ```

5. **Data changes require a targeted re-scrape + inspection**, not hand-edited JSON.
6. **Visual verification is available.** Run `npx tsx scripts/screenshot.ts '/path'` against the
   dev server (`npm run dev` must be running) to capture a PNG for UI spot-checks. See
   `docs/context/scraper_operations.md` § Visual Verification for options.

### On task completion

 1. **Tick the Kanban checkbox and move the item to `✅ Done`** immediately. Do not batch this.
 2. **Prepend a Handover Log entry** (newest first) using the entry template below.
 3. **Update `📊 Active Project Status`** if counts, milestone, or focus changed.
 4. **If a rule changed, update the matching `docs/context/` file in the same commit.**
 5. **Auto-archive old log entries.** If the Handover Log in this file exceeds **10 entries**, move
    the oldest entries to [`docs/context/handover-log-archive.md`](./docs/context/handover-log-archive.md)
    until only 10 remain here. Prepend the moved entries at the top of the archive file's entry list
    (below its header), preserving reverse-chronological order in both files. Do this in the same
    commit as the new log entry.

### On session close

 1. **If `To Do` is empty, halt and ask the user for more backlog** — do not self-generate scope.
 2. Leave the tree either committed or explicitly described in the newest log entry.

### Non-negotiables

- Static knowledge never goes in this file; volatile state never goes in `docs/context/`.
- No new markdown files in the repo root.
- **No agent ever runs a broad scrape.** Full or category-wide re-scrapes are handed to the user to run
  manually, with the exact command, prerequisites, and expected output files. Agents may run only
  narrowly scoped verification scrapes (`--names=` for a few entries, a single `--url=`, or a
  `--limit=` dry run). The full rule and the allowed/handover table live in
  [`docs/context/scraper_operations.md`](./docs/context/scraper_operations.md#who-may-run-a-scrape--hard-rule).
- State plainly what was verified and what was not. A command exiting 0 is not proof of correctness.

### Handover Log entry template

```markdown
### YYYY-MM-DD — <short title>

**Agent:** <role/model> · **Commit(s):** `<sha>`, or `the commit containing this entry` when the entry
is being written as part of that same commit
**Kanban moved:** <item> → <column>

**Changed:**
- <file or area>: <what and why>

**Verified:**
- <command/check> → <result>

**Not verified / known gaps:**
- <explicit gap, stale data, or deferred work>

**Next agent should:**
- <single clearest next action>
```

---

## 📝 Reverse-Chronological Handover Log

*Newest first. Prepend new entries directly below this line.*

> **Reading `Commit(s): uncommitted` in older entries:** it means uncommitted *at the time of writing*,
> not still uncommitted. Entries are written before the commit that carries them exists, so the marker
> goes stale the moment the work lands and was never retro-corrected. Treat `git log` as authoritative
> for what shipped when. New entries should use `the commit containing this entry` instead, which stays
> true.

### 2026-08-31 — Dependency vuln fix + Radix Tooltip on access pills

**Agent:** orchestrator (Claude Opus 4.8) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested dependency-audit fix + shadcn/Radix Tooltip
(Tooltip also ticked under Done → Shared UI system)

> Note: this single entry intentionally covers two small finishes from one session turn (a
> maintenance dep fix and one new primitive) rather than splitting them, to avoid rotating two long
> historical entries out of the log for low-value churn. Each finish is delineated below.

**Changed:**

- **Dependency vulns:** ran `npm audit fix` (no `--force`; semver-compatible only). `react-router-dom`
  7.18.0 → 7.18.3 (the RSC-mode CSRF advisory GHSA-qwww-vcr4-c8h2 does not apply to this static SPA —
  no RSC/server actions — but the patch is harmless), plus build-time `postcss` and `nanoid`
  patches. `npm audit` now reports 0 vulnerabilities.
- **Tooltip primitive:** `src/components/shared/ui/tooltip.tsx` — token-styled wrappers over
  `@radix-ui/react-tooltip` (`Provider` / `Root` / `Trigger` / `Content`), same no-`shadcn init`
  approach as the other `ui/` primitives.
- **AccessPills:** `src/components/shared/AccessPills.tsx` rebuilt so each DA/DC/DM pill is a Radix
  Tooltip trigger explaining the abbreviation (DA = "Requires a Dragon Amulet", DC = "Purchasable
  with Dragon Coins", DM = "Requires Defender's Medals"), replacing the non-accessible `title`.
  Gains keyboard focus, Escape-to-dismiss, and `aria-describedby`; added focus-visible rings. The
  `TooltipProvider` is scoped inside `AccessPills` so `@radix-ui/react-tooltip` stays in the lazy
  detail-page chunks, not the main bundle. `AccessPills` is detail-only, so instance count is small.
- `package.json` / `package-lock.json`: added `@radix-ui/react-tooltip@1.2.16` (exact pin, React 19
  compatible).
- `docs/context/ui_patterns.md` and `docs/context/engineering_guidelines.md`: documented the Tooltip
  primitive, the provider-scoping rule, and "don't wrap per-card gallery pills".

**Verified:**

- `npm audit` → 0 vulnerabilities.
- `npx tsc --noEmit -p tsconfig.json` and `npx tsc -b` → passed (post dep bump).
- `npm run lint` (oxlint) → passed, 0 warnings.
- `npm run validate` → passed (all datasets + verify + typecheck:scripts).
- `npx vite build` → passed. Main bundle 247.82 kB (74.34 kB gzip), unchanged; `@radix-ui/react-tooltip`
  is in the lazy `AccessPills` chunk (13.27 kB gzip), not the main bundle.
- Runtime smoke (Playwright vs `vite preview`, 5/5) on `/badges/a-a-r-g-h-mastery` → DA pill renders;
  native `title` removed; tooltip appears on keyboard focus with the "Dragon Amulet" text; trigger
  exposes `aria-describedby`; Escape dismisses. Temp smoke script removed.
- All repo markdown → `mdlint` clean.

**Not verified / known gaps:**

- The RSC advisory not applying was reasoned from usage (static SPA, `BrowserRouter`, no server
  actions), not from a runtime exploit test.
- Other native `title=` usages remain (stats-table header icons, element pills, nav "Soon" items).
  Left as-is: element/table-header tooltips would multiply instances on list/detail pages; only the
  bounded, jargon-heavy AccessPills was converted.

**Next agent should:**

- If continuing the Radix track, a Popover (e.g. for the element legend) is the next net-new
  candidate; otherwise pivot back to content sections from the To Do backlog.

### 2026-08-31 — SegmentToggle on Radix ToggleGroup

**Agent:** orchestrator (Claude Opus 4.8) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested shadcn/Radix track continuation (also ticked
under Done → Shared UI system)

**Changed:**

- `src/components/shared/ui/toggle-group.tsx`: new thin wrappers over
  `@radix-ui/react-toggle-group` (`Root` / `Item`), same token-styled, no-`shadcn init` approach as
  the other `ui/` primitives.
- `src/components/shared/SegmentToggle.tsx`: rebuilt on Radix ToggleGroup (`type="multiple"`). Radix
  supplies group semantics and roving-tabindex keyboard navigation (arrow keys between segments, one
  tab stop). External API is unchanged (`segments` + `onToggle(id)`), so all five call sites
  (Accessories, Weapons, Housing, Classes, Pets/Guests) are untouched; `onValueChange` derives the
  single toggled id. `type="multiple"` makes the root `role="toolbar"` with `aria-pressed` items.
- `src/components/shared/TriStateFilterPill.tsx`: **not** converted — it is a genuine tri-state
  control (neutral/include/exclude) and Radix has no tri-state primitive; a binary `Toggle` or a
  `Checkbox` `indeterminate` would add a dependency and misrepresent "excluded" to assistive tech. It
  stays a semantic `<button>` (already has `aria-pressed` + descriptive `aria-label`/`title`); only
  added a shared focus-visible ring for consistency.
- `package.json` / `package-lock.json`: added `@radix-ui/react-toggle-group@1.1.19` (exact pin,
  React 19 compatible).
- `docs/context/ui_patterns.md` and `docs/context/engineering_guidelines.md`: documented the
  ToggleGroup adoption and the explicit "tri-state controls stay custom" rationale.

**Verified:**

- `npx tsc --noEmit -p tsconfig.json` and `npx tsc -b` → passed.
- `npm run lint` (oxlint) → passed, 0 warnings.
- `npm run validate` → passed (all datasets + verify + typecheck:scripts).
- `npx vite build` → passed. Main bundle 247.77 kB (74.34 kB gzip), unchanged — the primitive lands
  in the lazy list-page chunks, not the main bundle.
- Runtime smoke (Playwright vs `vite preview`, 5/5) → 8 segments render on `/accessories`; clicking a
  segment updates `?type=belt`; roving tabindex is `[-1,0,-1,…]` (one tab stop); ArrowRight moves
  focus (Artifacts → Belts); items expose `aria-pressed`/`data-state`. Temp smoke script removed.
- All repo markdown → `mdlint` clean.

**Not verified / known gaps:**

- Subtype pickers are single-select by page policy but now sit in a `type="multiple"` ToggleGroup
  (`role="toolbar"`); a stricter `radiogroup` would need per-consumer single/multiple config. Deferred
  as not worth the API churn — behavior is unchanged and correct.
- No broad multi-viewport visual QA; the smoke covered the accessories segment group only.

**Next agent should:**

- If continuing the Radix track, a Tooltip or Popover primitive (net-new) is the next candidate; the
  `TriStateFilterPill` should remain custom.

### 2026-08-31 — Radix attack accordions + global Command palette

**Agent:** orchestrator (Claude Opus 4.8) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-approved follow-on to the Radix Collapsible spike (also
ticked under Done → Shared UI system)

**Changed:**

- `src/components/guests/GuestAttacks.tsx` and `src/components/shared/ExpandableImageList.tsx`: the
  attack/skill accordion and the expandable image toggle now use the shared Radix Collapsible
  primitive. Real-button triggers with keyboard operation, `aria-controls` / `aria-expanded`, and
  animated open/close; chevrons scoped with named groups (`group/attack`, `group/img`) so nested
  collapsibles do not toggle each other.
- `src/components/shared/ui/command.tsx`: new token-styled wrappers over `cmdk` (mirrors the
  shadcn/ui Command pattern; no `shadcn init`, no `components.json`, no clsx/cva).
- `src/utils/searchIndex.ts`: `buildSearchIndex` flattens all sections into hits with correct detail
  routes; `searchHits` reuses `getSearchWords` word-prefix matching and groups by section.
- `src/hooks/useGlobalSearch.ts`: builds the index lazily (module-cached) from the existing cached
  `loadXBySubtype()` loaders on first open, so initial load is untouched and list/detail caches are
  warmed rather than double-fetched.
- `src/components/shared/CommandPalette.tsx` + `CommandPaletteLoader.tsx`: global palette opened by
  `Cmd/Ctrl+K`, the desktop sidebar `Search…` button, or the mobile `More` panel action. The eager
  loader owns triggers/open-state and lazy-mounts the palette on first open, keeping `cmdk` out of the
  main bundle. Helper `openCommandPalette` lives in `src/utils/commandPalette.ts`.
- `src/components/layout/Layout.tsx` and `src/components/layout/Navigation.tsx`: mount the palette
  loader and add the two search triggers.
- `package.json` / `package-lock.json`: added `cmdk@1.1.1` (exact pin; brings a Radix Dialog
  transitively). `@radix-ui/react-collapsible@1.1.20` was already added in the prior spike.
- `docs/context/ui_patterns.md` and `docs/context/engineering_guidelines.md`: documented the shared
  `ui/` primitive approach, the attack-accordion port, and the Command palette (lazy index, matching,
  hit→route, and the prebuilt-index upgrade path).
- `docs/context/handover-log-archive.md`: fixed 6 pre-existing MD032 hard-wrap findings and 1
  LINK001 self-referential link so all repo markdown lints clean. **Deviation:** this edited
  otherwise-immutable historical archive entries; changes are whitespace/link-path only (no wording
  changed), made at the user's explicit request to fix lint.

**Verified:**

- `npx tsc --noEmit -p tsconfig.json` and `npx tsc -b` → passed.
- `npm run lint` (oxlint) → passed, 0 warnings (the initial react-refresh only-export-components
  warning was resolved by moving `openCommandPalette` to its own module).
- `npm run validate` → passed (161 badges, 221 pets, 2585 accessories, 3286 weapons, 623 housing,
  198 class-abilities; plus verify-datasets and typecheck:scripts).
- `npx vite build` → passed. Main bundle 247.68 kB (74.30 kB gzip), essentially unchanged; palette is
  a separate lazy chunk 42.42 kB (14.94 kB gzip) loaded only on first open.
- All repo markdown → `mdlint` clean (11 files).
- Runtime smoke (Playwright vs `vite preview`) → palette opens on Ctrl+K, returns results for
  "goldfish", navigates to the selected detail page; the "Stats by Level" collapsible and the attack
  accordion expose and toggle `aria-expanded`. Temp smoke script removed after use.

**Not verified / known gaps:**

- The palette's on-first-open index fetches all section datasets (~7,157 entries). Fine now and
  cache-warming, but a compact build-time search-index JSON is the scalable upgrade (noted in
  `ui_patterns.md`).
- The smoke run's only console output was external image 404s (forum/GitHub hosts), handled by the
  existing image placeholders — not app errors. No broad visual/QA pass across every route.
- Working tree still carries unrelated prior-session class-scraper changes; this entry covers only the
  Radix-accordion and Command-palette work.

**Next agent should:**

- If the palette is kept, consider the build-time search-index JSON, and evaluate the next Radix
  candidates (`SegmentToggle` / `TriStateFilterPill`, or a Tooltip/Popover primitive).

### 2026-08-31 — Radix Collapsible accessibility spike

**Agent:** orchestrator (Claude Opus 4.8) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested shadcn/Radix accessibility spike (also ticked
under Done → Shared UI system)

**Changed:**

- `src/components/shared/ui/collapsible.tsx`: new thin wrappers over the Radix Collapsible primitive
  (`Collapsible` / `CollapsibleTrigger` / `CollapsibleContent`), mirroring the shadcn/ui pattern
  without running `shadcn init`, without a `components.json`, and without clsx/cva/tailwind-merge.
- `src/components/shared/CollapsibleSection.tsx`: rebuilt on the Radix primitive. Public API is
  unchanged (`title`, `children`, `defaultOpen=true`, `className`), so it stays a drop-in for its
  three consumers (`WeaponDetail`, `AccessoryDetail`, `PetDetail` — all "Stats by Level"). The
  trigger is now a real button with keyboard operation, managed focus plus a focus-visible ring, and
  `aria-controls` / `aria-expanded` wiring; the chevron rotates on `data-state=open`.
- `src/index.css`: added `--animate-collapsible-down` / `--animate-collapsible-up` theme tokens and
  matching keyframes driven by Radix's `--radix-collapsible-content-height`, so open/close now
  animates (native `<details>` could not).
- `package.json` / `package-lock.json`: added `@radix-ui/react-collapsible@1.1.20` (exact pin, React
  19 compatible).

**Verified:**

- `npm run validate` → passed (161 badges, 221 pets, 2585 accessories, 3286 weapons, 623 housing,
  198 class-abilities; plus verify-datasets and typecheck:scripts).
- `npx tsc --noEmit -p tsconfig.json` and `npx tsc -b` → passed.
- `npm run lint` (oxlint) → passed.
- `npx vite build` → passed; `CollapsibleSection` lazy chunk is 13.60 kB (4.97 kB gzip); main bundle
  unchanged at 245.88 kB (73.86 kB gzip).

**Not verified / known gaps:**

- No automated visual/interaction test was run — the screenshot helper hangs on Vite HMR
  `networkidle`, so the animation, focus ring, and ARIA wiring were confirmed by code and build only,
  not browsed.
- This is a scoped spike on one component. Whether to extend Radix to other hand-rolled interactive
  widgets (expandable attack/skill cards, `SegmentToggle`, `TriStateFilterPill`) or add a global
  Command palette is still an open decision for the user.
- Adds a runtime dependency; if the user prefers zero new deps, the native `<details>` version in git
  history is the fallback.

**Next agent should:**

- Await the user's decision on wider Radix adoption before converting more components; if approved,
  the expandable attack/skill accordions (`GuestAttacks`) are the next-highest accessibility value.

### 2026-08-31 — Class artifact attack sets and mechanics

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested Regular/Miscellaneous class parser/UI feature

**Changed:**

- `scripts/scrape-classes.ts`: playable class fetches now carry same-thread follow-up replies and
  parse explicit `Artifact:` sections into named artifact attack sets. Artifact sections can include
  pre-skill widget mechanics and final horizontal-rule-separated artifact notes.
- `scripts/scrape-classes.ts`: class output is now split by sub-subtype, so scoped scrapes write to
  `class-armors.json`, `class-regular.json`, or `class-miscellaneous.json` instead of one shared
  class file.
- `scripts/lib/class-artifact-relations.ts`, `scripts/generate-class-artifact-relations.ts`, and
  `src/data/class-artifact-relations.json`: class artifact attack sets and artifact-side `Modifies`
  metadata now generate lightweight cross-category inline-link relations to existing Accessory
  artifacts. Appearance-only modifiers such as `Navigator's Hat` count even when the class has no
  matching artifact attack set. The relation index refreshes after Classes and Accessories scrapes.
- `scripts/scrape-classes.ts`: widget-caption blocks such as `Chaosweaver's widget displaying
  Soulthreads.` and `Ranger's widget displaying Focus.` now populate structured class mechanics
  instead of being flattened into generic notes.
- `src/types/item.ts`, `src/types/pet.ts`, and `src/types/classAbility.ts`: added shared mechanics
  blocks and guest-shaped attack-set metadata for class pages.
- `src/components/classAbilities/ClassAbilityDetail.tsx`: Regular/Miscellaneous class details now
  show a `Base` / artifact attack-set selector before attacks, render correlated Class Mechanics for
  the selected set, auto-display mechanics images centered with captions beneath, and append selected
  artifact notes to Other Information. Artifact-backed attack sets render one compact `Artifact:
  <name>` inline link above Class Mechanics / Attacks; matching mechanics block titles are hidden to
  avoid duplicating the artifact name. Armor and Consumable rendering paths remain scoped away from
  this feature.
- `src/components/classAbilities/ClassAbilityDetail.tsx`: class stats passed through the guest stats
  renderer now omit the basic `Level` / `Damage` / `Type` / `Element` strip, so Regular/Misc pages
  show only the numerical stat cards.
- `src/components/housing/HousingDetail.tsx`, `src/pages/HousingDetailPage.tsx`,
  `src/components/classAbilities/ClassAbilityDetail.tsx`, and
  `src/pages/ClassAbilityDetailPage.tsx`: Housing and Classes / Abilities detail-header pills now
  use the shared subtype-preserving filter-link behavior already used by pets/guests, accessories,
  weapons, and badges.
- `src/hooks/useClassArtifactRelations.ts` and `src/components/accessories/AccessoryDetail.tsx`:
  artifact pages can link mentioned class names inline back to the relevant Regular/Miscellaneous
  class page, including names in the artifact `Modifies` metric strip, without restoring
  cross-category Also See cards.
- `src/hooks/useWeapons.ts`: weapon inferred related-item matching now uses the shared 0.55
  name-score threshold with obtain-fingerprint evidence, allowing compact cross-subtype sibling sets
  such as `Kaaros Garada` / `Kaaros Xera` / `Kaaros Alleri` to link without hardcoding.
- `scripts/scrape-classes.ts` and `src/data/class-regular.json`: widget-caption mechanics with a
  missing captured image now fall back to the standard DF-Pedia `<ClassName>-Widget.png` filename;
  `Pirate` was targeted-refreshed and now includes `Pirate-Widget.png`.
- `scripts/scrape-classes.ts`, `src/data/class-regular.json`, and
  `src/data/class-miscellaneous.json`: targeted parser fixes for playable class follow-up posts.
  `Edd Disguise` now keeps `Complex Skills` / `Simple Skills` as variants while using the final
  support post for shared images/notes and the variant posts for attacks/variant-specific notes.
  Variant-only Also See refs are promoted to shared Also See so cross-post references remain visible.
  `Pirate` now keeps its widget mechanics and uses the
  forum's armor-set appearance links for the class image gallery instead of pistol attack frames.
  The class UI-image filter is path-aware so `githubusercontent` art is not rejected as an `icon`.
- `scripts/lib/class-default-weapon-relations.ts`,
  `scripts/generate-class-default-weapon-relations.ts`,
  `src/data/class-default-weapon-relations.json`,
  `src/hooks/useClassDefaultWeaponRelations.ts`,
  `src/components/classAbilities/ClassAbilityDetail.tsx`, and
  `src/components/weapons/WeaponDetail.tsx`: playable class `Default Weapon` forum links now become
  app-route links when a matching weapon source exists, and weapon detail pages show the reverse
  `Default Weapon For` class links.
- `scripts/lib/class-armor-relations.ts`, `scripts/generate-class-armor-relations.ts`,
  `src/data/class-armor-relations.json`, and `src/hooks/useClassArmorRelations.ts`: Armor entries now
  generate related links to the Regular class pages they equip; Miscellaneous classes remain excluded.
- `src/hooks/useClassAbilities.ts`: class Also See resolution now falls back to source-URL matching,
  so refs parsed from one subcategory can still resolve to the correct class entry.
- `scripts/lib/accessories/cross-post-family.ts`, `scripts/scrape-weapons.ts`,
  `src/data/helms-a-l.json`, and weapon shards: normalized Blast-style base-plus-parenthetical
  families so source titles like `Blast Test Dummy (Mask)` or `Charger (Lite)` display as the base
  family with `(Base)` plus the named variant.
- `src/data/class-armors.json`, `src/data/class-regular.json`, and
  `src/data/class-miscellaneous.json`: split the local class data into per-sub-subtype datasets.
  Armors, Regular, and Miscellaneous are populated.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`, and
  `docs/context/ui_patterns.md`: documented artifact attack sets, widget-based Class Mechanics, and
  the correlated mechanics/attack selector behavior.

**Verified:**

- Targeted Regular scrape for `Warrior|Mage|Rogue|DragonLord|ChaosWeaver|Ranger` → passed and
  preserved 144 class entries.
- Targeted Regular scrape for `DragonLord` after support fallback fix → passed; current class file
  preserved 91 entries (29 Armor + 62 Regular).
- Data audit → `Mage`, `Rogue`, and `Warrior` each expose `Cloak Scrap` as one artifact attack set.
- Data audit → `DragonLord` exposes four artifact attack sets: `Dragon's Patience`,
  `Dragon's Rage`, `Dragon's Bulwark`, and `Dragon's Wrath`; Bulwark/Wrath include artifact
  mechanics.
- `npm run generate:class-artifact-relations` → passed, 37 relation(s).
- Data audit → `class-artifact-relations.json` links DragonLord's four artifacts, Cloak Scrap base
  class artifact sets, Epoch artifacts, Shadowheart Bracer, Harmonized Cowbell, and Baltael's
  Aventail.
- Data audit → `Cloak Scrap` has reverse class relations for Warrior, Mage, Rogue, Ancient Shadow
  Warrior/Mage/Rogue, and Shadow Warrior/Mage/Rogue.
- Data audit → `Navigator's Hat` now links to `Pirate` from artifact-side `Modifies` metadata.
- Data audit → `Chaosweaver` and `Ranger` expose base/shared widget mechanics.
- Data audit → `Pirate` exposes a Class Mechanics image at
  `classes_abilities/Pirate-Widget.png`, and the widget caption no longer renders as a stray notes
  line.
- Targeted Miscellaneous scrape for `Edd Disguise` → passed and preserved 53 miscellaneous class
  entries; Edd is now a two-variant family with shared bottom-post image/notes, 15 Complex Skills
  attacks, 9 Simple Skills attacks, variant-specific notes, and promoted shared Also See refs.
- Targeted Regular scrape for `Pirate` → passed and preserved 62 regular class entries; Pirate now
  has the Swab/Matey/Navigator/Marauder/Voidsailor/Dread/Sunken/Naval class image gallery.
- `npm run generate:class-default-weapon-relations` → passed, 113 relation(s). Unresolved defaults:
  `Necromancer` and `Retro Necromancer` both point to `Necrostaff`, which is not currently matched in
  the weapon source index.
- `npm run generate:class-armor-relations` → passed, 33 relation(s).
- Data audit → `Kaaros Garada`, `Kaaros Xera`, and `Kaaros Alleri` all share the Bluestar Weaponry
  obtain fingerprint and now clear the related-name threshold.
- Data audit after user full Regular/Miscellaneous class scrape → no forum-wrapper boilerplate found;
  remaining attention candidate is `Epoch` (Voicecatcher / Mechanical Metronome widget captions
  without images).
- Data audit → no remaining base-plus-parenthetical family candidates surfaced across current
  entry-array datasets after excluding deliberate defaults, years, subtype codes, colors, and grouped
  parenthetical families.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 198 entries.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run validate` → passed.
- `npm run lint` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- No broad Regular/Miscellaneous class scrape was run by the agent in this relation-link batch.
- No visual screenshot pass was run after the shared detail-pill or Kaaros related-link changes.
- `Epoch` artifact widget image capture still needs targeted parser attention.

**Next agent should:**

- After the user runs the full Regular/Miscellaneous class scrapes, audit classes with artifact
  attack sets and mechanics before widening any class-specific parser exceptions.

### 2026-08-30 — Class caption and popup cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested Regular/Miscellaneous class parser cleanup

**Changed:**

- `scripts/scrape-classes.ts`: playable class image extraction now collects linked and inline image
  candidates in forum order, prioritizes explicit forum captions, combines grouped captions such as
  `Original Appearance: Male / Female`, and filters class portrait candidates by class-name URL
  family when note links include weapon/skill appearance images.
- `scripts/scrape-classes.ts`: appearance-caption lines consumed for attack images are removed from
  skill-local notes and page-level Other Information, so lines like `Original / Retro: Appearance`
  do not render twice.
- `scripts/scrape-classes.ts`: page-level note bleed guard is now line-based, fixing Master
  SoulWeaver's global Other Information where a real note contains `element:`.
- `src/utils/popupText.ts`: multiple singular `(Pop-up: ...)` snippets in one effect now render as
  one shared `Pop-ups:` quote block.
- `src/components/shared/NotesList.tsx`: indented `quote:` markers now still attach following
  top-level popup/message bullets to the same quote box, fixing Warrior `War Cry` /
  `Triple Attack` style notes.
- `src/components/guests/GuestStatsSection.tsx`: singleton visible guest-style stat category cards
  span the full detail width, covering class pages such as `VIP` where filtering leaves only
  `Offense`.
- `scripts/scrape-classes.ts`: class portrait extraction now skips only the actual attack-skill
  range while preserving final global Other Information image blocks, fixing `DOOOOOOOOM` so attack
  button/appearance art does not become the main class image.
- `src/data/classes.json`: targeted refreshes updated `Mage`, `Rogue`, `Chronomancer`, `Warrior`,
  `Master SoulWeaver`, and `DOOOOOOOOM`.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`, and
  `docs/context/ui_patterns.md`: documented forum-caption priority, consumed appearance labels,
  class attack requirements, redundant DA requirement cleanup, shared popup grouping, singleton
  stat-card width, and the user-verified low/no-attack class list.

**Verified:**

- Targeted Regular scrape for `Mage|Rogue|Chronomancer|Warrior` → passed and preserved 144 class
  entries.
- Targeted Miscellaneous scrape for `Master SoulWeaver` → passed and preserved 144 class entries.
- Targeted Miscellaneous scrape for `DOOOOOOOOM|Master SoulWeaver` → passed and preserved 144 class
  entries.
- Targeted Regular scrape for `Warrior` → passed and preserved 144 class entries.
- Data audit → `Mage` image selector is `Modern`, `Retro (Male)`, `Retro (Female)`.
- Data audit → `Rogue` image selector is `Modern`, `Retro (Male)`, `Retro (Female)`,
  `Original (Male)`, `Original (Female)`; `Wild Daggers` keeps attack image captions without
  rendering those caption lines in notes.
- Data audit → `Warrior` image selector is `Modern`, `Retro`; `Multi Strike` keeps the
  `Original / Retro` and `DragonKeeper` attack image captions without note duplication.
- Data audit → `Chronomancer` image selector is `Original`, `Reforged`; `Blade of Meanwhile`
  captions remain `Original` / `Reforged`.
- Data audit → `Master SoulWeaver` uses `MasterSoulWeaver-*` class portraits, strips redundant
  `Dragon Amulet` from obtain requirements, captures attack requirements, keeps bottom Other
  Information, and `SoulSynch` popups collapse to one `Pop-ups:` group.
- Data audit → `DOOOOOOOOM` image selector is `Male`, `Female`.
- User verification → low/no-attack class pages `Angler`, `DOOOOOOOOM`, `Kid Artix`, `Kid Raven`,
  `Shadow Hunter`, `Sleepy Hero`, `VIP`, and `Young Vilmor` are legitimately low/no-attack on the
  forum.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 198 entries.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run lint` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- No broad Regular/Miscellaneous class scrape was run by the agent. Missing-image class spot-check
  candidates from the earlier audit still need the user/agent targeted pass.

**Next agent should:**

- Continue the Regular/Miscellaneous class audit with missing-image candidates before handing off
  another broad scrape.

### 2026-08-30 — Base class parser batch one

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested Regular class parser fixes

**Changed:**

- `scripts/scrape-classes.ts`: playable class scrapes now fetch the linked reply plus the immediate
  next reply from the full thread. This lets base-class pages keep skill data from the first reply
  while taking global images and Other Information from the next reply when the forum uses that
  layout.
- `scripts/scrape-classes.ts`: class attack bounds no longer stop at skill-local `Other Information`
  headings. Textual `* * *` separators and underlined/font-size skill headings are handled as attack
  boundaries, so later attacks such as Mage `Final Blast`, Rogue `Blind` / `Final Strike`, and
  Warrior `Strength Strike` / `Wound` / `Final Blow` are not swallowed by notes.
- `scripts/scrape-classes.ts`: attack image captions now read same-line prefixes outside the anchor,
  e.g. `Original: Appearance`, `Reforged: Appearance`, and `DragonKeeper: Appearance 1 / 1.1`.
- `scripts/scrape-classes.ts`: class main image captions can read bold/font labels immediately before
  image tags, such as Mage `Modern Version` / `Retro Version` and Chronomancer `Original` /
  `Reforged`.
- `src/data/classes.json`: targeted refreshes updated `Mage`, `Rogue`, `Chronomancer`, `Warrior`,
  and `Master SoulWeaver`.
- `docs/context/category_playbooks.md` and `docs/context/scraper_operations.md`: documented the
  first-post-plus-next-post class pattern and remaining class spot-check candidates.

**Verified:**

- Targeted Regular scrape for `Mage|Rogue|Chronomancer|Warrior` → passed and preserved 144 class
  entries.
- Targeted Miscellaneous scrape for `Master SoulWeaver` → passed and preserved 144 class entries.
- Data audit → `Mage`, `Rogue`, `Chronomancer`, `Warrior`, and `Master SoulWeaver` no longer leave
  `Requirements:`, `Mana Cost:`, `Cooldown:`, `Damage Type:`, or `Element:` in page-level notes.
- Data audit → `Mage` has 15 attacks ending `Overcharge` / `Final Blast`, main image plus two
  `Retro` alternatives, and global next-post Other Information.
- Data audit → `Chronomancer` has 15 attacks, `Original` / `Reforged` class images, and
  `Blade of Meanwhile` attack images captioned `Original` / `Reforged`.
- Data audit → `Warrior` has 15 attacks, quote-box notes retained on `WarCry` and `Triple Attack`,
  and `Multi Strike` attack images captioned `Original / Retro 1`, `Original / Retro 1.1`,
  `DragonKeeper 1`, and `DragonKeeper 1.1`.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 198 entries.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run lint` → passed.

**Not verified / known gaps:**

- Remaining missing-image class spot checks: `Alexander`, `Ancient Shadow Rogue`, `Ascendant`,
  `Cryptic`, `Dread Pirate`, `Dreaming Togslayer`, `Edd Disguise`, `Icebound Revenant`,
  `Knight Lite`, `Nythera`, `Pirate`, `Riftwalker`, `Shadow Rogue`, and `Unbread`.
- Remaining low/no-attack spot checks: `Angler`, `DOOOOOOOOM`, `Kid Artix`, `Kid Raven`,
  `Shadow Hunter`, `Sleepy Hero`, `VIP`, and `Young Vilmor`.
- No screenshot pass was run in this batch.

**Next agent should:**

- Continue the class audit with missing-image and low-attack candidates, starting from the smallest
  targeted forum samples.

### 2026-08-30 — Regular/Misc class scrape audit and filter polish

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested class scrape audit and UI polish

**Changed:**

- `src/components/shared/TriStateFilterPill.tsx` and `src/pages/ClassAbilityListPage.tsx`: added a
  `segment` tri-state pill size and applied it to the Classes sub-subtype filters so `Armors`,
  `Regular`, and `Miscellaneous` match the top-level `Classes` / `Consumables` sizing while keeping
  include/exclude behavior.
- `src/utils/imageLabels.ts`: shared image display now infers obvious `Male` / `Female` captions
  from image filenames, fixing class entries such as `Angler` whose forum page exposes male/female
  main images but labels the second link generically.
- `scripts/scrape-classes.ts`: class attack parsing now recognizes underlined skill headings and
  textual `* * *` separators in addition to `<hr>` blocks. This is a general parser hardening, but
  it did not fully repair the known Mage/Rogue/Chronomancer/Warrior note bleed.
- `docs/context/ui_patterns.md`, `docs/context/category_playbooks.md`, and
  `docs/context/scraper_operations.md`: documented the class filter sizing, image-caption inference,
  and Regular/Miscellaneous spot-check list after the full scrape.
- `AGENTS.md`: updated Classes / Abilities count to 198 and total dataset count to 7,157 after the
  user's full Regular/Miscellaneous class scrape.

**Verified:**

- Data audit → Classes / Abilities manifest now reports 198 total entries: 144 class entries and 54
  consumables.
- Data audit → Regular/Miscellaneous class entries contain no forum-wrapper titles/descriptions such
  as `Logged in as: Guest`, `Printable Version`, `All Forums`, or `Forum Login`.
- Targeted Regular scrape for `Mage|Rogue|Chronomancer|Warrior|Angler|Archivist|DragonMage|DragonRogue|SnuggleBear`
  → passed and preserved 144 class entries.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.

**Not verified / known gaps:**

- `Mage`, `Rogue`, `Chronomancer`, `Warrior`, and `Master SoulWeaver` still have skill-looking text
  in Other Information after the targeted refresh. Mage still lacks its parsed main/retro images,
  second-post Other Information, and separate `Final Blast` attack.
- Missing-image class entries to spot-check first: `Alexander`, `Ancient Shadow Rogue`, `Ascendant`,
  `Cryptic`, `Dread Pirate`, `Dreaming Togslayer`, `Edd Disguise`, `Icebound Revenant`, `Knight Lite`,
  `Mage`, `Nythera`, `Pirate`, `Riftwalker`, `Shadow Rogue`, and `Unbread`.
- Low-attack special/misc entries to spot-check before treating as clean: `Angler`, `DOOOOOOOOM`,
  `Kid Artix`, `Kid Raven`, `Shadow Hunter`, `Sleepy Hero`, `VIP`, and `Young Vilmor`.
- No visual screenshot was taken in this pass; filter sizing was verified by code inspection only.

**Next agent should:**

- Implement targeted Regular/Miscellaneous class parser handling for later-post global Other
  Information and nonstandard skill separators, starting with Mage.

### 2026-08-29 — Regular/Misc class guest-style display tightening

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested targeted class UI/parser correction

**Changed:**

- `src/components/classAbilities/ClassAbilityDetail.tsx`: non-armor Classes now use the guest-style
  detail ordering: variant selector, image selector, guest stats, Rarity, obtain card, Default
  Weapon, guest-style attack accordions, Other Information, Sources, and Also See. Armor display
  remains on its existing armor metric-strip path.
- `src/components/classAbilities/ClassAbilityDetail.tsx`: Regular/Miscellaneous classes no longer
  render the generic `Effect` card; parsed class skill effects render only inside the attack
  accordions.
- `scripts/scrape-classes.ts`: playable class image extraction now excludes the attack section, so
  class main/alt images are not polluted by skill button/appearance images.
- `scripts/scrape-classes.ts`: playable class attack extraction now parses all class skills before
  the final page-level Other Information heading, keeps skill-specific Other Information on the
  relevant attack, and accepts both `<b><u>` and `<u><b>` forum heading order.
- `scripts/scrape-classes.ts`: class `Also See` refs are resolved by forum URL during normalization,
  allowing Regular/Miscellaneous cross-subcategory links such as Ancient Exosuit ↔ Bone Exoskeleton.
- `src/data/classes.json` and `src/data/class-abilities-manifest.json`: targeted samples refreshed
  for Ancient Exosuit regular plus Bone Exoskeleton and Caitiff miscellaneous; Classes / Abilities
  now has 87 entries.
- `docs/context/category_playbooks.md` and `docs/context/ui_patterns.md`: documented the guest-style
  Regular/Misc layout and the no-generic-effect-card rule for playable classes.

**Verified:**

- Targeted scrape `npm run scrape:classes -- --subtype=class --class-subcategory=regular
  --names="Ancient Exosuit" --concurrency=1` → passed.
- Targeted scrape `npm run scrape:classes -- --subtype=class --class-subcategory=miscellaneous
  --names="Bone Exoskeleton|Caitiff" --concurrency=1` → passed.
- Data audit → Ancient Exosuit regular has DC tag, no description, `August 4th, 2015` release date,
  `AncientExo.png` as main image, exactly the two requested alt image captions, 15 attacks, clean
  global Other Information, and an Also See link to `class-ability-bone-exoskeleton-miscellaneous`.
- Data audit → Bone Exoskeleton links back to `class-ability-ancient-exosuit-regular` and keeps its
  two global Other Information bullets.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 87 entries.
- Screenshot helper `npx tsx scripts/screenshot.ts '/classes/class-ability-ancient-exosuit-regular?type=class'`
  → captured the updated Ancient Exosuit regular page; visible top-of-page order matches the
  guest-style header/image selector flow.
- `npm run lint` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- No full Regular or Miscellaneous class scrape was run by the agent. Broad playable-class population
  remains pending until the user explicitly runs it.

**Next agent should:**

- Continue targeted Regular/Miscellaneous class parser samples before any broad scrape handoff.

### 2026-08-29 — Class Regular/Misc forum-wrapper cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested targeted class scraper/UI correction

**Changed:**

- `scripts/scrape-classes.ts`: class listing fetch now uses the shared Classes / Abilities A-Z thread
  URL with the forum anchors for Armors / Regular / Miscellaneous, while section parsing still scopes
  to the requested sub-subtype.
- `scripts/scrape-classes.ts`: linked class detail fetches now isolate the actual forum reply body
  using quoted or unquoted `name=<messageId>` anchors and reject forum wrapper chrome instead of
  parsing breadcrumbs / login scaffolding as item content.
- `scripts/scrape-classes.ts`: class normalization drops stale wrapper-boilerplate entries such as
  `Logged in as: Guest`, `Printable Version`, and `All Forums >>`.
- `src/data/classes.json` and `src/data/class-abilities-manifest.json`: targeted Regular and
  Miscellaneous refreshes removed the two bad wrapper rows; Classes / Abilities now has 85 entries.
- `docs/context/category_playbooks.md` and `docs/context/scraper_operations.md`: documented that
  Regular/Miscellaneous classes follow guest-style detail display, Armors remain separate, and forum
  navigation chrome is invalid class content.

**Verified:**

- Targeted scrapes for `Ancient Exosuit` regular, `Alexander` miscellaneous, and `Ancient Exosuit`
  armor → passed; Regular/Miscellaneous samples parse guest-style images/stats/attacks/default
  weapons, while the Armor sample remains armor-shaped.
- Data audit → 0 class entries containing `Logged in as`, `Printable Version`, `All Forums`,
  `Forum Login`, or similar forum wrapper text.
- `npm run typecheck:scripts` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 85 entries.
- `npm run lint` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- No full Regular or Miscellaneous class scrape was run by the agent. Broad class population remains
  pending until the user explicitly runs it.
- Default-weapon links for playable classes still preserve forum URLs; app-route inline relation work
  remains pending.

**Next agent should:**

- Continue the Regular / Miscellaneous Classes parser work with a few more targeted samples before
  handing the user any broad scrape command.
