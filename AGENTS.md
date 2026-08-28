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

**Last updated:** 2026-08-28
**Branch:** `main` · **Deploy:** Vercel auto-deploy on `main` — pushing to `main` ships to production

> Read the live HEAD with `git log --oneline -1` rather than trusting a SHA pinned here; commits that
> only sync this file would otherwise invalidate their own status line.
**Build gate:** `npm run build` = `npm run validate && tsc -b && vite build`

### Milestone: M5 — Content Breadth (in progress)

| Metric | Value |
| -------- | ------- |
| Shipped content sections | 6 of 10 |
| Total dataset entries | 7,048 (sum of the six `src/data/*-manifest.json` totals) |
| Badges | 161 |
| Pets / Guests | 304 (221 pets · 83 guests) |
| Accessories | 2,589 across 8 subtypes |
| Weapons | 3,288 across 4 subtypes / 11 shards |
| Housing | 623 across 7 subtypes |
| Classes / Abilities | 83 across 2 subtypes (Consumables + Armors populated) |

### Current Focus

1. **Propagate scraper fixes into stale datasets.** Weapons full pass is still outstanding (see
   Kanban). Pets, guests, and accessories have been completed.
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
      Miscellaneous parsing and Special Character tag detection still pending.

### ✅ Done

#### Content sections shipped

- [x] Badges section — `/badges`, 161 entries, 5 categories + subcategories, retired handling
- [x] Pets / Guests section — `/pets`, `/pets/:slug`, `/guests/:slug`, 304 entries
- [x] Accessories section — `/accessories`, 8 subtypes, 2,589 entries, A-L/M-Z shards for helms + capes
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
- [x] **Full accessories re-scrape** (2026-08-28, user-run + targeted agent repairs) — propagated
      variant-level descriptions, DA/DC access scoping, and shared variant-label fixes across 2,589
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

### 2026-08-28 — Family card description preview audit

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested scraper/UI audit

**Changed:**

- `src/utils/variantHelpers.ts`: `getFamilyCardDescription` now previews the first variant's
  description before falling back to `shared.description`, matching the shared card-gallery rule.
- `src/components/housing/HousingCard.tsx` and `src/components/classAbilities/ClassAbilityCard.tsx`:
  Housing and Classes / Abilities family cards now use the same shared helper already used by Pets /
  Guests, Accessories, and Weapons.
- `docs/context/data_reference.md` and `docs/context/ui_patterns.md`: clarified that family cards
  preview the first variant description while detail pages render the selected variant description.
- `scripts/scrape-pets.ts`: Roman/level pet access branches now store the level label plus access
  suffix directly (`I`, `I (DC)`) instead of `Normal` / `DC`, fixing Goldfish Knight after the fresh
  pets scrape. The same guard now covers same-thread, all-versions, and access-only family paths.
- `src/data/pets.json`: targeted refreshes repaired every remaining raw access-label pet family after
  the user's full pets scrape. Current pet family labels no longer store raw `Normal`, `DA`, `DC`, or
  `DA/DC` labels.
- `scripts/scrape-weapons.ts`: derived access-only weapon title differences such as `Arena Fighter
  Sword DA` are normalized to selector labels like `(DA)` instead of retaining bare `DA`; DA/DC/DM
  acronym casing is preserved during weapon title-token cleanup.
- `src/data/weapons-swords-axes-maces-a-g.json`, `src/data/weapons-staves-wands-a-g.json`, and
  `src/data/weapons-daggers-a-g.json`: targeted Arena Fighter refreshes populated the access-label
  fix in current weapon JSON.
- `docs/context/data_reference.md` and `docs/context/category_playbooks.md`: documented Goldfish
  Knight as the canonical Roman-tier + DC-branch pet label case and clarified that raw access-only
  labels must not be stored in family variant rows.
- `scripts/scrape-accessories.ts`: fixed scoped `--names` writes so a missing requested name in a
  selected subtype no longer prunes existing rows, and cross-post family refreshes keep unmatched
  siblings in the merge pool. Access parsing now allows DC methods to remain DA-required when the
  method's own block has a DA tag or DA requirement text.
- `scripts/lib/accessories/cross-post-family.ts`: tightened the Cider Keg / Void Cider Keg split so
  reused Void-shop titles do not bleed into the non-Void Cider Keg sources.
- `scripts/lib/access-flag-repair.ts`: shared access repair now considers variant-scoped
  descriptions/notes when deciding whether a DC method is also DA-required, fixing cases where the
  forum expresses DA requirement in the italic description rather than in the obtain line.
- `scripts/lib/accessories/cross-post-family.ts`: added scoped repairs for `Aye Pirate Scarf`,
  `Bearded Guardian Pirate Hat`, and `Cultist Hood` access branches; split `Cider Mug` /
  `Void Cider Mug`; the temporary hardcoded Golden Ring sibling link was removed in favor of shared
  inferred related-item matching.
- `src/utils/relatedItems.ts`: ordinal words such as `First`, `Second`, and `Third` are now ignored
  for related-name scoring, allowing same-obtain sibling sets like `First Golden Ring` through
  `Fifth Golden Ring` to link through the existing inferred `Also See` path.
- `scripts/lib/accessories/cross-post-family.ts`: added scoped non-helm/cape accessory
  consolidations for `Orion's Belt` and `Mazurek's Emerald Ring`, preserving level-ascending variant
  order while keeping accessory auto-promotion conservative outside helms and capes/wings.
- `src/components/shared/ObtainVariantCard.tsx`: shared obtain cards now also suppress the
  price/sellback grid when both values are zero-value currency strings such as `0 Gold`, `0 DC`, or
  `0 Defender's Medals`.
- `src/utils/variantHelpers.ts`: duplicate labels with different access flags now append the current
  row's full access signature, e.g. `Cunning (DA)` / `Cunning (DC)` and `Bubbly (DA)` /
  `Bubbly (DA, DC)`. Literal title-derived `Base` variants are no longer collapsed to the `(Base)`
  placeholder, fixing `Doom Harvester Wings` as `(Base)`, `Base`, `Foul`, `Noxious`. If every
  duplicate-label row is DA-required, the visible label omits redundant `DA`, so DA/DA+DC pairs show
  as `Bubbly` / `Bubbly (DC)`.
- `src/data/bracers.json`, `src/data/capes-wings-a-l.json`, `src/data/capes-wings-m-z.json`,
  `src/data/helms-a-l.json`, `src/data/helms-m-z.json`, and `src/data/rings.json`: targeted
  accessory refreshes repaired Azaveyran Farewell, Doom Harvester Wings, Cider/Void Cider Keg,
  Cider/Void Cider Mug, Aye Guardian Pirate Hat, Aye Pirate Scarf, Bearded Guardian Pirate Hat,
  Cultist Hood, Phoenix Doom, Royal Doom, Artix's Cape, Cysero's Gas-e Tank Mark, Scarred Dravir
  Wings, Ancient DragonLord Helm, Ring of Otherworld, Slugwrath Signet Ring, and refreshed the
  Golden Ring ordinal set after moving it to runtime inference. A follow-up targeted refresh
  consolidated Orion's Belt and Mazurek's Emerald Ring siblings into families.
- `docs/context/data_reference.md`, `docs/context/category_playbooks.md`,
  `docs/context/scraper_operations.md`, and `docs/context/ui_patterns.md`: documented DA+DC
  coexistence, scoped-refresh preservation, Doom Harvester's real `Base` variant, Cider split
  behavior, duplicate access-label display, the verified accessory missing-image placeholders, and
  accessory cross-post promotion stop conditions for different-form/different-image siblings such as
  Swordhaven Cape/Cloak, Crossbones Cap/Hat, Dread Pirate Hat/Mask, Obsidian Relic Helm/Visor, and
  Chaotic Cloak/Robes/Shroud/Spine.

**Verified:**

- Scraper audit → Accessories, Weapons, Pets, Guests, Housing, and Classes / Abilities all populate
  variant-level descriptions for family entries; Badges do not have itemfamily variants.
- Data audit → existing family JSON already contains variant descriptions across family-capable
  categories, though some current shared descriptions remain stale until broad user-run scrapes
  refresh the affected datasets.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `node scripts/verify-datasets.mjs` → passed.
- Category validators for pets, weapons, accessories, housing, and class abilities → passed.
- `npm run build` → passed production build and all validators.
- Targeted scrape `npm run scrape:pets -- --names='Goldfish Knight' --fresh --concurrency=1` →
  passed.
- Data audit → `Goldfish Knight` variants are `I`, `I (DC)`, `II`, `II (DC)`, `III`, `III (DC)`,
  `IV`, `IV (DC)`, `V`, `V (DC)`, `VI`, `VI (DC)`, `VII`, `VII (DC)`.
- Targeted pet refresh for all raw access-label families → passed; post-audit found 0 raw
  `Normal`/`DA`/`DC` labels, 0 bad Roman-case labels, 0 missing variant descriptions, and 0 non-DA
  pet variants carrying a Dragon Amulet description.
- Pirate Monkey regression audit → named ranks are preserved in stored labels (`Captain`,
  `Admiral`, `Fleet Captain`, `Fleet Commander`) while base repeated tiers remain level-labelled
  (`10`, `10 (DC)`, etc.); UI-level duplicate disambiguation is expected to add level context for
  repeated named ranks.
- Targeted weapon refresh for `Arena Fighter Sword`, `Arena Fighter Staff`, and `Arena Fighter
  Dagger` → passed; post-audit found no raw access labels in those refreshed rows.
- Targeted accessory refresh for the listed bracer/cape-wing/helm/ring families → passed.
- Data audit → Doom Harvester Wings variants are `(Base)`, `Base`, `Foul`, `Noxious`.
- Data audit → Azaveyran Farewell DC branches are DA+DC; Ancient DragonLord Helm I-III are DA+DC;
  Ring of Otherworld and Slugwrath Signet Ring have I as DC-only and II/III as DA+DC.
- Data audit → Cider Keg sources contain no Void Cider Keg links; Bubbly/Moglinberry each have DA
  and DA+DC rows. Void Cider Keg remains a separate linked family.
- Data audit → `Cider Mug` and `Void Cider Mug` are separate linked families; non-Void Cider Mug
  sources no longer include Void Cider Mug labels.
- Data audit → `Artix's Cape` level 70/80 DC branches are DA+DC while lower DC branches are DC-only;
  `Cysero's Gas-e Tank Mark` VIII-X and `Scarred Dravir Wings` V-VII are DA+DC, with earlier Roman
  variants DC-only.
- Runtime formatter audit → `Aye Pirate Scarf` labels resolve to normal/DC rows for
  Cunning/Swarthy/Foxy and DA/DC rows for Crafty/Brave; `Bearded Guardian Pirate Hat` labels resolve
  DA/DC rows for Cunning/Swarthy/Foxy/Crafty/Brave.
- Runtime formatter audit → `Cultist Hood` labels resolve to `(Base)`, `(Base) (DC)`, `Dark`,
  `Dark (DC)`, `Evil`, `Evil (DC)`, `Villainous`, `Villainous (DC)`, `Malicious`, `Foul`,
  `Foul (DC)`, `Doomed`, `Doomed (DC)`, `Brutal`, `Brutal (DC)`.
- Data audit → `Phoenix Doom` and `Royal Doom` variants are all DA+DC.
- Related inference audit → Golden Ring ordinal entries have no explicit stored `alsoSee`, while
  `First Golden Ring` infers `Second`, `Third`, `Fourth`, and `Fifth Golden Ring` through the shared
  same-obtain/name-similarity matcher.
- Shared related-name scoring now ignores ordinal words (`First` through `Tenth`); targeted ring
  refresh confirmed the Golden Ring JSON has no hardcoded `alsoSee` while runtime inference links the
  full ordinal set.
- Targeted accessory refresh for `Orion's Belt` and `Mazurek's Emerald Ring` family candidates →
  passed; `Orion's Belt` now has `(Base)`, `Planetary`, `Solar`, `Comet`, `Interstellar`,
  `Galactic`, `Universal`; `Mazurek's Emerald Ring` now has `Pinky`, `(Base)`, `Middle`, `Pointer`,
  `Thumb`; standalone siblings were removed as aliases.
- Runtime formatter audit → Aye Guardian labels resolve to `(Base)`, `Bold`, `Salty`,
  `Cunning (DA)`, `Cunning (DC)`, `Swarthy (DA)`, `Swarthy (DC)`, `Foxy (DA)`, `Foxy (DC)`,
  `Crafty (DA)`, `Crafty (DC)`, `Filthy`, `Wily`, `Brave (DA)`, `Brave (DC)`.
- Runtime formatter audit → Cider labels resolve to `(Base)`, `(Base) (DC)`, `Sweet`, `Sweet (DC)`,
  `Warm`, `Warm (DC)`, `Bubbly`, `Bubbly (DC)`, `Moglinberry`, `Moglinberry (DC)`.
- Runtime formatter audit → Azaveyran Farewell labels resolve to `I`, `I (DC)`, `II`, `II (DC)`,
  `III`, `III (DC)` while the table access columns still show DA on every row.
- Runtime formatter audit → Doom Harvester Wings labels resolve to `(Base)`, `Base`, `Foul`,
  `Noxious`.
- Accessory-wide audit → 1,192 families / 6,888 variant rows had 0 missing variant descriptions,
  0 raw access-only variant labels, and 0 non-DA variants carrying the Dragon Amulet requirement
  sentence.
- `node scripts/validate-accessories.mjs` → passed, 2,589 entries.

**Not verified / known gaps:**

- No broad scrapes were run by the agent. Accessories were user-run and then targeted-repaired by the
  agent; Weapons still need the pending user-run broad re-scrape for earlier parser fixes to
  propagate globally.
- A small number of current weapon scythe family variants still lack descriptions in existing JSON;
  this appears to be stale/partial scraped data rather than a shared UI issue.
- Existing weapon JSON may still have stale non-DA/DC variants whose descriptions mention Dragon
  Amulet requirements; the scraper-side variant-description fix is in place, but weapons need a
  user-run full re-scrape to propagate it globally.

**Next agent should:**

- Continue with the pending Weapons broad scrape handoff, or the Regular / Miscellaneous Classes
  parser work if the user prioritizes Classes / Abilities.

### 2026-08-27 — Default weapon access branches, pet descriptions, and shared obtain N/A suppression

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** `Check and fix default-weapon scraping / parsing logic` → `✅ Done`

**Changed:**

- `scripts/scrape-weapons.ts`: weapon obtain parsing now preserves full DA/DC/DM access signatures
  instead of only DC vs non-DC. DA+DC methods retain both flags, including single-title-block posts.
  Default weapons keep same-level access-specific branches as variants when they affect stats-table
  access display. `ChickenBlade (ChickenCow Default)` now produces `1`, `1 (DA)`, `1 (DA, DC)`,
  `1 (DC)`. Two-way default base/DC branches such as `Claws?? (Zardbie Default)` render `(Base)` /
  `(DC)`.
- `scripts/scrape-weapons.ts`: default weapon source labels now preserve the disambiguated forum
  family title without appending a repeated `xxx Default` suffix. `Pirate Blade (Pirate Default)` and
  `Dread Pirate Blade (Dread Pirate Default)` are kept separate, linked to each other via Also See,
  and no longer share family-level notes/descriptions.
- `scripts/scrape-pets.ts`: pet obtain branches now capture the branch-specific description directly
  above each Location block and store it on the corresponding variant. The parser no longer relies on
  the first/shared family description for normal/DA/DC pet branches.
- `src/hooks/usePets.ts` and `src/hooks/useWeapons.ts`: retired entries are now hidden from normal
  gallery counts/search results unless the Retired filter is explicitly selected, matching the shared
  all-category rule.
- `src/components/shared/ObtainVariantCard.tsx`: shared obtain cards suppress the price/sellback grid
  when both values are empty, `N/A`, or `None`, while still showing Required Items / Requires and any
  meaningful price or sellback that exists.
- `src/data/weapons-swords-axes-maces-a-g.json`, `h-n`, and `o-z`: targeted weapon refreshes updated
  ChickenBlade, Claws??, Pirate Blade, and Dread Pirate Blade.
- `src/data/pets.json`: targeted pet refresh updated Bonehead and Mr. Mangles after the
  variant-description parser fix.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`, and
  `docs/context/ui_patterns.md`: documented access-only default-weapon branch labels, pet/variant
  description scoping, retired-default filtering, and shared obtain-card N/A suppression.

**Verified:**

- Targeted scrape `npm run scrape:weapons -- --subtypes=sword-axe-mace
  --names='ChickenBlade (ChickenCow Default)|Claws?? (Zardbie Default)|Pirate Blade (Pirate
  Default)|Dread Pirate Blade (Dread Pirate Default)'` → passed.
- Targeted scrape `npm run scrape:weapons -- --subtypes=sword-axe-mace
  --names='Pirate Blade (Pirate Default)|Dread Pirate Blade (Dread Pirate Default)' --fresh` →
  passed.
- Targeted scrape `npm run scrape:pets -- --names='Bonehead|Mr. Mangles' --fresh --concurrency=1`
  → passed.
- Data audit → `ChickenBlade (ChickenCow Default)` variants are `1`, `1 (DA)`, `1 (DA, DC)`,
  `1 (DC)`; `Claws?? (Zardbie Default)` variants are `(Base)`, `(DC)`; Pirate/Dread Pirate
  source labels are clean and cross-linked; Bonehead normal/DC branches carry different descriptions.
- Runtime variant-label check → `Claws?? (Zardbie Default)` renders `(Base)`, `(DC)` in the shared UI
  formatter, while `ChickenBlade (ChickenCow Default)` still renders `1`, `1 (DA)`, `1 (DA, DC)`,
  `1 (DC)`.
- Default mention audit → current weapons still have 232 text mentions of `default` and 103 tagged
  default entries; sampled untagged mentions are incidental Also See links, image captions, or names
  such as `Default Dagger`, not missed `(… Default)` class-weapon markers.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run lint` → passed.
- `node scripts/validate-pets.mjs` → passed, 221 entries.
- `node scripts/validate-weapons.mjs` → passed, 3,288 entries across 4 subtypes / 11 data files.
- `node scripts/verify-datasets.mjs` → passed.
- `git diff --check` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- Full weapons scrape and full pets scrape were not run by the agent. The user should run broad
  scrapes manually if they want the parser fixes propagated beyond the targeted refreshed examples.
- Browser visual QA for the shared obtain-card N/A suppression was not run before this entry.

**Next agent should:**

- Hand the user the full weapons/pets scrape commands if they want the latest parser changes
  propagated globally, then inspect ChickenBlade, Claws??, Pirate/Dread Pirate, and a normal/DC pet.

### 2026-08-27 — Variant-scoped item descriptions

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; scraper bug fix requested during user-run accessories scrape

**Changed:**

- `scripts/scrape-accessories.ts`: accessory family enrichment now treats descriptions as
  variant-owned data. Sparse same-level variants may only borrow a description from a sibling with the
  same DA/DC/DM access signature. Expanding one forum post into multiple obtain branches now strips
  `This item requires a Dragon Amulet.` from non-DA/DC branches, fixing alternating DA/DC families
  such as `Navigator's Hat`.
- `scripts/lib/accessories/cross-post-family.ts`, `scripts/lib/cross-post-family.ts`, and
  `scripts/scrape-weapons.ts`: family/cross-post mergers now populate `shared.description` only when
  all variants agree, preventing first-variant description bleed across family-capable categories.
- `src/data/artifacts.json`: targeted `Navigator's Hat` refresh verified and populated the corrected
  DA/DC description split in the current accessory data.
- `docs/context/data_reference.md`, `docs/context/category_playbooks.md`, and
  `docs/context/scraper_operations.md`: documented variant-description scoping and the Navigator's
  Hat spot-check.

**Verified:**

- Targeted scrape `npm run scrape:accessories -- --subtypes=artifact --names="Navigator's Hat"` →
  passed.
- Data audit → `Navigator's Hat` DA variants II-VI keep the Dragon Amulet sentence; DC variants II-VI
  do not; `shared.description` is empty because variant descriptions differ.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/validate-accessories.mjs` → passed, 2,602 entries.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run lint` → passed.
- `git diff --check` → passed.
- `npm run build` → passed production build and all validators.

**Not verified / known gaps:**

- No broad accessories or weapons scrape was run by the agent. Any accessory JSON written before this
  fix may still carry stale variant descriptions until the user reruns the affected scrape(s).
- The targeted Navigator's Hat refresh ran against an already-dirty accessory JSON worktree from the
  user's in-progress rescrape; unrelated accessory JSON churn was not audited.

**Next agent should:**

- Ask the user to rerun the interrupted Accessories scrape from the beginning, then inspect
  Navigator's Hat and another alternating DA/DC family before moving on to the pending default-weapon
  audit.

### 2026-08-27 — Cross-category badge links move inline

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested cross-category link behavior change

**Changed:**

- `src/components/shared/InlineTextLinks.tsx`, `NotesList`, `PopupText`, and
  `OtherInformationSection`: added shared inline-link rendering for note prose while preserving
  bullet indentation, popups, and quote handling.
- `src/hooks/useBadgeRelations.ts`, `src/types/badgeRelation.ts`, and
  `scripts/generate-badge-relations.mjs`: changed badge-award relations from card data into compact
  inline-link data, including source-title aliases for consolidated itemfamilies.
- Badge, class-ability, accessory, weapon, and pet/guest detail pages: removed cross-category
  badge-award cards from `Also See`; same-category related cards remain unchanged. Badge pages now
  hotlink awarding item names inside obtain text/notes, while item pages hotlink badge names inside
  Other Information.
- Deleted the obsolete `RelatedLinkCard` and app-side `badgeAwardText` utility.
- `docs/context/ui_patterns.md`, `docs/context/category_playbooks.md`, and
  `docs/context/scraper_operations.md`: documented that cross-category badge-award relationships are
  inline links rather than `Also See` cards.

**Verified:**

- `npm run generate:badge-relations` → passed, 26 relation(s), now with aliases where available.
- Data audit → `ChaosWeaver`, `DoomKnight`, `GPS`, and `Time Walker` relation aliases look correct
  for consolidated armor families.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run lint` → passed.
- `git diff --check` → passed.
- `npm run build` → passed production build and all validators.
- Playwright local smoke test → Chaosweaver Armor note links `ChaosWeaver` to `/badges/chaosweaver`;
  ChaosWeaver badge obtain text links `Chaosweaver Armor` back to the class armor detail page; old
  cross-category card text is absent; no browser console errors.

**Not verified / known gaps:**

- Visual smoke covered the armor ↔ badge example only. Other badge-award categories use the same
  inline relation path but were not individually browsed.
- Existing large accessory JSON changes in the working tree were pre-existing/user-run data changes
  and were not inspected as part of this UI behavior change.

**Next agent should:**

- Continue with the pending accessories/weapons broad scrape handoff or Regular/Miscellaneous Classes
  parser work, depending on user priority.

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

> **Older entries (35 log entries, 2026-07-27 through 2026-08-25) archived to
> [`docs/context/handover-log-archive.md`](./docs/context/handover-log-archive.md)** to keep this
> file under 600 lines. Read that file only when investigating historical context — the entries above
> cover the current working session.
