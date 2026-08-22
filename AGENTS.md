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

**Automation:** Kanban and log upkeep are enforced by
[`.kiro/skills/project-tracker/SKILL.md`](./.kiro/skills/project-tracker/SKILL.md).

---

## 📊 Active Project Status

**Last updated:** 2026-08-21
**Branch:** `main` · **HEAD:** `1dd13d8` (2 commits ahead of `origin/main`, unpushed) · **Deploy:** Vercel auto-deploy on `main`
**Build gate:** `npm run build` = `npm run validate && tsc -b && vite build`

### Milestone: M5 — Content Breadth (in progress)

| Metric | Value |
| -------- | ------- |
| Shipped content sections | 5 of 10 |
| Total dataset entries | 4,963 |
| Badges | 161 |
| Pets / Guests | 304 (221 pets · 83 guests) |
| Accessories | 2,602 across 8 subtypes |
| Weapons | 3,288 across 4 subtypes / 11 shards |
| Housing | 608 across 7 subtypes |

### Current Focus

1. **Propagate scraper fixes into stale datasets.** Several correctness fixes landed in scraper code
   but only targeted entries were re-scraped. Full category passes are outstanding (see Kanban).
2. **Next content section: Classes / Abilities.** Highest-value remaining forum category.
3. **Documentation modularization** — completing this session.

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
- [ ] **Full weapons re-scrape** — propagate base/DC variant consolidation and Method 1/2 grouping
      beyond letter `#`. `npm run scrape:weapons`
- [ ] **Full pets re-scrape** — propagate additive family elements/traits + per-variant `traits`
      beyond the targeted entries. `npm run scrape:pets`
- [ ] **Re-scrape `Navigator's Hat`** — verify DC variants II-VI are no longer DA-tagged (run was
      interrupted). `npm run scrape:accessories -- --subtypes=artifact --names="Navigator's Hat"`
- [ ] **Ship Classes / Abilities section** (`/classes`) — forum category: Classes / Abilities
- [ ] **Ship Locations & Quests section** (`/locations`) — forum category: Locations / Quests / Events / Shops
- [ ] **Ship Monsters section** (`/monsters`)
- [ ] **Ship NPCs section** (`/npcs`)
- [ ] **Ship Stackable Items section** (`/items`)
- [ ] **Audit mixed progression labels across all family-capable datasets** — find Roman/numeric +
      named-sibling mixes, spot-check with user before any broad auto-split
- [ ] **Introduce a test framework** — deferred by decision; revisit when complexity warrants

### 🚧 In Progress

- [ ] **Multi-variant pets detection (Sprint 5)** — spec:
      `.kiro/specs/multi-variant-items/SPRINT5_GUIDE.md`. Scraper still emits single-variant `Pet`
      objects for some threads; target is `ItemFamily` for all multi-level/multi-obtain pets.

### ✅ Done

#### Content sections shipped

- [x] Badges section — `/badges`, 161 entries, 5 categories + subcategories, retired handling
- [x] Pets / Guests section — `/pets`, `/pets/:slug`, `/guests/:slug`, 304 entries
- [x] Accessories section — `/accessories`, 8 subtypes, 2,602 entries, A-L/M-Z shards for helms + capes
- [x] Weapons section — `/weapons`, 4 subtypes, 3,288 entries across 11 shards
- [x] Housing section — `/housing`, 7 subtypes, 608 entries

#### Scrapers & data pipeline

- [x] `scrape-badges.ts` + `add_images.py` + `add_subcategories.py`
- [x] `scrape-pets.ts` + `images:pets`
- [x] `scrape-guests.ts` + `images:guests` + local A/C CharPage capture (Playwright/Ruffle)
- [x] `scrape-accessories.ts` with per-subtype strategies
- [x] `scrape-weapons.ts` with `--url/--urls` and `--special-only` refresh modes
- [x] `scrape-housing.ts` with additive-by-slug merge and `--limit` dry-run
- [x] Validators: `validate-badges/pets/accessories/weapons/housing.mjs`
- [x] `verify-datasets.mjs` cross-post-family invariant checks wired into `build`
- [x] Auto-regenerated manifests for every dataset write
- [x] Graceful deleted-post handling (`isPostUnavailableError`) across all scrapers
- [x] Shared scraper libs: `forum`, `printable-parser`, `also-see`, `obtain-formatting`,
      `access-flag-repair`, `family-merge-guard`, `tags`, `cross-post-family`, `data-manifests`

#### Shared UI system

- [x] Item-family model (`ItemFamily` / `LevelVariant`) with additive elements + per-variant traits
- [x] Shared obtain cards (`ObtainSection`, `ObtainVariantCard`) with Method 1/2 labelling
- [x] Tri-state filter pills + data-driven filter visibility + exclusion URL params
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

### On task completion

 1. **Tick the Kanban checkbox and move the item to `✅ Done`** immediately. Do not batch this.
 2. **Prepend a Handover Log entry** (newest first) using the entry template below.
 3. **Update `📊 Active Project Status`** if counts, milestone, or focus changed.
 4. **If a rule changed, update the matching `docs/context/` file in the same commit.**

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

**Agent:** <role/model> · **Commit(s):** `<sha>` or `uncommitted`
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

### 2026-08-21 — Scrape execution hardened into a hard rule

**Agent:** orchestrator (Claude Opus 5) · **Commit(s):** `755bf96`, `1dd13d8`
**Kanban moved:** none — policy change, not a board item

**Changed:**

- `docs/context/scraper_operations.md`: new `## Who May Run a Scrape — hard rule` section directly
  after Prerequisites. Agents may run only narrowly scoped verification scrapes (`--names=` for ~3 or
  fewer entries, one or two `--url=`, `--limit=` dry runs). Everything broader — no scope flags,
  `--letters=`, `--subtypes=` without `--names`, category-scope `--fresh`, `--special-only`, any
  `clear:*` then re-scrape — is handed to the user. Includes an allowed/handover table and two
  corollaries: no hand-editing dataset JSON as a substitute, and unverifiable scraper fixes get marked
  unverified with the re-scrape put on the board.
- `docs/context/scraper_operations.md`: the former permissive bullet ("Short targeted scrapes may still
  be run directly") replaced with a pointer to the hard rule. That sentence was the loophole — it had
  no definition of "short".
- `AGENTS.md`: non-negotiable rewritten from "Long scrapes are handed to the user" to an explicit
  no-broad-scrape rule with the allowed-scope summary and a deep link to the new section. Agent
  Assignments row for `human` now reads "All broad/full scrapes". The note under that table now says
  human-run "by rule, not by convention".

**Verified:**

- `mdlint.py AGENTS.md docs/context/scraper_operations.md` → 0 findings across 2 files.
- All seven required AGENTS.md headings and Kanban column headings still present.

**Not verified / known gaps:**

- Docs/policy only. No code, scraper, or dataset behaviour touched, and no scrape was run.
- `.kiro/` is gitignored, so `.kiro/skills/project-tracker/SKILL.md` never travels to a clone or
  another client. Any non-Kiro agent needs the protocol inlined from this file rather than loaded from
  a skill. `AGENTS.md` and `docs/context/` are now both tracked, so the rules themselves are portable.
- `755bf96` also swept up the previously uncommitted 2026-08-20 documentation modularization; that
  entry's `uncommitted` marker has been corrected to the same SHA.
- Both commits are **unpushed**. `origin/main` is still at `003f01b`.

**Next agent should:**

- Pick up the bug-fix work the user is handing over, taking scope from the Kanban board.

### 2026-08-20 — Documentation modularization: AGENTS.md → orchestrator + docs/context

**Agent:** Principal Systems Engineer (Claude Opus 4.8) · **Commit(s):** `755bf96`
**Kanban moved:** Documentation modularization → In Progress → Done

**Changed:**

- `docs/context/` (new, 7 files): full static extraction of the former 931-line `AGENTS.md`.
  `README.md` carries an index table mapping every new file back to its original sections.
  Split: `architecture.md`, `project_structure.md`, `data_reference.md`,
  `engineering_guidelines.md`, `ui_patterns.md`, `category_playbooks.md`, `scraper_operations.md`.
- `AGENTS.md`: wiped static content, rebuilt as this orchestrator (Status / Kanban / Protocol / Log)
  with a Context Map preamble so discoverability survives the split.
- `docs/context/engineering_guidelines.md`: Documentation Policy rewritten from a 2-location rule to
  the new 3-location rule (orchestrator / static context / feature specs) so the policy no longer
  contradicts the structure.
- Kanban `Done` populated from parsed project structure + manifests; `To Do` seeded with the five
  planned forum sections and the outstanding full-category re-scrapes.
- `.kiro/skills/project-tracker/SKILL.md`: new automation skill for Kanban upkeep and the
  empty-backlog session-close halt.

**Verified:**

- Dataset counts in Active Project Status read from `src/data/*-manifest.json`, not estimated:
  badges 161, pets/guests 304, accessories 2,602, weapons 3,288, housing 608.
- Every `##`/`###` section of the old `AGENTS.md` maps to a destination file (mapping table in
  `docs/context/README.md`).

**Not verified / known gaps:**

- Docs-only change; no runtime or dataset behaviour touched.
- The re-scrape backlog in `To Do` is carried forward from prior sessions and still outstanding —
  scraper code is fixed, on-disk data for non-targeted entries is stale.

**Next agent should:**

- Take the top `To Do` re-scrape item, or start Classes / Abilities if the user prefers new breadth.

### 2026-08-18 — Housing section, scraper, and UI refinements

**Agent:** prior session · **Commit(s):** `003f01b`
**Kanban moved:** Housing section → Done

**Changed:**

- Added Housing scraper, validator, 7 subtype datasets + manifest, types, `useHousing`, list/detail
  pages and components; wired routes, navigation, and home page.
- Extracted shared `accessPillStyles`, `filterVisibility`, `navigationContext` utilities; added
  `TriStateFilterPill`; refined `ObtainSection` / `ObtainVariantCard`.

**Verified:**

- `validate-housing.mjs` passing; 608 entries across 7 subtypes.

**Not verified / known gaps:**

- Housing `Free` filter intentionally omitted pending evidence of genuinely free entries.

**Next agent should:**

- Confirm Housing effect cards render correctly on Rugs-onward subtypes.

### 2026-08-17 — Tri-state filters and item data handling

**Agent:** prior session · **Commit(s):** `d501aaf`

**Changed:**

- Tri-state (neutral → include → exclude) filter pills with parallel `exclude*` URL params.
- Data-driven filter visibility so pills only appear when the loaded dataset can match them.

### 2026-08-12 — DA scoping, image selector independence, accessory notes

**Agent:** prior session · **Commit(s):** `6c58472`

**Changed:**

- Section-level DA no longer bleeds onto DC obtain methods; access-flag-repair preserves explicitly
  scraped `daRequired=true`. Fixed Carved Dragon Scale and Navigator's Hat DC variants.
- Image selector decoupled from variant selector on accessories; weapons now link only when a variant
  has a caption-matched image.
- Accessory `armorCustomization` parsed notes-first to stop regex over-matching (Cloak of the Beast,
  Helm of Aegis, Warpfire Manifestation); supplemental trailing posts now contribute shared notes.

**Not verified / known gaps:**

- Only targeted entries re-scraped; full accessories pass still outstanding.

### 2026-08-07 — Scraper consolidation and weapon detail polish

**Agent:** prior session · **Commit(s):** `0e2d04d`

### 2026-08-04 — Scraper family consolidation improvements

**Agent:** prior session · **Commit(s):** `7064c0f`

### 2026-07-27 — Scraper resilience, variant consolidation, inferred Also See

**Agent:** prior session · **Commit(s):** `532b60d`

**Changed:**

- `isPostUnavailableError` so deleted forum posts (HTTP 500) skip gracefully instead of aborting runs.
- Weapon base/DC split preserved while same-level non-DC methods consolidate into Method 1/2.
- Additive family elements/traits with per-variant scoping (Linus `[ICE]` + `[SHR]`).
- Relaxed inferred Also See fingerprint; all 12 Plushie pets and the Exalted Blaster trinkets link.
- Guest portrait `pic`/`Petpic` matching (Princess); attack bullets kept inline in effect (Professor).
