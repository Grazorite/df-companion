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

**Last updated:** 2026-08-24
**Branch:** `main` · **Deploy:** Vercel auto-deploy on `main` — pushing to `main` ships to production

> Read the live HEAD with `git log --oneline -1` rather than trusting a SHA pinned here; commits that
> only sync this file would otherwise invalidate their own status line.
**Build gate:** `npm run build` = `npm run validate && tsc -b && vite build`

### Milestone: M5 — Content Breadth (in progress)

| Metric | Value |
| -------- | ------- |
| Shipped content sections | 6 of 10 |
| Total dataset entries | 7,061 (sum of the six `src/data/*-manifest.json` totals) |
| Badges | 161 |
| Pets / Guests | 304 (221 pets · 83 guests) |
| Accessories | 2,602 across 8 subtypes |
| Weapons | 3,288 across 4 subtypes / 11 shards |
| Housing | 623 across 7 subtypes |
| Classes / Abilities | 83 across 2 subtypes (Consumables + Armors populated) |

### Current Focus

1. **Propagate scraper fixes into stale datasets.** Accessories and weapons full passes are still
   outstanding (see Kanban). Pets and guests were completed 2026-08-24.
2. **Complete Classes subtype for Classes / Abilities.** Consumables and Armors are populated;
   Regular / Miscellaneous parsing is still pending.

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

- [ ] **Full accessories re-scrape** — propagate `armorCustomization` notes-first parsing + DA/DC
      scoping fixes to all 2,602 entries. `npm run scrape:accessories`
- [ ] **Check and fix default-weapon scraping / parsing logic** — audit how `(… Default)` titles are
      detected and normalized in `scripts/scrape-weapons.ts` (`isDefaultWeaponTitle`,
      `weaponEntryIsDefault`, the `repeatedDefaultMatch` strip around L1741, and the `isDefault` /
      `'default'` tag emission at L1342-1385 and L1558-1632). Concrete things to settle:
      - `familyName` keeps the raw parenthetical when the inner and outer names differ, e.g.
        `ChickenBlade (ChickenCow Default)` and `Claws?? (Zardbie Default)`. The `repeatedDefaultMatch`
        strip only fires when both names normalize equal, so only `X (X Default)` is cleaned. Decide
        whether the monster/class qualifier should be preserved in `familyName`, moved to a variant
        label, or surfaced some other way — then make detection and display agree.
      - 232 weapon entries mention "default" but only 103 carry `isDefault: true`. Confirm the other
        129 are incidental prose mentions rather than missed detection.
      - Subtype skew: scythes account for 132 of the 232 mentions versus 18 across all daggers. Confirm
        that reflects the source data and is not a subtype-specific parsing gap.
      - Nearly every `isDefault` entry is also tagged `free`. Confirm that pairing is intended before
        the `default` access filter is relied on in the UI.
      **Sequencing:** do this *before* the full weapons re-scrape below, so the broad run only has to
      happen once.
- [ ] **Full weapons re-scrape** — propagate base/DC variant consolidation and Method 1/2 grouping
      beyond letter `#`. `npm run scrape:weapons`. Blocked on the default-weapon audit above.
- [ ] **Ship Locations & Quests section** (`/locations`) — forum category: Locations / Quests / Events / Shops
- [ ] **Ship Monsters section** (`/monsters`)
- [ ] **Ship NPCs section** (`/npcs`)
- [ ] **Ship Stackable Items section** (`/items`)
- [ ] **Audit mixed progression labels across all family-capable datasets** — find Roman/numeric +
      named-sibling mixes, spot-check with user before any broad auto-split
- [ ] **Introduce a test framework** — deferred by decision; revisit when complexity warrants

### 🚧 In Progress

- [ ] **Complete Classes subtype scraper/data** — Armors populated and cleaned up; Regular /
      Miscellaneous parsing and Special Character tag detection still pending.

### ✅ Done

#### Content sections shipped

- [x] Badges section — `/badges`, 161 entries, 5 categories + subcategories, retired handling
- [x] Pets / Guests section — `/pets`, `/pets/:slug`, `/guests/:slug`, 304 entries
- [x] Accessories section — `/accessories`, 8 subtypes, 2,602 entries, A-L/M-Z shards for helms + capes
- [x] Weapons section — `/weapons`, 4 subtypes, 3,288 entries across 11 shards
- [x] Housing section — `/housing`, 7 subtypes, 623 entries
- [x] Classes / Abilities starter — `/classes`, Consumables + Armors populated, Regular/Misc pending

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
- [x] **Multi-variant pets detection (Sprint 5)** — `ItemFamily` emitted for all multi-level /
      multi-obtain pets. Spec: `.kiro/specs/multi-variant-items/SPRINT5_GUIDE.md`. Closed 2026-08-24
      after user confirmation; the board had been stale rather than the work incomplete.
- [x] **`Navigator's Hat` DA/DC variants confirmed correct** — the alternating per-variant DA and DC
      obtain methods are the intended shape, verified manually by the user against the forum thread on
      2026-08-24. No re-scrape was needed; the board item was stale, not the data.

#### Shared UI system

- [x] Cross-category badge-award Also See links — explicit item notes such as
      `Own this armor to obtain the Time Walker badge` now link item pages to Badge pages and Badge
      pages back to the awarding item through `badge-relations.json`.
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

### 2026-08-26 — Shared access-aware variant labels

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; shared variant-label follow-up requested by user

**Changed:**

- `src/utils/variantHelpers.ts`: added shared `formatVariantAccessLabel` and
  `formatVariantNameWithAccess` helpers for scraper-normalized variant labels. The shared grammar now
  covers access-only labels (`(DA)`, `(DA, DC)`, `(DC)`), duplicate level labels (`20`, `20 (DC)`),
  base sibling labels (`(Base)`, `(Base) (DC)`), and uppercase Roman numerals.
- `scripts/scrape-classes.ts`: ChickenCow armor normalization now uses the shared helper. The
  duplicate `ChickenCow Armor` pair derives its label from the scraped level; `Evolved ChickenCow
  Armor` renders `(DA)`, `(DA, DC)`, `(DC)` without a redundant `1` prefix.
- `src/data/classes.json`: targeted ChickenCow armor refresh updated the current data to the shared
  label policy.
- `docs/context/ui_patterns.md`, `docs/context/data_reference.md`, and
  `docs/context/category_playbooks.md`: documented the shared variant-label policy and the corrected
  ChickenCow armor special case.

**Verified:**

- Targeted scrape `npm run scrape:classes -- --subtype=class --class-subcategory=armor
  --names='ChickenCow Armor|Evolved ChickenCow Armor|Ascended ChickenCow Armor'` → passed and wrote
  29 class entries.
- Data audit → ChickenCow labels are `1`, `1 (DC)`; Evolved labels are `(DA)`, `(DA, DC)`, `(DC)`;
  Ascended labels are `(DA)`, `(DC)`.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 83 entries.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run lint` → passed.
- `git diff --check` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- Accessories and weapons still need the already-pending broad re-scrapes to propagate their scraper
  fixes; no broad scrape was run by the agent.
- Existing category-specific scrapers still decide the natural forum label. The shared helper only
  standardizes how that label combines with access flags.

**Next agent should:**

- Continue with the pending accessories/weapons broad scrape handoff or the Regular/Miscellaneous
  Classes parser work, depending on user priority.

### 2026-08-26 — Desktop/web UI smoke QA

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested desktop/web UI check

**Changed:**

- No code changes were needed from this QA pass. Existing desktop/sidebar/list/detail layouts looked
  healthy in the sampled routes after the mobile navigation and filter layout changes.
- `AGENTS.md`: recorded the verification outcome and kept completed UI tasks checked off.

**Verified:**

- `npx tsx scripts/screenshot.ts` desktop screenshots at 1440×900 for Home, Accessories Helms,
  Weapons Scythes, Housing Stuff with `Effect`, Accessory detail, Housing detail, and Classes /
  Abilities armor detail → visually checked.
- Playwright desktop overflow/console audit for `/`, `/accessories?type=helm`,
  `/weapons?type=scythe`, `/classes?type=class`, `/housing?type=stuff&category=effect`, `/pets`,
  `/accessories/13th-mask?type=helm`, `/housing/armor-closet?type=stuff`, and
  `/classes/class-ability-gnomish-personal-steamtank-vr-1-0-mk-ii?type=class` → no console errors
  and `scrollWidth` matched `innerWidth` at 1440px for every page.

**Not verified / known gaps:**

- This was a focused visual smoke pass, not exhaustive screenshot coverage for every route and
  viewport.
- No broad scrapes were run or needed.

**Next agent should:**

- Continue with the pending accessories/weapons full re-scrape handoff or the next Classes /
  Abilities scraper task.

### 2026-08-26 — Mobile navigation and filter layout polish

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; shared mobile UI bug fix requested by user

**Changed:**

- `src/components/shared/SegmentToggle.tsx`: subtype selector pills now wrap on mobile widths instead
  of clipping off the right edge.
- `src/components/layout/Navigation.tsx`: mobile bottom navigation now keeps a compact primary set
  (`Home`, `Accessories`, `Badges`, `Pets`, `More`) and opens a More panel containing Classes /
  Abilities, Housing, Weapons, and coming-soon sections.
- `docs/context/ui_patterns.md` and `docs/context/category_playbooks.md`: documented mobile subtype
  wrapping, the mobile More navigation pattern, and the Housing `Effect` metadata rule.

**Verified:**

- `npx tsx scripts/screenshot.ts` mobile screenshots at 390×844 for Accessories, Weapons, Home, and
  the opened More menu → visually checked.
- Playwright mobile overflow audit for `/`, `/accessories?type=helm`, `/weapons?type=scythe`,
  `/classes?type=class`, `/housing?type=stuff`, and `/pets` → `scrollWidth` matched `innerWidth`
  at 390px for every page.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run build` → passed production build and all validators.
- `git diff --check` → passed.

**Not verified / known gaps:**

- No broad scrapes were run or needed.

**Next agent should:**

- Continue with the pending accessories/weapons full re-scrape handoff or the next Classes /
  Abilities scraper task.

### 2026-08-26 — Stale L2 filter toggle rendering fix

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** `Fix stale card-gallery rendering on L2 filter toggle` → `✅ Done`

**Changed:**

- `src/pages/AccessoryListPage.tsx`, `src/pages/WeaponListPage.tsx`,
  `src/pages/HousingListPage.tsx`, and `src/pages/ClassAbilityListPage.tsx`: removed the
  catch-all `canonicalQueryString` URL-sync effect that rewrote every filter param after filter
  toggles. Each page now only syncs debounced search text (`q`) through an effect; filter toggle and
  clear handlers remain the source of truth for their own params.
- `src/components/housing/HousingCard.tsx` and `src/components/housing/HousingDetail.tsx`: removed
  Housing `Effect`/L2 status metadata pills from cards/detail headers while preserving the actual
  effect content and Effect filter.
- `src/components/housing/HousingList.tsx`: made Housing card keys unique even when filtered
  transition renders contain same-slug entries.
- `docs/context/ui_patterns.md`: documented that list pages should not re-canonicalize the whole
  filter URL after toggles.

**Verified:**

- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run build` → passed production build and all validators.
- `git diff --check` → passed.
- Local Playwright smoke test against Vite dev server → Housing `Effect`, Accessories `Rare`,
  Weapons `Special`, and Classes `Seasonal` L2 toggles all updated URL/count/cards together; no
  browser console errors; Housing card-level `Effect` pill count was 0.

**Not verified / known gaps:**

- No broad scrapes were run or needed.

**Next agent should:**

- Run the normal verification gate, then continue with the pending accessories/weapons full
  re-scrape handoff or the next Classes / Abilities scraper task.

### 2026-08-26 — Shared trinket-skill enrichment repair

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; targeted trinket parser bug fix requested by user

**Changed:**

- `scripts/scrape-accessories.ts`: trinket skill parsing now enriches same-name skill blocks from
  the richest sibling block. Requirement-specific rows keep their own `Requirements:` text but inherit
  missing effect text, mana/cooldown/type/element, button image, appearance image(s), and notes.
- `src/data/trinkets.json`: targeted refresh for `Beacon of Hope` and `Pillar of Light` populated the
  complete shared `Beacon of Hope` skill details for both trinkets while preserving each trinket's
  requirement.
- `docs/context/category_playbooks.md` and `docs/context/scraper_operations.md`: documented the
  shared trinket-skill post pattern and the required enrichment behavior for trinkets and
  ability-bearing artifacts.

**Verified:**

- Targeted scrape `npm run scrape:accessories -- --subtypes=trinket
  --names="Beacon of Hope,Pillar of Light"` → passed.
- Data audit → `Pillar of Light` now has the complete Beacon of Hope skill mechanics/media and keeps
  `Pillar of Light equipped` as its requirement.
- Current trinket skill audit → only one shared ability URL group exists (`Beacon of Hope` /
  `Pillar of Light`), and no ability-bearing trinket currently has missing attacks, unknown effects,
  missing skill button images, or missing appearance images.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `node scripts/validate-accessories.mjs` → passed, 2,602 entries across 8 subtypes / 10 data files.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run build` → passed production build and all validators.
- `git diff --check` → passed.

**Not verified / known gaps:**

- No broad trinket/accessories scrape was run by the agent. Future full accessories re-scrape remains
  user-run by rule.
- Browser visual QA was not run before this handover entry.

**Next agent should:**

- Continue with the pending accessories/weapons full re-scrape handoff or the next Classes /
  Abilities scraper task.

### 2026-08-25 — Accessory/weapon mixed DA/DC scraper scoping

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; scraper bug fix requested before user-run broad re-scrapes

**Changed:**

- `scripts/scrape-accessories.ts`: accessory obtain parsing now carries DA/DC/DM tag images from the
  variant title segment into that specific obtain method. The later entry-building step no longer
  applies whole-post DA/DC/DM tag flags to every method when the post contains mixed DC and non-DC
  obtain methods.
- `scripts/scrape-weapons.ts`: weapon entry building now follows the same mixed-access rule, so
  alternating DA/DC title blocks keep method-level access instead of inheriting broad page-level tags.
- `docs/context/category_playbooks.md` and `docs/context/scraper_operations.md`: documented that
  Accessories and Weapons must treat method-block tags/price/required-items as authoritative for
  mixed DC/non-DC posts, especially Roman numeral families.

**Verified:**

- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- No broad accessories or weapons scrape was run by the agent. Current JSON remains stale for affected
  alternating DA/DC families until the user runs the pending full re-scrapes.
- Targeted forum spot-check scrapes were not run in this pass.

**Next agent should:**

- Hand the user the full Accessories and Weapons scrape commands.

### 2026-08-25 — ChickenCow armor variants and detail status-pill cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; targeted class-armor follow-up requested by user

**Changed:**

- `src/components/classAbilities/ClassAbilityDetail.tsx`: removed Level 2 availability/status pills
  (`Rare`, `Seasonal`, `Special Offer`) from Classes / Abilities detail headers. Detail headers now
  match the shared rule: access/method/type metadata only.
- `scripts/scrape-classes.ts`: added ChickenCow armor single-post family normalization. `ChickenCow
  Armor` renders `1` / `1 (DC)`, `Evolved ChickenCow Armor` renders `1 (DA)` / `1 (DA, DC)` /
  `1 (DC)`, and `Ascended ChickenCow Armor` renders `(DA)` / `(DC)`, with method-level DA/DC flags
  overriding page-level tag bleed.
- `scripts/scrape-classes.ts`: repaired the known Epoch price artifact where the forum
  strikethrough could leave `(Standard` without the closing parenthesis.
- `src/data/classes.json`: targeted Epoch refresh passed the current armor data through the new
  normalizer while keeping the class count at 29.
- `src/data/badge-relations.json`: regenerated after armor data normalization; still 26 relations.
- `docs/context/category_playbooks.md` and `docs/context/ui_patterns.md`: documented ChickenCow
  armor method-variant rules, Epoch price cleanup, and the no-L2-status-pills detail-header rule.

**Verified:**

- Targeted scrape `npm run scrape:classes -- --subtype=class --class-subcategory=armor
  --names='Epoch'` → passed and wrote 29 class entries.
- Data audit → ChickenCow/Evolved/Ascended variant labels and DA/DC method flags match the requested
  splits; Epoch price now starts `$19.95-$24.95 USD (Standard)`.
- `npm run generate:badge-relations` → passed, 26 relations.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 83 entries.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- No broad class scrape was run by the agent. Regular and Miscellaneous class-page scraping remain
  pending.
- Browser visual QA was not run before this handover entry.

**Next agent should:**

- Continue Classes / Abilities with Regular or Miscellaneous class scraping when the user is ready.

### 2026-08-25 — Armor Shadow and Reforged family cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; targeted class-armor follow-up requested by user

**Changed:**

- `scripts/scrape-classes.ts`: added shared armor-pair consolidation helpers for Shadow/Ancient
  armors and Reforged time-class armors. Shadow Mage/Rogue/Warrior Armor now render as base display
  families with `(Base)` and `Ancient` variants. Archivist, Avatar of Time, ChronoZ,
  Chronocorruptor, Chronomancer Armor, ShadowWalker of Time, and TimeKiller now render with `(Base)`
  and `Reforged` variants when both source entries exist.
- `src/data/classes.json`: targeted repair scrape normalized the current Armors data to 29 class
  entries and removed standalone `Reforged ...` primary rows. Legacy source slugs remain aliases.
- `src/data/badge-relations.json`: regenerated after the armor family changes; still 26
  bidirectional badge-award relations.
- `docs/context/category_playbooks.md` and this file: documented the Shadow/Ancient and Reforged
  time-class armor consolidation rules and updated Classes / Abilities counts/status.

**Verified:**

- Targeted scrape `npm run scrape:classes -- --subtype=class --class-subcategory=armor
  --names='Chronocorruptor|Reforged Chronocorruptor'` → passed and wrote 29 class entries.
- Data audit → Shadow armor families have `(Base)`/`Ancient`, time-class armor families have
  `(Base)`/`Reforged`, `Epoch` remains standalone, 0 standalone `Reforged ...` rows, 0 alias
  collisions.
- `npm run generate:badge-relations` → passed, 26 relations.

**Not verified / known gaps:**

- No broad class scrape was run by the agent. The full Armors pass was user-run before these targeted
  repairs; Regular and Miscellaneous class-page scraping remain pending.
- Visual browser QA for the newly consolidated armor pages was not run in this follow-up.

**Next agent should:**

- Continue Classes / Abilities by implementing Regular or Miscellaneous class scraping when the user
  is ready.

### 2026-08-25 — Armor full-scrape parser scope and dedupe repair

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; post-full-scrape bug fix requested by user

**Changed:**

- `scripts/scrape-classes.ts`: armor listing parsing now anchors to the actual Armors post body and
  stops before Regular/Miscellaneous class sections, so `--class-subcategory=armor` no longer
  encounters `Regular Classes (A-Z)` or `Miscellaneous Classes (A-Z)` links.
- `scripts/scrape-classes.ts`: class-ability normalization now removes stale primary entries whose
  slug is already claimed as another consolidated family's alias. This removes duplicate consolidated
  entries such as `Gnomish Personal Steamtank Mk II`.
- `src/data/classes.json`: repaired after the user's full armor scrape. Current armor dataset has 39
  class entries; `Gnomish Personal Steamtank (Vr 1.0, Mk II)` and `DoomKnight (Armor, Variant One)`
  are each single consolidated families.
- `src/data/badge-relations.json`: regenerated after the full armor scrape; now 26 relations.
- `docs/context/category_playbooks.md` and `docs/context/scraper_operations.md`: documented armor-only
  section scoping and alias-primary duplicate removal.

**Verified:**

- Dry-run sample `npm run scrape:classes -- --subtype=class --class-subcategory=armor --limit=5`
  starts at `Ancient Exosuit` and parses 5 armor entries.
- Data audit → 39 armor entries, 0 non-armor class entries, 0 missing armor class/rarity fields,
  0 alias collisions.
- `npm run generate:badge-relations` → passed, 26 relations.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- No second full armor scrape was run after the parser-scope fix, per broad-scrape rule. Current JSON
  was repaired by targeted Gnomish refresh plus normalization.
- Regular and Miscellaneous class-page scraping remain pending.

**Next agent should:**

- Continue Classes / Abilities by implementing Regular or Miscellaneous class scraping when the user
  is ready.

### 2026-08-25 — Class armor targeted family cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; targeted class-armor follow-up requested by user

**Changed:**

- `scripts/scrape-classes.ts`: fixed `--url=` parsing for forum URLs containing `=`, added direct
  URL page-title family handling, tightened title detection around forum metadata, and added targeted
  armor-family normalizers for Gnomish Personal Steamtank and DoomKnight.
- `src/data/classes.json`: targeted refreshes now represent `Gnomish Personal Steamtank (Vr 1.0,
  Mk II)` with `Vr 1.0` / `Mk II` variants and `DoomKnight (Armor, Variant One)` with `Armor` /
  `Variant One` variants.
- `src/data/badge-relations.json`: regenerated after armor cleanup. `GPS` and `DoomKnight` badge
  relations now point to the consolidated armor families.
- `src/components/badges/BadgeCard.tsx` plus item detail pages: cross-category badge cards in
  `Also See` now show a compact `Badge` pill, while normal badge gallery cards remain unchanged.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`, and
  `docs/context/ui_patterns.md`: documented direct class-armor URL refreshes, the Gnomish/DoomKnight
  armor-family rules, and the cross-category badge-card cue.

**Verified:**

- Targeted Gnomish scrape → family `Gnomish Personal Steamtank (Vr 1.0, Mk II)` with variants
  `Vr 1.0`, `Mk II`.
- Targeted DoomKnight scrape → family `DoomKnight (Armor, Variant One)` with variants `Armor`,
  `Variant One`.
- `npm run generate:badge-relations` → passed, 14 relations.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `git diff --check` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- Full armor scrape was not run per broad-scrape rule. User should run it manually when ready.
- Regular and Miscellaneous class-page scraping remain pending.

**Next agent should:**

- Hand the user the full Armors scrape command, then continue Classes / Abilities breadth work once
  the user has run it.

> **Older entries (34 log entries, 2026-07-27 through 2026-08-25) archived to
> [`docs/context/handover-log-archive.md`](./docs/context/handover-log-archive.md)** to keep this
> file under 600 lines. Read that file only when investigating historical context — the entries above
> cover the current working session.
