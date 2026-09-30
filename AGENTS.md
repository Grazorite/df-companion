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
| Completed-task history older than the live board | [`docs/context/done-task-archive.md`](./docs/context/done-task-archive.md) |

**Automation:** Kanban and log upkeep are enforced by
[`.kiro/skills/project-tracker/SKILL.md`](./.kiro/skills/project-tracker/SKILL.md).

---

## 📊 Active Project Status

**Last updated:** 2026-09-30
**Branch:** `main` · **Deploy:** Vercel auto-deploy on `main` — pushing to `main` ships to production

> Read the live HEAD with `git log --oneline -1` rather than trusting a SHA pinned here; commits that
> only sync this file would otherwise invalidate their own status line.
**Build gate:** `npm run build` = `npm run validate && tsc -b && vite build`

### Milestone: M5 — Content Breadth (in progress)

| Metric | Value |
| -------- | ------- |
| Shipped content sections | 6 of 10 |
| Total dataset entries | 7,092 (sum of the six `src/data/*-manifest.json` totals) |
| Badges | 161 |
| Pets / Guests | 304 (221 pets · 83 guests) |
| Accessories | 2,520 across 8 subtypes |
| Weapons | 3,286 across 4 subtypes / 11 shards |
| Housing | 623 across 7 subtypes |
| Classes / Abilities | 198 across 2 subtypes (144 Classes + 54 Consumables; Armors + Regular + Miscellaneous all complete) |

### Current Focus

1. **All planned scraper full passes are complete.** Pets, guests, accessories, Classes / Abilities,
   and now Weapons have all had their user-run full passes; no stale-dataset backlog remains.
2. **Choose the next content section.** Locations & Quests is the first unblocked section in the
   board.

### Agent Assignments

| Agent / Role | Owns | Current assignment |
| -------------- | ------ | -------------------- |
| `orchestrator` (primary session agent) | AGENTS.md upkeep, task sequencing, handover | Keep Kanban + log current every task completion |
| `context-gatherer` (sub-agent) | Codebase investigation before edits | Dispatch before touching unfamiliar scraper/UI paths |
| `scraper-owner` (role) | `scripts/**`, dataset JSON, validators | Full-category re-scrape backlog |
| `ui-owner` (role) | `src/components/**`, `src/pages/**`, `src/hooks/**` | Preserve the completed UI/UX fluidity contracts when extending shipped sections |
| `human` (user) | **All broad/full scrapes**, forum cookie, deploy approval | Run full-category scrapes locally |

> Broad scrapes are human-run **by rule, not by convention**: the agent supplies the exact command,
> prerequisites, and expected output files, then stops and waits. See
> `docs/context/scraper_operations.md`.

---

## 📋 Live Kanban Board

### 🔜 To Do

- [ ] **Ship Locations & Quests section** (`/locations`) — forum category: Locations / Quests / Events / Shops
- [ ] **Ship Monsters section** (`/monsters`)
- [ ] **Ship NPCs section** (`/npcs`)
- [ ] **Ship Stackable Items section** (`/items`)
- [ ] **Audit mixed progression labels across all family-capable datasets** — find Roman/numeric +
      named-sibling mixes, spot-check with user before any broad auto-split

### 🚧 In Progress

_None._

### ✅ Done

_Latest five only. Older completed-task history lives in
[`docs/context/done-task-archive.md`](./docs/context/done-task-archive.md). Rotate at session
close, not after each individual task._

- [x] **Full weapons re-scrape** (user-run) — user ran the full pass; the regenerated dataset was
      byte-identical to what already shipped (no working-tree diff). Validated at 3,286 entries across
      4 subtypes / 11 files, cross-dataset invariants pass. Closes the last outstanding full-pass item.
- [x] **Complete the test-driven UI/UX fluidity program** — all eight phases (0–7) are implemented
      and verified: bounded galleries, navigation continuity, mobile controls, motion, stable media,
      compact global search, recoverable failure states, and the accessibility finish.
- [x] **Class access flag merge repair** — verified the pending `dataLoaders.ts` change that
      preserves DA/DC/DM and special-character flags when same-source Class entries are merged.
- [x] **Lean live handover policy** — shortened `AGENTS.md` to five live log entries and five live
      Done items, with older material archived under `docs/context/`.
- [x] **Complete Classes subtype scraper/data** — Armors, Regular, and Miscellaneous class parsing,
      relation indexes (artifact / armor / default-weapon), and split datasets all populated and
      validated (manifest 198 = 144 class + 54 consumable).

---

## 🔄 Zero-Instruction Handover Protocol

An incoming agent must be able to resume with **no verbal briefing**. Follow this exactly.

### On session start

1. **Read this file top to bottom.** It is the single source of current truth.
2. **Read the newest Handover Log entry** — it states what changed, what is verified, and what is
   explicitly _not_ verified.
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
4. **Verify before claiming done.** Use the smallest gate that gives real confidence:

   ```bash
   npx tsx --test tests/<focused-suite>.test.ts
   node scripts/<focused-validator>.mjs
   npx tsc --noEmit -p tsconfig.json
   ```

   Run `npm test`, `npm run build`, and `npm run lint` before committing or pushing substantial
   code/public-behavior changes. Docs-only edits usually do not need a full gate unless they change
   documented commands, code contracts, or release/handover rules.
5. **Data changes require a targeted re-scrape + inspection**, not hand-edited JSON.
6. **Visual smoke verification is available when it is worth the time.** Run
   `npx tsx scripts/screenshot.ts '/path'` against the dev server (`npm run dev` must be running) for
   UI navigation, responsive layout, image presentation, accessibility, or critical-interaction
   changes. See `docs/context/scraper_operations.md` § Visual Verification for options.

### On task completion

1. **Tick the Kanban checkbox and move the item to `✅ Done`** immediately. Do not batch this.
2. **Prepend a Handover Log entry** (newest first) using the entry template below.
3. **Update `📊 Active Project Status`** if counts, milestone, or focus changed.
4. **If a rule changed, update the matching `docs/context/` file in the same commit.**
5. **Do not rotate archives mid-session.** Multiple main tasks may complete in one session; archive
   old log entries and old Done bullets only during session close.

### On session close

1. **If `To Do` is empty, halt and ask the user for more backlog** — do not self-generate scope.
2. **If the live Handover Log exceeds 5 entries, archive the oldest entries** to
   [`docs/context/handover-log-archive.md`](./docs/context/handover-log-archive.md) until only 5
   remain here. Prepend moved entries at the top of the archive's entry list, preserving
   reverse-chronological order in both files.
3. **If the live `✅ Done` list exceeds 5 completed bullets, archive the oldest or least
   operationally relevant bullets** to
   [`docs/context/done-task-archive.md`](./docs/context/done-task-archive.md) until only 5 remain
   here.
4. Leave the tree either committed or explicitly described in the newest log entry.

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

_Newest first. Prepend new entries directly below this line. Keep only the five latest entries live; rotate older entries at session close._

> **Reading `Commit(s): uncommitted` in older entries:** it means uncommitted _at the time of writing_,
> not still uncommitted. Entries are written before the commit that carries them exists, so the marker
> goes stale the moment the work lands and was never retro-corrected. Treat `git log` as authoritative
> for what shipped when. New entries should use `the commit containing this entry` instead, which stays
> true.

### 2026-09-30 — Repo cleanup: dead Python-image pipeline docs + stray gitignore

**Agent:** orchestrator (Claude Opus 4.5) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** none (housekeeping pass, not a board item)

**Changed:**

- `docs/context/scraper_operations.md` and `docs/context/category_playbooks.md`: removed references
  to the retired Python image pipeline — `npm run images:pets` / `images:guests` / `setup:python`
  and the "Python Environment" section. Those npm scripts and their `.py`/venv helpers no longer
  exist; pet/guest images are now harvested inline by `scrape:pets` / `scrape:guests`, and A/C guest
  CharPage capture is the TS `--capture-charpages` path (`guest-character-capture.ts`). Historical
  mentions in `done-task-archive.md` were left intact as read-only history.
- `.gitignore`: removed the stray `AGENTS.md` entry. AGENTS.md is the tracked handover board; the
  ignore line was inert (tracked files win) but contradictory and risky if the file were ever
  untracked.
- Local-only cruft cleared (all gitignored, no repo impact): `.venv/` (16M, orphaned image-pipeline
  venv), `.tmp/` (35M of dated QA screenshots), `src/data/*-progress.json` (~2M scraper
  intermediates), and stray `.DS_Store` files.

**Verified:**

- Dependency audit: every `package.json` dependency is imported in `src`/`scripts`/`tests` — no
  unused packages to remove.
- `npm run validate` → all dataset validators, search-index (7,076 records, no drift), cross-dataset
  verify, and `typecheck:scripts` pass.
- `mdlint` clean on both edited docs and on `AGENTS.md`; contract checker → 0 errors.
- No live doc references to `images:pets` / `images:guests` / `setup:python` remain.

**Not verified / known gaps:**

- Docs/gitignore + local-file cleanup only; no application or scraper code changed. Full
  `npm run build` (tsc -b + vite) not re-run — `validate` and the markdown/contract gates cover the
  edited surface.

**Next agent should:**

- Begin the next content section when the user selects one; Locations & Quests is the first unblocked
  board item.

### 2026-09-30 — Full weapons re-scrape closed; UI/UX fluidity session close

**Agent:** orchestrator (Claude Opus 4.5) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** `Full weapons re-scrape` → `✅ Done`

**Changed:**

- `AGENTS.md`: recorded the user-run full weapons re-scrape as complete, moved it out of To Do into
  Done, updated Current Focus (no stale-dataset backlog remains), and performed session-close archive
  rotation — the UI/UX fluidity phases 0–3 log entry rotated to
  `docs/context/handover-log-archive.md` (live log back to 5), and the oldest Done bullet ("Introduce
  a test framework", already in the Done archive snapshot) dropped to keep the live Done list at 5.

**Verified:**

- Working tree was clean before this docs edit (`git status --porcelain` empty); the user's re-scrape
  produced no diff against the committed weapons data, so the on-disk dataset already reflects the
  full pass.
- `node scripts/validate-weapons.mjs` → 3,286 entries across 4 subtypes / 11 data files.
- `node scripts/verify-datasets.mjs` → all family-capable datasets pass cross-post-family invariants
  (accessories 2,520 · weapons 3,286 · pets/guests 304).

**Not verified / known gaps:**

- The re-scrape itself was user-run in a separate session; this entry records that its output matched
  the committed data (zero diff) and that the dataset validates, not an independent forum re-fetch.
- No application or scraper code changed this turn — docs/board only.

**Next agent should:**

- Begin the next content section when the user selects one; Locations & Quests is the first unblocked
  board item. All planned full scrapes are now complete.

### 2026-09-30 — UI fluidity phase 7 (failure states and accessibility)

**Agent:** ui-owner / orchestrator (GPT-5 Codex; audited + committed by Claude Opus 4.5) ·
**Commit(s):** `the commit containing this entry`
**Kanban moved:** `Test-driven UI/UX fluidity program` → `✅ Done`

**Changed:**

- `useDatasetResource`, `DatasetStateBoundary`, category hooks/lists, detail pages, and
  `dataLoaders.ts`: separated loading, request failure, retry, valid empty, and loaded states across
  all six shipped sections; rejected cached promises reset so retry performs a real request.
- `ResultsStatus`, `NavigationContinuity`, and page wiring: kept visible filtering immediate while
  debouncing polite announcements, and derived useful route titles from eventual page headings.
- `ElementLegend`, card/search/select focus styles, card headings, and small-label contrast: moved
  disclosure behavior to Radix Collapsible, standardized keyboard focus, repaired heading order, and
  cleared the Lighthouse findings.
- `tests/ui/reliabilityAccessibility.test.ts`, the UI/UX status spec, and `docs/context/`: recorded
  the public behavior contracts and completion evidence for Phase 7 and the full eight-phase program.
- `tests/ui/regressions.test.ts` (audit follow-up): hardened the pre-existing "mobile More menu
  manages dismissal and focus" test — the Radix focus-return assertions now poll for the async focus
  transition to settle instead of reading it in the same tick. That test is load-sensitive and flaked
  once under full-suite concurrency (240ms fast-fail); it passed in isolation. Not a Phase 7
  regression — the fix is in the test only, no app behavior changed.

**Verified:**

- Independently re-run before commit. `npm test` → 17/17. `npm run test:ui` → 39/39, confirmed stable
  across two consecutive full-suite runs after the flake hardening.
- `npm run build` → all validators, search-index drift check, cross-dataset verification, script
  typecheck, TypeScript, and Vite production build pass. `npm run lint` → clean.
  `npx tsc --noEmit -p tsconfig.json` → clean.
- Codex's transient Lighthouse accessibility audit on `/pets` → 100/100 (not re-run this session).

**Not verified / known gaps:**

- Lighthouse was run on the representative Pets route only (Codex), not every detail/list combination;
  the deterministic route audit covers landmarks, headings, titles, and accessible names on all six
  shipped lists.
- The Phase 7 application code was authored by Codex and committed on the strength of the re-run gate
  and its documented evidence, not a line-by-line review of every one of the 48 changed files.
- No scraper or dataset content changed.

**Next agent should:**

- The eight-phase UI/UX fluidity program is complete. Next board item is the user-run full weapons
  re-scrape; otherwise begin Locations & Quests only when the user selects it.

### 2026-09-30 — UI fluidity phase 6 (compact global search index)

**Agent:** ui-owner / orchestrator (Claude Opus 4.5) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** UI/UX fluidity program remains `In Progress`; current phase advanced to failure
states and accessibility finish (Phase 7)

**Changed:**

- `tests/searchIndex.test.ts` (new) + `tests/ui/commandPalette.test.ts` (new): index size/route/
  round-trip unit tests and palette behavior tests (first open fetches only the compact index; a
  result navigates to a real route; index-load failure shows retry). Written test-first.
- `src/utils/dataNormalization.ts` (new): extracted the fetch-free normalization/dedup out of
  `dataLoaders.ts` so the build-time generator and the runtime share one code path (no index drift).
  `dataLoaders.ts` now imports it.
- `src/utils/searchIndex.ts`: added `CompactSearchRecord`, `toCompactIndex`, and
  `rehydrateSearchIndex` (a shared `hitFromParts` derives `id` + tokenized `words` identically on both
  paths; `words` recomputed at load to keep the JSON small).
- `scripts/generate-search-index.ts` (new) + `npm run generate:search-index`: reads raw `src/data`,
  applies the shared normalization, runs `buildSearchIndex`, writes compact `src/data/search-index.json`.
- `scripts/validate-search-index.mjs` (new, wired into `npm run validate`): drift check (byte-compare
  vs a fresh regeneration), every route slug resolves to a real canonical/alias entry, and size stays
  within 1.5 MiB.
- `src/hooks/useGlobalSearch.ts`: now fetches + rehydrates the compact index instead of loading all
  six full section datasets; exposes `error` + `retry()`. `src/components/shared/CommandPalette.tsx`:
  distinct retry affordance on index-load failure.
- `.kiro/specs/ui-ux-fluidity/STATUS.md`, `docs/context/ui_patterns.md`, and
  `docs/context/scraper_operations.md`: documented the compact index, the drift-safe generation +
  validation, the failure/retry behavior, and the "regenerate after name/slug/subtype/dedupe changes"
  rule.

**Verified:**

- `npm test` → 17/17 (+5 index unit tests). `npm run test:ui` → 33/33 (motion, regressions, smoke,
  imageStability, commandPalette). `npx tsc --noEmit -p tsconfig.json` and `npm run typecheck:scripts`
  → clean. `npm run build` → all validators incl. the new `validate-search-index.mjs`, dataset
  verification, TypeScript, and Vite build pass (index ships as a hashed asset, ~105 KiB gzipped).
  `npm run lint` → clean.
- Generated index: 7,076 records, 897 KiB (58.4% of the 1.5 MiB budget). Counts are
  post-normalization (Housing 611 vs manifest 623; Classes 194 vs manifest 198), matching runtime.
- Visual smoke at 1440×900 and 390×844: palette shows section-grouped, article-normalized results with
  subtype sublabels, all from the compact index.

**Not verified / known gaps:**

- The no-full-dataset-on-open contract is verified in the Vite dev server after filtering Vite's
  dev-only `?import` module-graph meta-requests (URL strings, not content; build-time constants in
  prod). Not separately measured against a production `dist` server, where the guarantee is stronger.
- Prefetch-on-intent/idle was not added; the index loads on first open only, which already meets the
  acceptance criteria. Deferred as a non-blocking enhancement.

**Next agent should:**

- Begin Phase 7 (failure states + accessibility finish) test-first per
  `.kiro/specs/ui-ux-fluidity/STATUS.md`: distinguish dataset failure from a valid empty result with
  retry, keyboard-operability of critical flows, and non-spammy status announcements.

### 2026-09-29 — UI fluidity phase 5 (image loading and layout stability)

**Agent:** ui-owner / orchestrator (Claude Opus 4.5) · **Commit(s):** `214f626`
**Kanban moved:** UI/UX fluidity program remains `In Progress`; current phase advanced to compact
global search index (Phase 6)

**Changed:**

- `tests/ui/imageStability.test.ts` (new, 8 tests): primary image eager + `fetchpriority=high` +
  `decoding=async`; primary media reserves space before load (stalled-bytes probe); secondary/alt
  images stay lazy; failed expected image shows the placeholder; invisible items stay suppressed;
  mobile detail pages do not overflow; stats tables scroll internally; representative detail CLS within
  the 0.1 ceiling. Written test-first (baseline 6/8, the two new-behavior tests red).
- `src/components/shared/ItemImage.tsx`: added explicit loaded/failed state and a `priority` prop.
  Priority images load eagerly with high fetch priority and async decode, sit in a
  `data-primary-media` reserved-height wrapper, and fade in only after decode; non-priority images
  stay lazy and simply gain the decode-gated fade. Reduced-motion honored. The placeholder branch and
  `showPlaceholder` gate are unchanged.
- Detail surfaces (`PetDetail`, `HousingDetail`, `WeaponDetail`, `AccessoryDetail`, `BadgeDetailPage`,
  `ClassAbilityDetail` non-armor + armor): pass `priority` to the primary image only. Dropped the now
  redundant `img-fade` from BadgeDetailPage's custom className; `img-fade` now remains only on the
  command palette and tooltip.
- `.kiro/specs/ui-ux-fluidity/STATUS.md`: Phase 5 marked complete with observed results; current phase
  set to 6.

**Verified:**

- `npm test` → 12/12. `npm run test:ui` → 30/30 (motion + regressions + smoke + imageStability).
  `npx tsc --noEmit -p tsconfig.json` → clean. `npm run build` → all validators, dataset verification,
  script typecheck, TypeScript, and Vite production build pass. `npm run lint` → clean.
- Visual smoke at 1440×900 and 390×844 (pet detail desktop + mobile, weapon detail mobile): primary
  image renders in its reserved bordered box with no layout jump; toggles/selectors/tables intact; no
  overflow.

**Not verified / known gaps:**

- Reserved media height is a fixed `min-height`, not a per-image intrinsic aspect box (source images
  have no known dimensions); this removes the growth shift but does not reserve exact aspect.
- CLS asserted on one representative pet detail within the 0.1 ceiling; sub-0.05 target met there but
  not measured per-category across every detail surface.
- No data or scraper behavior changed.

**Next agent should:**

- Begin Phase 6 (compact global search index) test-first per `.kiro/specs/ui-ux-fluidity/STATUS.md`:
  generate/validate a compact search-index JSON, load full datasets only after navigating to a result,
  and keep the first palette open from requesting full category data.

### 2026-09-29 — UI fluidity phase 4 (motion system and interaction polish)

**Agent:** ui-owner / orchestrator (Claude Opus 4.5) · **Commit(s):** `38d502e`
**Kanban moved:** UI/UX fluidity program remains `In Progress`; current phase advanced to image
loading and layout stability (Phase 5)

**Changed:**

- `tests/ui/motion.test.ts` (new, 6 tests): reduced-motion removal, pathname-once page entry,
  query-only stability (tagged-probe proves `main` is not remounted), rapid-filter settling, and
  Back-to-top reachability. Written test-first; they encode the Phase 4 behavior contract as a
  regression guard.
- `src/index.css`: shared motion tokens (`--ease-standard` / `--ease-in`; durations
  instant/fast/control/panel/entry); page entry uses the entry token; added a capped `cardReveal`
  keyframe and a `back-to-top` data-attribute transition; the `prefers-reduced-motion` block now also
  zeroes `animation-delay`.
- Property-specific transitions replace all `transition-all` in `src/` (now 0): six card components,
  HomePage + Accessories landing cards, `LevelSelector`, BadgesPage subcategory pill, desktop nav link.
- Restrained feedback: card `active:scale-[0.99]` press and chevron `group-hover:translate-x-0.5`,
  each `motion-reduce`-guarded.
- `src/components/shared/ProgressiveCardGrid.tsx`: capped first-batch reveal (only the initial
  base-size batch is tagged `data-reveal`; appended/restored windows are never animated) and a new
  `pending` prop (`aria-busy` + subtle `opacity-60`). Threaded `pending` through all six `*List`
  components and their pages, derived from `inputValue !== deferredQuery`.
- `src/components/shared/BackToTop.tsx`: stays mounted; animates via `data-motion`/`data-visible`
  with `aria-hidden`/`tabIndex` gating instead of conditional unmount.
- `.kiro/specs/ui-ux-fluidity/STATUS.md`: Phase 4 marked complete with observed results; current phase
  set to 5.

**Verified:**

- `npm test` → 12/12. `npm run test:ui` → 22/22 (stable across four full-suite runs + three isolated
  regression runs). `npx tsc --noEmit -p tsconfig.json` → clean. `npm run build` → all validators,
  dataset verification, script typecheck, TypeScript, and Vite production build pass. `npm run lint`
  → clean.
- Visual smoke at 1440×900 and 390×844 (pets/weapons galleries, pet detail, mobile pets/weapons): no
  clipping, overlap, or hierarchy regressions.

**Not verified / known gaps:**

- **Dialog entry motion was evaluated and deliberately not shipped.** A content animation and an
  overlay-only fade each intermittently raced with Radix's synchronous close/focus-return under
  full-suite load (the pre-existing mobile More-menu dismissal test flaked ~1 run in 3, deterministic
  in isolation, never flaked at baseline). Per Phase 4's "motion never required for correctness", all
  dialog motion was removed; dialogs open/close instantly. Revisit only with forceMount + presence
  handling that provably preserves focus return and Escape/outside-click dismissal (rationale in an
  `src/index.css` comment).
- No data or scraper behavior changed. Nothing committed this session (no commit requested); the
  working tree holds the Phase 4 changes.

**Next agent should:**

- Begin Phase 5 (image loading and layout stability) test-first per `.kiro/specs/ui-ux-fluidity/STATUS.md`:
  `ItemImage` loading/loaded/failed states, reserved media space, and representative detail CLS budget.
