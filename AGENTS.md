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
- [ ] **Fix stale card-gallery rendering on L2 filter toggle** — clicking a category filter pill
      (Effect, Rare, Seasonal, etc.) updates the count correctly but the card grid shows stale
      unfiltered cards until a navigation round-trip. Affects Housing, Accessories, Weapons, and
      Classes list pages. Root cause: each page's `canonicalQueryString` `useEffect` calls
      `setSearchParams` after every filter toggle; React Router 7 wraps that in `startTransition`,
      which keeps showing the previous committed DOM during the transition. Also: the `Effect` pill
      should be hidden from Housing cards (L2 filters must not appear on cards per
      `docs/context/ui_patterns.md`). Fix approach investigated and partially implemented in an
      earlier session but reverted — notes:
      - `src/utils/filterVisibility.ts`: change `if (availability.loading) return false` to
        `return true` so URL-active filters aren't stripped during the availability hook's loading
        frame.
      - `src/pages/{Housing,Accessory,Weapon,ClassAbility}ListPage.tsx`: replace the
        `canonicalQueryString` memo + full-URL-sync `useEffect` with a minimal effect that only syncs
        the debounced search query (`q` param) into the URL. All other params are already set
        correctly by their toggle/set functions and don't need canonicalization.
      - `src/components/housing/HousingCard.tsx`: remove the Effect pill (L2 filter, not card
        metadata). Also remove from `HousingDetail.tsx` header.

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

### 2026-08-25 — Cross-category badge award links

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; cross-category linking follow-up requested by user

**Changed:**

- `scripts/generate-badge-relations.mjs` and `src/data/badge-relations.json`: added a lightweight
  generated index for explicit `Own this ... to obtain ... badge(s)` notes. The current data produces
  14 bidirectional item ↔ badge relations.
- `src/hooks/useBadgeRelations.ts` and `src/utils/badgeAwardText.ts`: item detail pages resolve
  mentioned badge names from local note/description text, while Badge detail pages use the generated
  reverse index without loading every large category dataset.
- Detail pages for pets/guests, accessories, weapons, housing, and Classes / Abilities can now append
  awarded Badge cards to `Also See`. Badge detail pages append awarding item cards to their `Also See`
  section.
- `src/components/shared/RelatedLinkCard.tsx`: added a small generic related card for reverse
  cross-category item links from Badge pages.
- `src/components/classAbilities/ClassAbilityCard.tsx` and `src/components/housing/HousingCard.tsx`:
  removed Level 2 status pills such as Rare/Seasonal/Special Offer from card-gallery cards, matching
  the shared card rule used by other categories.
- `docs/context/ui_patterns.md`, `docs/context/category_playbooks.md`, and
  `docs/context/scraper_operations.md`: documented phrase-based cross-category badge links, the
  `npm run generate:badge-relations` maintenance command, and the card-gallery L2 status-pill rule.

**Verified:**

- `npm run generate:badge-relations` → wrote 14 relation(s), no missing badge targets.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run typecheck:scripts` → passed.
- `npm run lint` → passed.
- `git diff --check` → passed.
- `npm run build` → passed full validate/typecheck/build gate.

**Not verified / known gaps:**

- No browser visual QA was run for the new cross-category card sections.
- The relation rule is intentionally strict and only handles explicit `Own this ... to obtain ...
  badge(s)` wording. Broader badge-related prose remains unlinked by design.

**Next agent should:**

- Visually spot-check one item-to-badge link and the corresponding badge-to-item reverse link before
  expanding cross-category linking to less explicit patterns.

### 2026-08-25 — Shared detail page width

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; shared UI polish requested by user

**Changed:**

- `src/components/shared/DetailPageLayout.tsx`: introduced a shared `max-w-5xl` detail-page wrapper
  and exported matching container classes for breadcrumb-only strips.
- Category detail pages/components for badges, pets/guests, accessories, weapons, housing, and
  Classes / Abilities now use the shared detail width for loaded, loading, and not-found states.
- `docs/context/ui_patterns.md`: documented the shared detail-width rule so new categories do not add
  one-off `max-w-*` containers.

**Verified:**

- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run typecheck:scripts` → passed.
- `npm run build` → passed full validate/typecheck/build gate.

**Not verified / known gaps:**

- No browser screenshot pass was run; verification was static/build-only.
- Existing uncommitted Classes / Abilities and dataset changes from this session remain part of the
  same working tree.

**Next agent should:**

- Continue Classes / Abilities work, with detail pages using `DetailPageLayout` by default.

### 2026-08-25 — Armor metric strip and Special Offer tag fallback

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; follow-up polish on Classes Armors sample

**Changed:**

- `src/components/shared/MetricStrip.tsx`: added a bordered `panel` variant with one/two/three-column
  support while preserving the existing compact default used in attack/special accordions.
- `src/components/guests/GuestStatsSection.tsx`: guest Level / Damage / Type panel now uses the
  shared `MetricStrip` panel variant.
- `src/components/classAbilities/ClassAbilityDetail.tsx`: armor detail pages now render Level,
  Rarity, and Equips Class in the same three-column panel style. `Equips Class` is plain text, not a
  hotlink.
- `src/components/classAbilities/ClassAbilityCard.tsx` and detail headers: Classes / Abilities now
  display Rare, Seasonal, and Special Offer pills when the data flags are present.
- `scripts/lib/tags.ts` and `scripts/scrape-classes.ts`: added shared forum tag-image helpers and
  wired Classes to them. The Classes A-Z listing uses text parentheticals such as `S-Offer` instead
  of tag images for some rows, so the scraper treats `/tags/SpecialOffer.png` as canonical when
  present and `S-Offer` listing text as the row-level fallback.
- `src/data/classes.json`: refreshed the A/D Armors sample. `DoomKnight Armor` and
  `DoomKnight Variant One` now carry `specialoffer` / `isSpecialOffer`.
- `docs/context/scraper_operations.md`: documented the tag-image-first, listing-text-fallback rule
  for L2 status tags.

**Verified:**

- Source listing inspection around `DoomKnight Armor` → rows use `(D-Amulet/S-Offer)` and
  `(D-Amulet/Rare/S-Offer)` text rather than rendered tag images.
- `npm run scrape:classes -- --subtype=class --class-subcategory=armor --letters=A,D --fresh` →
  wrote 13 armor entries.
- A/D tag audit → `DoomKnight Armor` special=true, rare=false, tags=`da,specialoffer`;
  `DoomKnight Variant One` special=true, rare=true, tags=`da,rare,specialoffer`.
- `npm run build` → passed.

**Not verified / known gaps:**

- No browser visual QA was run for the new armor/guest `MetricStrip` panel rendering.
- Older scrapers still contain some local tag regexes; most are already image-based, but only Classes
  has been moved onto the expanded shared helper in this follow-up.

**Next agent should:**

- Visually spot-check a guest stats block and DoomKnight Armor detail/card in the app.

---

> **Older entries (33 log entries, 2026-07-27 through 2026-08-24) archived to
> [`docs/context/handover-log-archive.md`](./docs/context/handover-log-archive.md)** to keep this
> file under 600 lines. Read that file only when investigating historical context — the entries above
> cover the current working session.
