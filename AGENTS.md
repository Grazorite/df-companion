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

**Last updated:** 2026-08-24
**Branch:** `main` · **Deploy:** Vercel auto-deploy on `main` — pushing to `main` ships to production

> Read the live HEAD with `git log --oneline -1` rather than trusting a SHA pinned here; commits that
> only sync this file would otherwise invalidate their own status line.
**Build gate:** `npm run build` = `npm run validate && tsc -b && vite build`

### Milestone: M5 — Content Breadth (in progress)

| Metric | Value |
| -------- | ------- |
| Shipped content sections | 6 of 10 |
| Total dataset entries | 7,032 (sum of the six `src/data/*-manifest.json` totals) |
| Badges | 161 |
| Pets / Guests | 304 (221 pets · 83 guests) |
| Accessories | 2,602 across 8 subtypes |
| Weapons | 3,288 across 4 subtypes / 11 shards |
| Housing | 623 across 7 subtypes |
| Classes / Abilities | 54 across 2 subtypes (Consumables populated; Classes pending) |

### Current Focus

1. **Propagate scraper fixes into stale datasets.** Accessories and weapons full passes are still
   outstanding (see Kanban). Pets and guests were completed 2026-08-24.
2. **Complete Classes subtype for Classes / Abilities.** Consumables are populated; Armors /
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
- [ ] **Complete Classes subtype scraper/data** — implement Armors / Regular / Miscellaneous parsing,
      Special Character tag detection, and final Classes detail rendering.
- [ ] **Ship Locations & Quests section** (`/locations`) — forum category: Locations / Quests / Events / Shops
- [ ] **Ship Monsters section** (`/monsters`)
- [ ] **Ship NPCs section** (`/npcs`)
- [ ] **Ship Stackable Items section** (`/items`)
- [ ] **Audit mixed progression labels across all family-capable datasets** — find Roman/numeric +
      named-sibling mixes, spot-check with user before any broad auto-split
- [ ] **Introduce a test framework** — deferred by decision; revisit when complexity warrants

### 🚧 In Progress

*Nothing in flight. Take the top `🔜 To Do` item.*

### ✅ Done

#### Content sections shipped

- [x] Badges section — `/badges`, 161 entries, 5 categories + subcategories, retired handling
- [x] Pets / Guests section — `/pets`, `/pets/:slug`, `/guests/:slug`, 304 entries
- [x] Accessories section — `/accessories`, 8 subtypes, 2,602 entries, A-L/M-Z shards for helms + capes
- [x] Weapons section — `/weapons`, 4 subtypes, 3,288 entries across 11 shards
- [x] Housing section — `/housing`, 7 subtypes, 623 entries
- [x] Classes / Abilities starter — `/classes`, Consumables dataset populated, Classes subtype pending

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

### 2026-08-24 — Pet DM repair and shared stale-data normalization

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up data-rule repair

**Changed:**

- `scripts/scrape-pets.ts`: the legacy pet `parsePriceType()` path now delegates to shared
  `computePriceType()`, so pure `Required Items: Defender's Medal` methods classify as DM instead of
  Merge Required.
- `src/utils/dataLoaders.ts`: all loaded item families now repair obtain-method DM/merge flags and
  recompute family access flags. Single entries with obtain methods also get the same load-time
  method repair where applicable, so stale accessory/weapon JSON is normalized in the app before
  pending full re-scrapes.
- `src/data/pets.json`: targeted refresh of `Jimmy The Eye`, `Red Imp`, and `War Wolf` rewrote their
  pure Defender's Medal methods as `priceType: "dm"` with `dmRequired: true`.
- `docs/context/scraper_operations.md`: clarified that `pets-progress.json` / `guests-progress.json`
  are gitignored resumable local caches, not app data, and may be deleted before a deliberately fresh
  scrape.

**Verified:**

- `npm run scrape:pets -- --names="Jimmy The Eye|Red Imp|War Wolf" --fresh` → passed, wrote 221 pets.
- Pet audit → 6 pure-medal methods across Jimmy The Eye, Red Imp, and War Wolf; 0 misclassified.
- Cross-category raw JSON audit → Consumables and pets clean; accessories still have 60 stale
  pure-medal merge methods and weapons still have 56, both expected until their pending full
  re-scrapes. Shared loader repair normalizes those in-app.
- `node scripts/validate-pets.mjs` → passed, 221 entries.
- `node scripts/validate-class-abilities.mjs` → passed, 54 entries.
- `npm run lint` → passed.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/verify-datasets.mjs` → passed for accessories, weapons, pets/guests.
- `npm run build` → passed.
- `python3 mdlint.py AGENTS.md docs/context/scraper_operations.md` → 0 findings.

**Not verified / known gaps:**

- No broad accessories or weapons scrape was run. Raw accessory/weapon JSON remains stale for
  pure-medal methods until the user runs the existing full re-scrape backlog commands.
- `src/data/pets-progress.json` and `src/data/guests-progress.json` remain local gitignored caches and
  are not meant to be committed.

**Next agent should:**

- Ask the user to spot-check Jimmy The Eye, Red Imp, and War Wolf for DM pill / no Merge Required,
  then continue with the Classes subtype parser or the pending accessories/weapons full-scrape backlog.

### 2026-08-24 — Shared DM versus merge classification and Consumables audit

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up data-rule polish on Classes / Abilities Consumables

**Changed:**

- `src/utils/variantHelpers.ts`, `scripts/lib/access-flag-repair.ts`, `scripts/scrape-guests.ts`, and
  `scripts/scrape-classes.ts`: pure `Required Items: Defender's Medal` obtain methods now classify as
  `priceType: "dm"` instead of `merge`; shared scraper price/access helpers now apply this rule
  across categories that use them.
- `src/types/classAbility.ts`, `src/hooks/useClassAbilities.ts`,
  `src/components/classAbilities/ClassAbilityDetail.tsx`, and `src/utils/dataLoaders.ts`: single
  Consumables now use the same computed `hasMerge` field as families, and stale serialized medal-only
  merge methods are repaired on load. Class Ability raw tags are also normalized on load so forum
  chrome labels are not indexed for search.
- `scripts/scrape-classes.ts`: future Class Ability scrapes whitelist real encyclopedia tags and drop
  forum UI labels like `quantcast`, `sendprivatemessage`, and `hottopicnewmessages`.
- `src/types/item.ts`, `docs/context/data_reference.md`, `docs/context/category_playbooks.md`, and
  `docs/context/scraper_operations.md`: documented that pure Defender's Medal required-item methods
  are DM methods, not Merge Required methods.

**Verified:**

- Post-user-rescrape audit of `src/data/class-consumables.json` → 54 entries, 12 families, 42 singles,
  24 pure-medal required-item methods, 0 missing effects, 0 Merge Required methods, 0 boilerplate
  tails, 0 duplicate `+` standalone entries, 14 dialogue entries, 50 effect-type entries.
- Affected entries: Baked Basilisk, Cocoaberry Juice, Fried Zard Legs, Gorillaphant Knuckles, Green
  Fruit, Humapple Stew, Instant Pierogi, Moglinberry Candy, Peculiar Pellets, Purple Fruit, Raven's
  Wings, Red Fruit, Rotten Hardtack, Seaweed, Yellow Fruit, Zard Burgers, Zard Tartare, Zard-Kebobs,
  Zardcakes.
- Seasonal entries present: Cocoaberry Juice, Fried Zard Legs, Zard Burgers, Zard Tartare, Zard-Kebobs,
  Zardcakes.
- Consumable kind counts: Dust 6, Food 45, Rune 1, none 2 (Health Potion and Mana Potion).
- `npm run lint` → passed.
- `npm run typecheck:scripts` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 54 entries across 2 subtypes.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/verify-datasets.mjs` → passed for accessories, weapons, pets/guests.
- `npm run build` → passed.
- `python3 mdlint.py AGENTS.md docs/context/data_reference.md docs/context/category_playbooks.md` → 0
  findings.

**Not verified / known gaps:**

- Current raw `src/data/class-consumables.json` still contains stale forum-chrome tags because the
  user's full scrape completed before the tag whitelist landed. The app normalizes them away at load
  time; the next full Consumables scrape will rewrite the file cleanly.

**Next agent should:**

- If the user wants the raw JSON cleaned of forum chrome tags, hand over
  `npm run scrape:classes -- --subtype=consumable --fresh`; otherwise continue with the Classes subtype
  parser.

### 2026-08-24 — Consumable dialogue inner-label cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities Consumables

**Changed:**

- `scripts/scrape-classes.ts`: future Consumables scrapes no longer emit a generic inner `Dialogue`
  heading when a dialogue section has only quote text and no real prompt/context heading.
- `src/components/classAbilities/ClassAbilityDetail.tsx`: existing stale dialogue strings beginning
  with `Dialogue` followed by a quote block are normalized at render time, removing the redundant
  bullet without requiring another scrape.
- `docs/context/category_playbooks.md`: documented that the card title supplies the generic Dialogue
  label and scrapers should not duplicate it inside the card.

**Verified:**

- `node scripts/validate-class-abilities.mjs` → passed, 54 entries across 2 subtypes.
- `npm run lint` → passed.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run build` → passed.
- `mdlint.py AGENTS.md docs/context/category_playbooks.md` → 0 findings.

**Not verified / known gaps:**

- No browser visual spot-check was run for a simple quote-only Dialogue card such as Cheese Soup.

**Next agent should:**

- Ask the user to spot-check Cheese Soup or Bull Fish Rice to confirm the inner `Dialogue` bullet is
  gone, then proceed to the pending Classes subtype parser if Consumables look good.

### 2026-08-24 — Consumable dialogue ordering and post-scrape audit

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities Consumables

**Changed:**

- `src/components/classAbilities/ClassAbilityDetail.tsx`: moved the Consumable `Dialogue` card to
  render after How to Obtain and immediately before Other Information.
- `docs/context/category_playbooks.md` and `docs/context/ui_patterns.md`: updated Consumable detail
  order documentation to place Dialogue before Other Information.

**Verified:**

- Post-user-rescrape audit of `src/data/class-consumables.json` → 54 Consumables, 14 dialogue-bearing
  entries, 50 effect-type-bearing entries, and 0 entries missing effects.
- Dialogue entries found: Banana Slice, Bull Fish Rice, Cheese Soup, Crab Cake, Dried Figs, Fish
  Fingers, Fresh Apple, Fried Rice, Ham n Turkey sammich, Hectopump, Mysterious Liquid, Ninja
  Starfish, Smallmouth Bass, Spellberries.
- `node scripts/validate-class-abilities.mjs` → passed, 54 entries across 2 subtypes.
- `npm run lint` → passed.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run build` → passed.
- `mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/ui_patterns.md` → 0 findings.

**Not verified / known gaps:**

- No browser visual spot-check was run after moving Dialogue below How to Obtain.

**Next agent should:**

- Ask the user to spot-check the 14 dialogue entries above, especially Spellberries and Banana Slice,
  then proceed to the pending Classes subtype parser if those look good.

### 2026-08-24 — Consumable dialogue parsing

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** Full Consumables re-scrape remains To Do

**Changed:**

- `scripts/scrape-classes.ts`: Consumables now parse optional dialogue text between `Level:` and
  `Effect:` / `Effects:` into a separate `dialogue` field, stripping repeated item-name prompt labels
  and `OK` button lines. Dialogue cue headings (`Upon...:` / `If...:`) are excluded from item-title
  splitting so they do not break effect parsing. Spellberries' `Effects:` line is now captured.
- `src/types/item.ts`, `src/types/classAbility.ts`, `src/components/classAbilities/ClassAbilityDetail.tsx`,
  and `src/hooks/useClassAbilities.ts`: `dialogue` is supported on singles, shared family data, and
  variants; detail pages render a separate `Dialogue` card with shared quote-box styling, and search
  indexes dialogue text.
- `src/data/class-consumables.json`: targeted refresh of `Spellberries` and `Banana Slice` wrote
  dialogue snippets plus effect/effect type data.
- `docs/context/category_playbooks.md`, `docs/context/data_reference.md`,
  `docs/context/scraper_operations.md`, and `docs/context/ui_patterns.md`: documented dialogue source
  range, cleanup rules, storage, and UI placement.

**Verified:**

- `npm run scrape:classes -- --subtype=consumable --names="Spellberries|Banana Slice"` → passed,
  wrote 54 entries.
- JSON spot-check → Spellberries effect `Stuffed for 6 turns, INT +15 for 4 turns.`, effect type
  `INT`, and four cleaned dialogue sections; Banana Slice effect type `DEX` and two cleaned dialogue
  sections.
- `node scripts/validate-class-abilities.mjs` → passed, 54 entries across 2 subtypes.
- `npm run lint` → passed.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run build` → passed.
- `mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/data_reference.md docs/context/scraper_operations.md docs/context/ui_patterns.md`
  → 0 findings.

**Not verified / known gaps:**

- No broad Consumables scrape was run by the agent. Dialogue/effect fixes are populated only for
  `Spellberries` and `Banana Slice` until the user runs the full Consumables refresh.
- No browser visual spot-check was run for the Dialogue card.

**Next agent should:**

- After the user runs `npm run scrape:classes -- --subtype=consumable --fresh`, spot-check
  Spellberries, Banana Slice, Health Potion, Mana Potion, and a few newly populated effect-type rows
  under STR/DEX/Boost/All Resist/Utility.

### 2026-08-24 — Potion-only consumable effect accordion

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities Consumables

**Changed:**

- `src/components/classAbilities/ClassAbilityDetail.tsx`: Consumable effect accordions are now gated
  to Health Potion and Mana Potion only. Every other Consumable renders the original plain `Effect`
  card even if scraped data has image/attack-style metadata.
- `docs/context/category_playbooks.md` and `docs/context/ui_patterns.md`: documented that the
  attack-style effect accordion is potion-only for Consumables.

**Verified:**

- `node scripts/validate-class-abilities.mjs` → passed, 54 entries across 2 subtypes.
- `npm run lint` → passed.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run build` → passed.
- `mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/ui_patterns.md` → 0 findings.

**Not verified / known gaps:**

- No browser visual spot-check was run for a non-potion Consumable effect card.
- Full Consumables re-scrape for effect types remains user-run and pending.

**Next agent should:**

- After the user runs the full Consumables refresh, spot-check Health/Mana Potion accordions plus one
  ordinary Consumable with `Effect Type:` to confirm it uses the plain Effect card.

### 2026-08-24 — Consumable effect type metadata

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** Full Consumables re-scrape → To Do

**Changed:**

- `scripts/scrape-classes.ts`: Consumables now fetch the sorted effects page (`fb.asp?m=22304644`)
  and attach optional `effectType` metadata from bold/underlined headings only. Parser ignores
  structural headings such as `Contents`, `Legend`, and A-Z navigation headings; unlisted
  Consumables keep `effectType` unset.
- `src/types/item.ts`, `src/types/classAbility.ts`, `src/components/classAbilities/ClassAbilityDetail.tsx`,
  and `src/hooks/useClassAbilities.ts`: `effectType` is supported on Classes / Abilities singles,
  shared family data, and variants; detail pages render `Effect Type: ...` under the description and
  search indexes effect type text.
- `src/data/class-consumables.json`: targeted refresh of `Black Stardust (E: Boost)` and
  `Blue Stardust (Bonus)` verified written `effectType` values (`Boost`, `Bonus`).
- `docs/context/category_playbooks.md`, `docs/context/data_reference.md`,
  `docs/context/scraper_operations.md`, and `docs/context/ui_patterns.md`: documented Consumable
  effect-type source, exclusions, storage, and UI placement.

**Verified:**

- Read-only heading audit for `fb.asp?m=22304644` → real effect headings start at `STR`, `DEX`,
  `INT`, `LUK`, `END`, `WIS`, `Boost`, etc.; `Contents` and `Legend` excluded.
- `npm run scrape:classes -- --subtype=consumable --limit=5` → dry-run parsed 5 entries without
  writing.
- `npm run scrape:classes -- --subtype=consumable --names="Black Stardust (E: Boost)|Blue Stardust (Bonus)"`
  → passed, wrote 54 entries.
- JSON spot-check → Black Stardust effect type `Boost`; Blue Stardust effect type `Bonus`.
- `node scripts/validate-class-abilities.mjs` → passed, 54 entries across 2 subtypes.
- `npm run lint` → passed.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run build` → passed.
- `mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/data_reference.md docs/context/scraper_operations.md docs/context/ui_patterns.md`
  → 0 findings.

**Not verified / known gaps:**

- No broad Consumables scrape was run by the agent. Only the two sample entries currently have fresh
  `effectType` data; the user needs to run `npm run scrape:classes -- --subtype=consumable --fresh`
  to populate all Consumables.
- No browser visual spot-check was run for the new `Effect Type:` line.

**Next agent should:**

- After the user runs the full Consumables refresh, audit effect-type counts and spot-check entries
  under STR/DEX/Boost/All Resist/Utility before moving to the Classes subtype parser.

### 2026-08-24 — Potion effect icons and consumable kind pills

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities Consumables

**Changed:**

- `scripts/scrape-classes.ts`: Health Potion and Mana Potion now use deterministic DF-Pedia skill
  button images (`Skill-HP.png` / `Skill-MP.png`) instead of the generic forum inline image. Potion
  effect accordions no longer duplicate the top-level potion description, and standalone
  `Appearance` hotlink captions are stripped from Other Information.
- `src/data/class-consumables.json`: targeted refresh of only Health Potion and Mana Potion wrote the
  corrected button image URLs and cleaned attack payloads.
- `src/utils/classAbilityPills.ts`, `src/pages/ClassAbilityListPage.tsx`, and
  `src/components/classAbilities/ClassAbilityCard.tsx`: Dust/Food/Rune pills now share one metadata
  source, keep their kind colour in the neutral filter state, add the gold ring when selected, and
  appear on Consumable gallery cards.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`, and
  `docs/context/ui_patterns.md`: documented the deterministic potion icons, Appearance-note cleanup,
  and Consumable kind pill treatment.

**Verified:**

- `npm run scrape:classes -- --subtype=consumable --names="Health Potion|Mana Potion"` → passed,
  wrote 54 Consumable entries.
- JSON spot-check → Health Potion uses `Skill-HP.png`, Mana Potion uses `Skill-MP.png`, neither
  effect attack carries duplicated `description` text, and neither entry has stray `Appearance` notes.
- `node scripts/validate-class-abilities.mjs` → passed, 54 entries across 2 subtypes.
- `npm run lint` → passed.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run build` → passed.
- `mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/scraper_operations.md docs/context/ui_patterns.md`
  → 0 findings.

**Not verified / known gaps:**

- No browser visual spot-check was run for the Consumables filter/card pills.
- Classes subtype data/parser remains pending.

**Next agent should:**

- Browser spot-check Health Potion, Mana Potion, and one Dust/Food/Rune Consumable card/filter row,
  then continue the pending Classes subtype parser if the UI looks correct.

### 2026-08-24 — Consumables potion supplement and variant edge cases

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities Consumables

**Changed:**

- `scripts/scrape-classes.ts`: Consumables scrape now appends supplemental Health Potion (`m=4159197`)
  and Mana Potion (`m=4159198`) entries because they are absent from the A-Z listing. The scraper
  parses their effect, requirements, mana/cooldown/type/element metrics, skill button image,
  Appearance image, notes, and mutual Also See refs into the shared attack-style display shape.
- `scripts/scrape-classes.ts` and `src/utils/dataLoaders.ts`: Defender's Medal is now method-specific
  for Consumables instead of bleeding from page/listing tags onto every obtain method. This fixes
  `Cocoaberry Juice` as `1` / `1 (DM)`.
- `src/utils/variantHelpers.ts`: title-driven variant condensation now treats hyphen/space-only
  differences as the same base, allowing `Zard-Kebobs` / `Zard Kebobs+` to display `(Base)` / `+`
  while preserving original source titles.
- `src/hooks/useClassAbilities.ts`: Consumables inferred Also See now uses a consumable-specific
  relaxed obtain fingerprint that trims item-specific final shop-selection steps, plus a lower
  same-subtype name threshold. Earlier same-shop spot-check groups (`Baked Basilisk`,
  `Moglinberry Candy`, `Mushroom Cider`) were confirmed by the user as correctly non-seasonal.
- `src/types/classAbility.ts` and `src/components/classAbilities/ClassAbilityDetail.tsx`: Class
  Ability detail pages can render potion effect blocks with the shared `GuestAttacks` accordion.
- `scripts/validate-class-abilities.mjs`: Health/Mana Potion are allowed to omit Dust/Food/Rune kind.
- `src/data/class-consumables.json` and `src/data/class-abilities-manifest.json`: targeted refresh
  wrote 54 Consumables including Health/Mana Potion.
- `docs/context/data_reference.md`, `docs/context/category_playbooks.md`,
  `docs/context/scraper_operations.md`, and `docs/context/ui_patterns.md`: documented supplemental
  potion entries, potion effect-image display, and consumable relaxed Also See rules.

**Verified:**

- Targeted scrape:
  `npm run scrape:classes -- --subtype=consumable --names="Health Potion|Mana Potion|Cocoaberry Juice|Zard-Kebobs"`
  → wrote 54 consumable entries.
- Data audit → Health/Mana have mutual `class-ability-*` Also See slugs and button/Appearance image
  data; Cocoaberry's free method has no DM flag while its merge method has DM.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run build` → passed, including validators, dataset verification, script typecheck, and
  production bundle.

**Not verified / known gaps:**

- The updated Also See rendering was not browser spot-checked; build/type checks and data audits
  passed.
- The earlier proposed same-shop spot-check groups were too broad. Better next spot checks are the
  Health/Mana mutual explicit link and Zard/Stardust-style inferred groups.

**Next agent should:**

- Browser spot-check `Health Potion`, `Mana Potion`, `Cocoaberry Juice`, `Zard-Kebobs`, and one
  Stardust/Zard inferred Also See group before moving to the Classes subtype parser.

### 2026-08-24 — Consumables seasonal, shared effect, and inferred Also See

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities Consumables

**Changed:**

- `scripts/scrape-classes.ts`: Consumables seasonal detection now combines A-Z listing tag
  images/labels, literal listing text such as `Seasonal`, and detail-post `/tags/Seasonal.jpg`
  images. Future scrapes also promote one shared family effect when every variant has the same
  effect, or when the only effect appears as a trailing single-thread shared block.
- `src/utils/dataLoaders.ts`: current/stale Class Ability JSON gets the same shared-effect repair at
  load time while retaining distinct per-variant effects when variants explicitly differ.
- `src/hooks/useClassAbilities.ts` and `src/components/classAbilities/ClassAbilityDetail.tsx`:
  Consumables now use the shared related-items hook for explicit/reverse Also See plus conservative
  same-subtype inferred links from matching obtain fingerprints and near-identical names. Detail
  pages render Also See below Sources.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`, and
  `docs/context/ui_patterns.md`: documented detail-post seasonal tag detection, shared Consumable
  effect rules, and Consumables inferred Also See behavior.
- `AGENTS.md`: corrected Classes / Abilities and total dataset counts after the user's deduped
  Consumables scrape.

**Verified:**

- Current `class-consumables.json` audit → 52 entries, 0 existing seasonal entries; likely seasonal
  candidates in current stale data include `Baked Basilisk`, `Moglinberry Candy`, and
  `Mushroom Cider`.
- Current same-obtain audit surfaced likely inferred Also See spot-check groups:
  `Bull Fish Rice` / `Cheese Soup` / `Fried Rice`, and `Crab Cake` / `Hectopump` /
  `Ninja Starfish` / `Smallmouth Bass` / `Syringe Beta`.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run build` → passed, including validators, dataset verification, script typecheck, and
  production bundle.

**Not verified / known gaps:**

- No scrape was run by the agent. Seasonal flags that only exist on forum listing/detail pages will
  not appear in raw JSON until the user runs
  `npm run scrape:classes -- --subtype=consumable --fresh`.
- The inferred Also See links were wired and type/build checked, but not browser spot-checked.

**Next agent should:**

- Ask the user to fresh-scrape Consumables, then verify Seasonal pills/filters and the inferred Also
  See groups above in the browser before moving on to the Classes subtype parser.

### 2026-08-24 — Consumables row clears, dedupe, and DM variants

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities Consumables

**Changed:**

- `src/pages/ClassAbilityListPage.tsx`: each filter row now has its own inline `Clear filters`
  control for that row's include/exclude params.
- `src/utils/variantHelpers.ts`: same-label variants can now disambiguate on Defender's Medal access,
  so DA+DM branches such as `Seaweed` can show `(Base)` / `(Base) (DM)` rather than collapsing into
  indistinguishable labels.
- `src/utils/dataLoaders.ts`: class abilities are runtime-normalized to trim `< Message edited by...`
  and trailing `DF` note remnants, infer DM flags, move one trailing single-thread note block to
  shared family notes, and dedupe duplicate slug entries by preferring the non-`+` family display
  name.
- `scripts/scrape-classes.ts`: future Consumables scrapes normalize seasonal tag-image labels, set
  DM flags from Defender's Medal required-item text, trim edit/DF note remnants, move trailing
  single-thread notes to shared family notes, and dedupe base/`+` duplicate listing output by slug.
- `docs/context/category_playbooks.md`, `docs/context/ui_patterns.md`, and
  `docs/context/scraper_operations.md`: documented the per-row clear controls, seasonal tag parsing,
  base/`+` Consumables dedupe, and DM variant-label rules.

**Verified:**

- Current raw JSON has five duplicate Consumable slugs for base/`+` pairs:
  Fried Zard Legs, Zard Burgers, Zard-Kebobs, Zard Tartare, and Zardcakes. These are hidden at load
  time and will be removed from raw JSON by the next fresh scrape.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run build` → passed, including validators, dataset verification, script typecheck, and
  production bundle.

**Not verified / known gaps:**

- No scrape was run by the agent. The nav/segment manifest still reflects raw `57` Consumables until
  the user runs `npm run scrape:classes -- --subtype=consumable --fresh`, after which deduped count
  should be written into `class-abilities-manifest.json`.
- Optional `tsx` smoke test for Seaweed labels failed due a local sandbox IPC `EPERM`, so label
  behaviour was verified by type/build coverage rather than a direct helper printout.

**Next agent should:**

- Ask the user to fresh-scrape Consumables when ready, then verify the manifest count, seasonal tags,
  and Seaweed `(DM)` variant label in the browser.

### 2026-08-24 — Consumables filters, DM repair, and card cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities Consumables

**Changed:**

- `src/pages/ClassAbilityListPage.tsx`: added `DM` to Classes / Abilities access filters and moved
  Dust/Food/Rune into a separate compact Level 3-style row after category filters, with distinct
  Dust/Food/Rune tones.
- `src/components/classAbilities/ClassAbilityCard.tsx`: gallery cards now use compact `DA`, show
  `DM` when repaired flags indicate Defender's Medal requirements, and no longer show `Multiple
  Versions`, `Merge Required`, `Effect`, or current-Consumables `Temp` pills.
- `src/components/classAbilities/ClassAbilityDetail.tsx`: Consumables omit Level, show standalone
  `Rarity` metadata before How to Obtain, show `DM` in the header, and suppress the ubiquitous Temp
  header pill for Consumables.
- `src/utils/dataLoaders.ts`: current class-ability JSON is normalized at load time to infer
  `dmRequired` / `hasDM` from Defender's Medal text and trim trailing `DF` boilerplate from notes.
- `scripts/scrape-classes.ts`: future Consumables scrapes set per-method and family-level DM flags
  from Defender's Medal text and strip trailing `DF` note remnants.
- `src/components/shared/TriStateFilterPill.tsx`: active `DM` access filters use the shared DM tone,
  matching the existing DC special case.
- `docs/context/category_playbooks.md` and `docs/context/ui_patterns.md`: documented the Consumables
  Level 3 kind row, omitted current Temp/Effect gallery pills, level omission, standalone rarity, and
  shared card-gallery access-pill rules.

**Verified:**

- Data audit after user re-scrape: 57 Consumable families / 74 variants; kind split is 67 Food, 6
  Dust, 1 Rune; all variants are level `1`; `Instant Pierogi` is the only non-`N/A` price; raw JSON
  has two trailing `DF` note remnants that are now repaired at load time and in future scrapes.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run build` → passed after the UI/data-loader changes.
- `node scripts/validate-class-abilities.mjs` → passed after the final scraper flag patch.
- `mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/ui_patterns.md docs/context/scraper_operations.md`
  → 0 findings.

**Not verified / known gaps:**

- No scrape was run by the agent. Current JSON is runtime-repaired for DM and trailing `DF`; a future
  user-run Consumables scrape will write those fixes directly into `class-consumables.json`.
- Eight Consumable variants currently lack parsed effects/rarity in the raw JSON and need forum
  spot-checking before deciding whether that is source-accurate or another parser gap.

**Next agent should:**

- Spot-check the eight Consumables with missing effects/rarity, then continue the Classes subtype
  parser if the Consumables page looks correct.

### 2026-08-24 — Consumables parser and detail layout fixes

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities Consumables

**Changed:**

- `scripts/scrape-classes.ts`: Consumables listing now skips the non-entry headings `Alphabetical
  Consumables Listing` and `Consumables Sorted by Effects`, maps A-Z `[D]` / `[F]` / `[R]` prefixes
  to Dust/Food/Rune, falls back to detail-page `Item Type`, parses both `Effect:` and `Effects:`,
  and scopes Other Information to the current item block instead of the whole forum page.
- `src/components/classAbilities/ClassAbilityDetail.tsx`: Consumables effects now render immediately
  below the selector. Obtain cards hide the price/sellback grid when every method is empty or `N/A`,
  while preserving real price exceptions.
- `src/components/shared/ObtainSection.tsx` and `src/components/shared/ObtainVariantCard.tsx`: added
  a reusable price/sellback visibility prop for category-specific empty-field suppression.
- `scripts/validate-class-abilities.mjs`: validator rejects scraped heading rows and, once refreshed
  kind data exists, enforces Dust/Food/Rune kind coverage.
- `docs/context/category_playbooks.md` and `docs/context/scraper_operations.md`: documented the
  Consumables heading skip, `[D]/[F]/[R]` kind parsing, `Item Type` fallback, effect-label variants,
  and conditional price display.

**Verified:**

- Local data audit before scraper refresh: 57 Consumable families / 74 variants; no heading rows in
  current JSON; every variant level is `1`; sellback is empty everywhere; `Instant Pierogi` is the
  only variant with a non-`N/A` price; rarity is `2` where present, but 8 current stale variants lack
  rarity.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run build` → passed, including validators, dataset verification, script typecheck, and
  production bundle.
- `mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/scraper_operations.md` → 0
  findings.

**Not verified / known gaps:**

- No broad scrape was run by the agent. `class-consumables.json` is stale for Dust/Food/Rune kind
  fields and may be stale for effects/rarities until the user runs
  `npm run scrape:classes -- --subtype=consumable --fresh`.

**Next agent should:**

- After the user refreshes Consumables, re-run the data audit for kind coverage, missing effects,
  non-`N/A` prices, and rarity.

### 2026-08-24 — Classes sidebar and subtype copy polish

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** no board item moved; follow-up polish on Classes / Abilities starter

**Changed:**

- `src/components/layout/Navigation.tsx`: Classes / Abilities is now marked available in the desktop
  sidebar and displays the class-abilities manifest count.
- `src/types/classAbility.ts`: added one shared forum-sourced Classes / Abilities description and
  reused it for both the `Classes` and `Consumables` subtype pages. The Consumables Temp-default note
  remains a separate secondary line.
- `docs/context/category_playbooks.md`: clarified that the forum-sourced Classes / Abilities
  description is used on subtype pages too.
- `AGENTS.md`: refreshed live dataset counts after the user-populated Consumables data was detected
  by validation.

**Verified:**

- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run build` → passed, including all validators, dataset verification, script typecheck, and
  production bundle.

**Not verified / known gaps:**

- No scrape was run by the agent. The Classes subtype parser/data remains pending.

**Next agent should:**

- Continue with `Complete Classes subtype scraper/data`, unless the user asks for more Consumables QA
  first.

### 2026-08-24 — Classes / Abilities starter and consumables scraper

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** Ship Classes / Abilities section → starter complete; remaining Classes parser
split into new To Do

**Changed:**

- `src/types/classAbility.ts`, `src/hooks/useClassAbilities.ts`,
  `src/components/classAbilities/*`, `src/pages/ClassAbilityListPage.tsx`, and
  `src/pages/ClassAbilityDetailPage.tsx`: added the Classes / Abilities section shell with
  single-select `Classes` / `Consumables` subtypes, data-driven tri-state filters, list/detail pages,
  shared obtain/effect/source/notes rendering, and browse back-link preservation.
- `src/App.tsx`, `src/pages/HomePage.tsx`, and `src/utils/dataLoaders.ts`: wired `/classes`,
  `/classes/:slug`, lazy dataset loading, manifests, and the forum-sourced home-page description.
- `scripts/scrape-classes.ts`: added a Consumables-first scraper for the A-Z listing
  (`fb.asp?m=22304639`) with `--subtype=consumable`, `--fresh`, `--limit`, and `--names`. It parses
  names/families, description, obtain methods, level, rarity, effect text, notes, Dust/Food/Rune
  tags, Temp defaults except Health/Mana Potion, and writes the class abilities manifest.
- `scripts/validate-class-abilities.mjs`, `package.json`, `scripts/lib/data-manifests.ts`, and
  datasets: added validation/build integration and `classes.json` / `class-consumables.json` assets.
- `docs/context/*`: documented Classes / Abilities subtype/filter rules, Consumables scrape commands,
  data files, and starter limitations.

**Verified:**

- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run validate` → passed all validators plus dataset verification and script typecheck.
- `npm run build` → passed production build.
- `python3 /Users/galen/.kiro/skills/global-project-orchestrator/references/mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/data_reference.md docs/context/project_structure.md docs/context/scraper_operations.md docs/context/ui_patterns.md`
  → 0 findings.

**Not verified / known gaps:**

- No scrape was run by the agent during that starter pass. The Consumables dataset has since been
  populated by a user-run scrape; Classes subtype data remains pending.
- The Classes subtype parser is not implemented yet; only the page shell and Consumables scrape path
  are ready.

**Next agent should:**

- Inspect the generated Consumables JSON and detail pages before starting the Classes subtype parser.

### 2026-08-24 — Backlog: default-weapon parsing audit added

**Agent:** orchestrator (Claude Opus 5) · **Commit(s):** the commit containing this entry
**Kanban moved:** new item added to `🔜 To Do` (no item completed)

**Changed:**

- `AGENTS.md`: added **Check and fix default-weapon scraping / parsing logic** to `To Do`, placed
  directly above the full weapons re-scrape and carrying the specific code locations and four
  concrete questions to settle. Marked the re-scrape as blocked on it, so the broad run happens once
  rather than twice.

**Verified:**

- Grounded the item in the actual code and data rather than restating the request. `default` is an
  established concept in `scripts/scrape-weapons.ts`: `isDefaultWeaponTitle` matches `(… Default)`,
  feeding `isDefault` plus a `'default'` entry in the `access` / `excludeAccess` filter unions in
  `src/types/weapon.ts`.
- Counted from the datasets: 232 weapon entries mention "default", 103 carry `isDefault: true`.
  Subtype split of the mentions: scythes 132, swords/axes/maces 59, staves/wands 23, daggers 18.
- Confirmed the unstripped-parenthetical case is real, with `ChickenBlade (ChickenCow Default)` and
  `Claws?? (Zardbie Default)` as live examples in `weapons-swords-axes-maces-a-g.json`.

**Not verified / known gaps:**

- Whether any of the four listed observations is actually a defect is **undetermined**. The
  parenthetical retention and the `free` pairing may both be intended; the item asks for a decision
  rather than asserting a bug.
- Duplicated same-level `levelVariants` names show up alongside these entries (e.g. two
  `ChickenBlade` levels). Not filed as part of this item because the same shape appears in accessories
  and is the documented base/DC split, but it is worth a glance during the audit.
- No code, scraper or dataset changes; backlog-only edit.

**Next agent should:**

- Either take the new default-weapon audit, or the full accessories re-scrape, which remains the top
  unblocked item and is human-run.

### 2026-08-24 — Close stale board items; commit and push accumulated multi-agent work

**Agent:** orchestrator (Claude Opus 5) · **Commit(s):** the commit containing this entry
**Kanban moved:** Re-scrape `Navigator's Hat` → Done · Multi-variant pets detection (Sprint 5) →
Done · `🚧 In Progress` now empty

**Changed:**

- `AGENTS.md`: both remaining stale items closed. Neither was incomplete work — the board was behind
  the data. `Navigator's Hat` alternating per-variant DA/DC obtain methods are the intended shape,
  confirmed manually by the user against the forum thread. Sprint 5 multi-variant pet detection was
  already shipped.
- `AGENTS.md` Active Project Status corrected against the manifests: Housing 608 → **623**
  (shrub 73→75, stuff 276→287, wall-item 191→193). Total dataset entries **4,963 → 6,978**; the old
  figure was wrong at any point in this history (the five manifest totals never summed to 4,963), so
  this is a correction of a long-standing error, not a delta.
- `AGENTS.md` status line no longer pins a commit SHA or a stale "unpushed" claim; it now states the
  deploy consequence instead. Current Focus item 3 (documentation modularization) removed as complete,
  and item 1 narrowed to the accessories/weapons passes that are genuinely outstanding.
- This commit also carries accumulated uncommitted work by other agents across this and prior sessions:
  housing effect-type parsing and normalization (`src/utils/housingNormalization.ts` new), cross-category
  War/WarLoot tag support across guests/accessories/weapons, pet card and image fixes, shared display
  and search fixes, and the matching `docs/context/` updates.

**Verified:**

- `npm run build` (= `npm run validate && tsc -b && vite build`) → full pass. Badges 161, pets 221,
  accessories 2602 across 8 subtypes / 10 files, weapons 3288 across 4 subtypes / 11 files, housing 623
  across 7 subtypes; cross-post-family invariants pass; `typecheck:scripts` clean; `vite build`
  succeeded, 181 modules.
- Sprint 5 closure sanity-checked against data, not just asserted: of 221 pet entries, 139 carry
  `levelVariants` and 82 do not, and **0** single-shape entries have more than one `obtainVariants`
  entry — i.e. nothing is leaking past the Sprint 5 target.
- Investigated tag `wat` (420 occurrences) as a possible corruption of the new `war` tag: it is the
  lowercase 3-letter element code for WATER and always co-occurs with element `WAT`. Not a bug.

**Not verified / known gaps:**

- The code changes in this commit were authored by other agents/sessions, not by this one. They are
  committed on the strength of the build gate and their own log entries below, not a line-by-line
  review by this agent.
- `Navigator's Hat` correctness rests on the user's manual forum verification. This agent only
  confirmed the on-disk shape (variants II-VI each carry one `daRequired` and one `dcRequired` method,
  none carrying both).
- Housing grew 608 → 623 through work this agent did not author; the provenance of the 15 new entries
  is recorded in the housing log entries below but was not independently re-derived.
- Pushed to `main`, which triggers a Vercel production deploy. Deploy outcome not verified by this
  agent.

**Next agent should:**

- Take the top `🔜 To Do` item, **Full accessories re-scrape**, and hand the command to the user to run
  — broad scrapes are human-run by rule.

### 2026-08-24 — Housing bogus effect type cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** Housing bogus effect type cleanup → Done

**Changed:**

- `scripts/scrape-housing.ts`: effect-type headings now reject one-letter A-Z values, preventing the
  sorted effects page's navigation anchors from being treated as compact effect types.
- `src/data/housing-rugs.json`, `src/data/housing-shrubs.json`, `src/data/housing-stuff.json`, and
  `src/data/housing-wall-items.json`: removed 457 bogus single-letter `effectType` values from the
  freshly scraped Housing data. Items such as `Hole in the ground` and `Sneak Attack Landscape` keep
  their item-specific `effect` text but no longer show an `Effect Type` line.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`, and
  `docs/context/data_reference.md`: documented that Housing `effectType` is optional even when
  `effect` exists, and must not be inferred from effect prose.

**Verified:**

- `rg -n '"effectType": "[A-Za-z]"' src/data/housing-*.json` → no remaining single-letter
  `effectType` values.
- Manual data check → `Hole in the ground` and `Sneak Attack Landscape` retain `effect` text and have
  no `effectType`.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run validate` → passed all validators plus dataset verification and script typecheck.
- `npm run build` → passed production build.
- `python3 /Users/galen/.kiro/skills/global-project-orchestrator/references/mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/data_reference.md docs/context/scraper_operations.md docs/context/ui_patterns.md`
  → 0 findings.

**Not verified / known gaps:**

- Did not re-scrape; this was a JSON cleanup plus future scraper guard.

**Next agent should:**

- Preserve the distinction between item-specific Housing `effect` and optional sorted-index
  `effectType` in future Housing scraper changes.

### 2026-08-24 — Housing effect type parser correction

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** Housing effect type parser correction → Done

**Changed:**

- `scripts/scrape-housing.ts`: tightened Housing effect type enrichment so `effectType` is assigned
  only from bold/underlined section headings in the sorted effects post (`fb.asp?m=21302559`). Detail
  prose such as Healing Pad's recovery text remains in `effect` and is no longer eligible to become
  the compact type.
- `src/components/housing/HousingDetail.tsx`: renders the compact metadata as `Effect Type: <type>`.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`,
  `docs/context/ui_patterns.md`, and `docs/context/data_reference.md`: documented that Housing
  effect types are heading-only add-on metadata, separate from item-specific effect text.

**Verified:**

- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run validate` → passed all validators plus dataset verification and script typecheck.
- `npm run build` → passed production build.
- `python3 /Users/galen/.kiro/skills/global-project-orchestrator/references/mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/data_reference.md docs/context/scraper_operations.md docs/context/ui_patterns.md`
  → 0 findings.

**Not verified / known gaps:**

- No Housing scrape was run. Existing Housing JSON will not show corrected compact effect types until
  the user refreshes `rug`, `shrub`, `stuff`, and `wall-item`.

**Next agent should:**

- After the user refreshes those subtypes, inspect Healing Pad for `Effect Type: Heal` while keeping
  the full effect card text as the item-specific recovery description.

### 2026-08-24 — Housing effect type metadata

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** Housing effect type metadata → Done

**Changed:**

- `scripts/scrape-housing.ts`: added scrape-time Housing effect type enrichment from
  `https://forums2.battleon.com/f/fb.asp?m=21302559`; effect-bearing subtypes fetch the sorted
  effects index and attach `effectType` to single entries and family variants.
- `src/types/housing.ts` and `src/types/item.ts`: added optional Housing `effectType` fields.
- `src/components/housing/HousingDetail.tsx`: renders compact `Effect Type: <type>` metadata below the
  description, matching the trinket effect-type placement/typography.
- `src/hooks/useHousing.ts`: includes Housing `effectType` in list search text.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`,
  `docs/context/ui_patterns.md`, and `docs/context/data_reference.md`: documented the effect-type
  source, display rule, and refresh commands.

**Verified:**

- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run validate` → passed all validators plus dataset verification and script typecheck.
- `npm run build` → passed production build.
- `python3 /Users/galen/.kiro/skills/global-project-orchestrator/references/mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/data_reference.md docs/context/scraper_operations.md docs/context/ui_patterns.md`
  → 0 findings.

**Not verified / known gaps:**

- No Housing scrape was run. Existing Housing JSON will not show compact effect-type metadata until
  the user refreshes `rug`, `shrub`, `stuff`, and `wall-item`.

**Next agent should:**

- After the user runs the four Housing scrape commands, inspect Armor Closet and the Snowglobe table
  entries for `Effect Type: Utility` / `Effect Type: Misc`.

### 2026-08-24 — Board update: full pets + guests re-scrapes recorded

**Agent:** orchestrator (Claude Opus 5) · **Commit(s):** `uncommitted`
**Kanban moved:** Full pets re-scrape → Done · Full guests re-scrape → Done (new line) ·
Re-scrape `Navigator's Hat` → stays in To Do, annotated

**Changed:**

- `AGENTS.md` only. No code, scraper, or dataset edits by this agent, and no scrape was run by this
  agent — the scrapes were run manually by the user, per the hard rule in
  `docs/context/scraper_operations.md`.
- Full pets re-scrape ticked and moved to Done under Scrapers & data pipeline.
- Full guests re-scrape added to Done as a new line. It had never been a tracked To Do item; the board
  only carried pets. Recorded rather than silently dropped.
- `Navigator's Hat` deliberately **not** ticked; annotated in place with the on-disk findings below.

**Verified:**

- `git status --porcelain` → `src/data/pets.json` and `src/data/guests.json` both modified, consistent
  with the reported re-scrapes.
- `node scripts/validate-pets.mjs` → `pets.json valid: 221 entries, all fields correct`.
- `node scripts/verify-datasets.mjs` → accessories 2602, weapons 3288, pets/guests 304; all
  family-capable datasets pass cross-post-family error invariants.
- `npm run typecheck:scripts` → clean. `npx tsc --noEmit -p tsconfig.json` → clean.
- `src/data/pets-guests-manifest.json` still reads 304 total / 221 pet / 83 guest, so Active Project
  Status counts needed no change.
- Investigated the tag `wat` appearing 420 times across datasets: it is the lowercase 3-letter element
  code for WATER (every occurrence co-occurs with element `WAT`), not a corruption of the new `war`
  WarLoot tag, which correctly appears twice on NAT-element entries. No bug.

**Not verified / known gaps:**

- **`Navigator's Hat` is unresolved.** `src/data/artifacts.json` is unchanged since `1d1f078`, so no
  re-scrape output landed for it. On disk, variants II-VI each carry two obtain methods — one
  `daRequired`, one `dcRequired` — and no single method carries both, so the DA-bleed fix appears to
  hold. Unexplained: variant I has no standalone DA method while II-VI do. Needs a forum-thread check.
- `src/data/housing-houses.json` and `src/data/housing-stuff.json` are also modified. Not attributable
  to the reported pets/guests scrapes and not covered by any board item; origin unconfirmed.
- This tree also contains substantial **uncommitted work by another agent** (GPT-5 Codex, the
  2026-08-24 War tag entry below) spanning scrapers, types, hooks, pages and `docs/context/`. The
  validators and typechecks above therefore cover a mixed changeset, not the scrape in isolation.
- Nothing committed or pushed in this turn; `origin/main` is still at `003f01b`.

**Next agent should:**

- Resolve the `Navigator's Hat` DA question against the forum thread, then either tick it or rewrite the
  item to describe the real remaining defect.

### 2026-08-24 — Cross-category War tag support

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** Cross-category War tag scraper support → Done

**Changed:**

- `scripts/scrape-guests.ts`: guest category detection now maps `tags/WarLoot.jpg` to `isWar` and
  adds a `war` search tag for standalone and family guest outputs.
- `scripts/scrape-accessories.ts`: accessory tag parsing, sibling enrichment, family construction,
  and family-to-entry conversion now preserve `isWar` / `war`.
- `scripts/scrape-weapons.ts`: weapon tag parsing, standalone entries, same-thread families,
  cross-post families, and family-to-entry conversion now preserve `isWar` / `war`.
- `src/pages/AccessoryListPage.tsx`, `src/pages/WeaponListPage.tsx`, `src/hooks/useAccessories.ts`,
  `src/hooks/useWeapons.ts`, and `src/hooks/usePets.ts`: War is now a data-driven Level 2 filter for
  accessories, weapons, pets, and guests when the loaded data contains `isWar`.
- `src/types/accessory.ts` and `src/types/weapon.ts`: added `isWar` and `war` category filter types.
- `docs/context/category_playbooks.md`, `docs/context/ui_patterns.md`, and
  `docs/context/scraper_operations.md`: documented that WarLoot applies to pets/guests/accessories/
  weapons, while badges and housing intentionally do not use WarLoot detection.

**Verified:**

- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `npm run validate` → passed all validators plus dataset verification and script typecheck.
- `python3 /Users/galen/.kiro/skills/global-project-orchestrator/references/mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/data_reference.md docs/context/scraper_operations.md docs/context/ui_patterns.md`
  → 0 findings.

**Not verified / known gaps:**

- No scrape was run. Existing guests/accessories/weapons JSON will only receive `isWar` after
  targeted or full user-run scrape refreshes.
- Image extractors for guests/accessories/weapons already skipped `/tags/` assets before this change;
  this pass added metadata/filter detection rather than changing their image skip rules.

**Next agent should:**

- Hand the user targeted/full scrape commands if they want current JSON refreshed with War flags.

### 2026-08-24 — Pet War tag and Rush of Zardlings image repair

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** Pet War tag and card pill bug batch → Done

**Changed:**

- `src/data/pets.json`: Rush of Zardlings level variants now use
  `https://i.imgur.com/J9cl6zX.png`; the family now has `isWar: true` and a `war` search tag.
- `scripts/scrape-pets.ts`: WarLoot tag art is excluded from pet main-image candidates and mapped to
  the pet `isWar` category flag/search tag across standalone and family scraper paths.
- `src/pages/PetsPage.tsx`, `src/hooks/usePets.ts`, `src/types/pet.ts`, and `src/types/item.ts`:
  added the data-driven War Level 2 category filter for pets.
- `src/utils/accessPillStyles.ts` and `src/components/pets/PetCard.tsx`: Free card pills now use the
  shared access-pill styling instead of bare green text/background classes.
- `docs/context/category_playbooks.md`, `docs/context/ui_patterns.md`,
  `docs/context/data_reference.md`, and `docs/context/scraper_operations.md`: documented War tag
  detection/filtering and the WarLoot image exclusion rule.

**Verified:**

- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `node scripts/validate-pets.mjs` → passed, 221 pet entries.
- `node scripts/verify-datasets.mjs` → passed for accessories, weapons, pets/guests.
- `npm run validate` → passed all validators plus dataset verification and script typecheck.
- `npm run build` → passed production build.
- `python3 /Users/galen/.kiro/skills/global-project-orchestrator/references/mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/data_reference.md docs/context/scraper_operations.md docs/context/ui_patterns.md`
  → 0 findings.

**Not verified / known gaps:**

- No scrape was run. Rush of Zardlings was patched directly in JSON because the user explicitly
  allowed a surgical amendment; future pet scrapes should preserve the fix through scraper logic.
- Other historical WarLoot-tagged pets, if any, still need a full/targeted pet scrape or inspection to
  receive `isWar`; `src/data/pets.json` currently had no remaining WarLoot image references.

**Next agent should:**

- Continue the existing multi-variant pets work unless the user wants a targeted pet scrape/audit for
  other WarLoot-tagged entries.

### 2026-08-22 — Housing quote, side-family, and search fixes

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `uncommitted`
**Kanban moved:** Housing and shared display bug batch → Done

**Changed:**

- `src/components/housing/HousingDetail.tsx`: Housing effect cards now preserve quote blocks for
  stale inline `quote:, ...` effects while keeping the intro as normal effect prose. Housing detail
  pages now pass shared/variant notes through the shared `OtherInformationSection` path.
- `src/utils/housingNormalization.ts` + `src/utils/dataLoaders.ts`: Housing data is normalized at
  load time for exact Left/Right/L/R side pairs within the same subtype. Existing side-family JSON
  such as Obsidian/Shapeless entries displays with clean family names and `L`/`R` variants without
  hand-editing scraped data. Conservative stale-note repair trims duplicated per-variant note groups
  when every variant contains the same group set.
- `scripts/scrape-housing.ts`: future Housing scrapes keep variant-local Other Information separate
  from trailing untitled shared notes, preserve quote/nested effect text, normalize side-pair
  families, and support targeted `--names=` refreshes with additive replacement semantics.
- Shared search paths now index detail-page subtext: badge notes; pet/guest release dates, variant
  descriptions, notes, and attacks; accessory variant text, trinket effect types, notes, and attacks;
  weapon release/special/note text; and housing effects/capacity/furnishing-slot/variant text.
- Scraper note parsers now opt into indentation-preserving structured text for badges, pets, guests,
  accessories, and weapons. Shared display text also cleans common Windows-1252 mojibake artifacts.
- `docs/context/category_playbooks.md`, `docs/context/ui_patterns.md`, and
  `docs/context/scraper_operations.md`: documented Housing side-pair rules, variant-specific notes,
  effect quote rendering, searchable sub-details, and `scrape:housing -- --names=...`.

**Verified:**

- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `node scripts/verify-datasets.mjs` → passed for accessories, weapons, pets/guests.
- `node scripts/validate-housing.mjs` → passed, 608 Housing entries.
- `npm run validate` → passed all validators plus dataset verification and script typecheck.
- `npm run build` → passed production build.
- `mdlint.py AGENTS.md docs/context/category_playbooks.md docs/context/scraper_operations.md docs/context/ui_patterns.md` → 0 findings.

**Not verified / known gaps:**

- No scrape was run per user instruction. Scraper fixes are code-ready, but raw JSON for affected
  entries remains stale until the user runs targeted/full refreshes.
- DA/DC obtain-pill correctness depends on `ObtainVariant.daRequired`, `dcRequired`, and `priceType`
  in JSON. The shared obtain-card display reads those fields correctly; incorrect raw flags require a
  targeted scraper refresh, not UI-only repair.
- A simple stale-data audit found badge notes with legacy ` • ` flattening; badge scraper output is
  fixed for future runs, but `badges.json` was not rewritten.

**Next agent should:**

- If the user wants JSON rewritten, hand over targeted Housing refresh commands first, e.g.
  `npm run scrape:housing -- --subtype=house --names="Villager Style"` after confirming a valid
  forum cookie in `.env`.

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
