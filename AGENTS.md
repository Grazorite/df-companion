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

**Last updated:** 2026-09-29
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

1. **Deliver the test-driven UI/UX fluidity program.** Start with the browser behavior harness and
   gallery rendering budgets, then progress through navigation continuity, mobile controls, motion,
   media stability, global search, and reliability. Working plan:
   `.kiro/specs/ui-ux-fluidity/STATUS.md`.
2. **Propagate scraper fixes into stale datasets.** Weapons full pass is still outstanding (see
   Kanban). Pets, guests, accessories, and Classes / Abilities have been completed.

### Agent Assignments

| Agent / Role | Owns | Current assignment |
| -------------- | ------ | -------------------- |
| `orchestrator` (primary session agent) | AGENTS.md upkeep, task sequencing, handover | Keep Kanban + log current every task completion |
| `context-gatherer` (sub-agent) | Codebase investigation before edits | Dispatch before touching unfamiliar scraper/UI paths |
| `scraper-owner` (role) | `scripts/**`, dataset JSON, validators | Full-category re-scrape backlog |
| `ui-owner` (role) | `src/components/**`, `src/pages/**`, `src/hooks/**` | UI/UX fluidity program, beginning with behavior tests and progressive galleries |
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

### 🚧 In Progress

- [ ] **Test-driven UI/UX fluidity program** — execute the phased delivery and verification plan in
      `.kiro/specs/ui-ux-fluidity/STATUS.md`; Phases 0–5 are verified, current phase: compact global
      search index (Phase 6).

### ✅ Done

*Latest five only. Older completed-task history lives in
[`docs/context/done-task-archive.md`](./docs/context/done-task-archive.md). Rotate at session
close, not after each individual task.*

- [x] **Class access flag merge repair** — verified the pending `dataLoaders.ts` change that
      preserves DA/DC/DM and special-character flags when same-source Class entries are merged.
- [x] **Lean live handover policy** — shortened `AGENTS.md` to five live log entries and five live
      Done items, with older material archived under `docs/context/`.
- [x] **Introduce a test framework** — lean Node test harness for public behavior and shared utility
      APIs; avoids arbitrary coverage goals.
- [x] **Complete Classes subtype scraper/data** — Armors, Regular, and Miscellaneous class parsing,
      relation indexes (artifact / armor / default-weapon), and split datasets all populated and
      validated (manifest 198 = 144 class + 54 consumable).
- [x] **Reviewed accessory singular-sibling consolidation** — promoted 20 non-artifact accessory
      groups into itemfamilies after user review: Hunter's Wrap, Soulthread Loop, Star Captain's Belt,
      Bloodstone Ring, Moonstone Ring, Ancient Ring, Ring of the Emperor, Bear Tooth Necklace, Wild
      Necklace, Thursday's Necklace, Drakonnan's Helm, Skullhelm, Gnome Wig, Goggle Wig, Eyeball
      Helm, Custom HarleQuape (2010), Astral Avenger, Half Dread Wings, Thursday's Cape, and Wings
      of The Flames.

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

*Newest first. Prepend new entries directly below this line. Keep only the five latest entries live; rotate older entries at session close.*

> **Reading `Commit(s): uncommitted` in older entries:** it means uncommitted *at the time of writing*,
> not still uncommitted. Entries are written before the commit that carries them exists, so the marker
> goes stale the moment the work lands and was never retro-corrected. Treat `git log` as authoritative
> for what shipped when. New entries should use `the commit containing this entry` instead, which stays
> true.

### 2026-09-29 — UI fluidity phase 5 (image loading and layout stability)

**Agent:** ui-owner / orchestrator (Claude Opus 4.5) · **Commit(s):** `the commit containing this entry`
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

### 2026-09-29 — UI fluidity phases 0–3

**Agent:** ui-owner / orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** UI/UX fluidity program remains `In Progress`; current phase advanced to motion
system and interaction polish

**Changed:**

- `tests/ui/`, `package.json`, and shared gallery/list code: added the Playwright/Node behavior
  harness, bounded progressive galleries, and deferred result filtering with debounced URL sync.
- `NavigationContinuity`, `browseRestoration`, and route loading: preserve the originating card,
  expanded gallery depth, scroll, and focus across detail returns; query-only changes no longer
  reset scroll; detail navigation focuses and announces its heading; detail routes use detail-shaped
  loading UI.
- `MobileFilterPanel`, `Navigation`, and shared Radix Dialog wrapper: keep subtype/search visible,
  move secondary filters into a mobile sheet with URL-derived active counts and subtype-preserving
  clear-all, enforce 44px mobile controls, and give the More panel complete dismissal/focus behavior.
- `.kiro/specs/ui-ux-fluidity/STATUS.md` and `docs/context/`: recorded measured budgets, phased
  acceptance criteria, and the reusable UI contracts.

**Verified:**

- `npm test` → passed 12 public-behavior tests.
- `npm run test:ui` → passed all 16 behavior, structural-budget, responsive, reduced-motion, focus,
  URL round-trip, and fixed-navigation tests with no skips.
- `npm run build` → all dataset validators, cross-dataset verification, script typecheck, TypeScript,
  and Vite production build passed.
- `npm run lint` → passed without warnings.
- Phase 1 browser measurements → initial galleries mount 48 mobile / 72 desktop cards and stay under
  2,500 DOM nodes on representative high-volume routes.
- Visual smoke → mobile filter sheet and desktop inline filters inspected at 390×844 and 1440×900;
  no clipping, overlap, or hierarchy regressions found.

**Not verified / known gaps:**

- No data or scraper behavior changed; broad scrape verification was not applicable.
- Motion tokens, query-stable page entry, and restrained interaction animation are the active Phase 4
  work.

**Next agent should:**

- Continue Phase 4 test-first, beginning with pathname-only page entry and rapid-filter settling
  before replacing broad `transition-all` usage.

### 2026-09-10 — Class access flag merge repair

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; verified and committed pre-existing `dataLoaders.ts` change

**Changed:**

- `src/utils/dataLoaders.ts`: same-source Class duplicate merging now reads DA/DC/DM access from
  family-level `hasDA` / `hasDC` / `hasDM` flags when the merged entry is an item family, instead
  of only checking single-entry `daRequired` / `dcRequired` / `dmRequired` fields.
- `src/utils/dataLoaders.ts`: merged Class entries now preserve the special-character flag when it is
  represented by the `special-character` tag, which keeps list/card filters aligned with loaded data.
- `AGENTS.md` and `docs/context/handover-log-archive.md`: recorded this verified repair and kept the
  live handover log at five entries for session close.

**Verified:**

- `npm test` → passed 10 tests.
- `npm run build` → passed all validators, dataset verification, script typecheck, TypeScript build,
  and Vite production build.
- `npm run lint` → passed.

**Not verified / known gaps:**

- No browser screenshot pass was run; this was loader/filter flag behavior rather than a visual layout
  change.

**Next agent should:**

- Add a focused loader test if the class merge path changes again; current verification is full-gate
  build/test/lint rather than a dedicated fixture for this private merge helper.

### 2026-09-10 — Leaner live handover policy

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested handover compaction policy

**Changed:**

- `AGENTS.md`: shortened the live handover surface to five Handover Log entries and five Done items,
  clarified that archive rotation happens only at session close, and pointed older Done history to a
  dedicated archive.
- `docs/context/done-task-archive.md`: added an archive home for older completed-task history so
  `AGENTS.md` stays operational instead of encyclopedic.
- `docs/context/README.md` and `docs/context/engineering_guidelines.md`: documented the new archive
  and practical test cadence.

**Verified:**

- Documentation-only policy update; inspected the resulting live log and Done counts.

**Not verified / known gaps:**

- No build/test rerun was needed for this docs-only compaction beyond the test/build/lint checks
  already run for the test harness in this same session.

**Next agent should:**

- Keep `AGENTS.md` short during task work and rotate archives only at session close.

### 2026-09-10 — Lean public-behavior test harness

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** `Introduce a test framework` → `✅ Done`

**Changed:**

- `package.json`: added `npm test`, backed by Node's built-in test runner through the existing `tsx`
  dependency.
- `tests/`: added starter public-behavior tests for display text normalization, badge filtering,
  tri-state filter state transitions / URL parsing, and related-item matching fingerprints.
- `README.md`, `docs/context/architecture.md`, `docs/context/engineering_guidelines.md`, and
  `docs/context/project_structure.md`: documented the test command, directory placement, and the
  testing philosophy: behavior and public APIs first, no coverage-padding.
- `AGENTS.md`: moved the deferred test-framework board item to Done and recorded this handover.

**Verified:**

- `npm test` → passed 10 tests. The sandbox blocked `tsx` IPC with `EPERM`; the same command passed
  when rerun with elevated permissions.

**Not verified / known gaps:**

- No browser/visual test runner was added. The first suite intentionally focuses on fast utility and
  public data-behavior checks.

**Next agent should:**

- Add narrow regression tests when changing shared filters, display normalization, related-item
  inference, or data-loading behavior.

### 2026-09-03 — Classes subtype marked complete on the board

**Agent:** orchestrator (Claude Opus 4.8) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** `Complete Classes subtype scraper/data` → `✅ Done` (In Progress column now empty)

**Changed:**

- `AGENTS.md`: per the user's report that the Classes subtype is complete, moved the In Progress
  Classes item to Done, updated the milestone metric line (198 = 144 Classes + 54 Consumables;
  Armors + Regular + Miscellaneous all complete), refreshed Current Focus (Classes / Abilities now
  listed as completed alongside pets/guests/accessories), and updated the shipped-sections Done
  bullet from "starter" to the full section.
- `docs/context/handover-log-archive.md`: rotated the oldest log entry (2026-08-30 — Base class
  parser batch one) to keep the live log at 10.

**Verified:**

- Board-status reconciliation reflecting completed class work; the underlying completion is the
  other agent's, already documented in the 2026-08-30/09-01 class log entries.
- `node scripts/validate-class-abilities.mjs` / `npm run validate` → passed; manifest reports 198
  (144 class + 54 consumable).
- `tsc -b`, `oxlint`, `vite build` → all green (verified this session before the board edit).

**Not verified / known gaps:**

- Completion of the class data/parsing was reported by the user (the other agent's context is held
  in its own session); this entry records the board state, not an independent audit of every class
  entry's correctness.

**Next agent should:**

- Pick a To Do item — the Weapons full re-scrape or the next content section (Locations / Monsters /
  NPCs / Stackable Items).
