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

**Last updated:** 2026-09-10
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

1. **Propagate scraper fixes into stale datasets.** Weapons full pass is still outstanding (see
   Kanban). Pets, guests, accessories, and Classes / Abilities have been completed.

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

### 🚧 In Progress

*(nothing in progress)*

### ✅ Done

*Latest five only. Older completed-task history lives in
[`docs/context/done-task-archive.md`](./docs/context/done-task-archive.md). Rotate at session
close, not after each individual task.*

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
- [x] Radix Tooltip on `AccessPills` — DA/DC/DM detail-page pills now carry accessible tooltips
      (keyboard focus, Escape, `aria-describedby`) spelling out the abbreviations, replacing the
      native `title`.

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

### 2026-09-03 — Reviewed accessory singular-sibling consolidation

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested accessory consolidation expansion

**Changed:**

- `scripts/lib/accessories/cross-post-family.ts`: added reviewed special-family specs for 20
  non-artifact accessory groups where singular sibling entries share obtain context, related names,
  descriptions, explicit/inferred Also See relationships, and clear variant-label segmentation. The
  new specs intentionally exclude Pets/Guests, Weapons, Housing, and Artifacts.
- `scripts/lib/accessories/cross-post-family.ts`: added a `singularOnly` guard for the new reviewed
  specs so existing itemfamilies are not folded into broader families.
- `scripts/lib/accessories/cross-post-family.ts`: removed the unclear `Star Ring` and `Seal Ring`
  singular-sibling specs and added stale-data unwind handling so those entries remain linked singles
  instead of awkward itemfamilies.
- `scripts/lib/accessories/cross-post-family.ts` and `src/data/rings.json`: added explicit mutual
  Also See link-only groups for `Star Ring` / `Starry Ring` / `Starlight Ring` and the reviewed
  non-consolidated `Seal Ring` singles.
- `scripts/lib/accessories/cross-post-family.ts`: preserve possessive variant names for the
  `Skullhelm` family (`Klatu's`, `Baradaa's`, `Nickto's`).
- `scripts/lib/accessories/cross-post-family.ts` and `scripts/lib/access-flag-repair.ts`: kept
  accessory cross-post family methods together as Method 1/2 rows instead of splitting gold/free and
  DC obtain methods into duplicate selector variants.
- `src/utils/imageLabels.ts`, `scripts/scrape-accessories.ts`, `src/data/helms-a-l.json`, and
  `src/data/capes-wings-a-l.json`: normalized `Alloyed KabutoGuard` / `Alloyed KabutoPack` captions
  (`Horn (...)`, `Pack (...)`, `Wings (...)`) and removed consumed appearance-summary lines from
  Other Information.
- `src/data/accessory-manifest.json` and non-artifact accessory JSON shards: mechanically reshaped
  existing data through the accessory promotion pipeline. Accessories now report 2,520 entries.
- `docs/context/category_playbooks.md`: documented the approved singular-sibling consolidation rule,
  clear-variant-label requirement, possessive variant preservation, the exclusion of Artifacts from
  this pass, and the future Classes / Abilities gap for rendering extra images embedded in Other
  Information.
- `AGENTS.md`: updated project counts and recorded this handover entry.

**Verified:**

- Data audit → all 20 reviewed family names exist with expected variant counts; `Soulthread Loop`
  and `Star Captain's Belt` render one variant per named sibling with two obtain methods each.
- Data audit → `Star Ring` / `Starry Ring` / `Starlight Ring` and the eight `Seal Ring` entries are
  singles again.
- Data audit → every `Star Ring` sibling and sampled `Seal Ring` siblings now have mutual Also See
  refs.
- Data audit → `Skullhelm` variants are `Klatu's`, `Baradaa's`, and `Nickto's`.
- Data audit → `Alloyed KabutoGuard` captions are `Main`, `Horn (Orange)`, `Horn (Red)`,
  `Horn (No Color)`, `Clicked Appearance`; `Alloyed KabutoPack` captions are `Main`,
  `Pack (Orange)`, `Pack (Red)`, `Pack (No Color)`, `Wings (Cyan)`, `Wings (Orange)`,
  `Wings (Red)`, `Wings (No Color)`, with grouped appearance-summary note lines removed.
- Data audit → `artifacts.json` remains 20 entries and was not included in the new reviewed
  consolidation specs.
- `node scripts/validate-accessories.mjs` → passed, 2,520 entries across 8 subtypes / 10 data files.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `npm run validate` → passed across all dataset validators, shared dataset verification, and script
  typecheck.
- `npm run lint` → passed.
- `npx vite build` → passed.

**Not verified / known gaps:**

- No browser screenshot pass was run for the new accessory families.

**Next agent should:**

- Have the user spot-check the new family selectors and Method 1/2 obtain cards.

### 2026-09-01 — Class Regular/Misc overlap and Nythera cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested targeted class scraper/UI/data correction

**Changed:**

- `src/utils/dataLoaders.ts`, `src/hooks/useClassAbilities.ts`, and
  `src/components/classAbilities/ClassAbilityCard.tsx`: Regular/Miscellaneous class entries with
  the same forum source now load as one card while preserving both subcategory memberships and alias
  slugs. Current duplicate-source groups are `|`, `Angler`, `ChickencowLord`, and `Zardbie`.
- `scripts/scrape-classes.ts`: class image extraction now keeps explicit gallery captions such as
  `Alternative Image` even when a name-matched main image exists; `Nythera` and `Kid Nythera`
  are the reference cases.
- `scripts/scrape-classes.ts`: playable class stat parsing now accepts compact rows such as
  `Defenses: Melee: 5, ...`, and playable classes no longer use the Consumables dialogue extractor.
- `scripts/scrape-classes.ts`: class obtain methods now parse `Level/Quest/Items required:` as
  requirements, drop redundant `Dragon Amulet`, and keep DC flags scoped to the individual obtain
  method instead of inheriting a page-level DC tag.
- `scripts/scrape-classes.ts`: class obtain parsing now reads the raw forum HTML intro block so
  DA/DC/DM tag images are scoped to the obtain method they precede, matching the pattern already used
  by guests, accessories, and weapons.
- `scripts/scrape-classes.ts`: obtain-method DA now stays method-scoped as well; whole-page DA tags
  only contribute to item/filter metadata and are no longer copied onto every class access point.
  `Ascended Chickencow` is the reference case.
- `scripts/scrape-classes.ts`: `Nythera` Miscellaneous class variants are labelled `(Base)` and
  `(Rare)` instead of generic `1` / `Scaled`.
- `scripts/scrape-classes.ts` and `src/data/class-regular.json`: `ChronoZ` is now a Regular-class
  single-post exception, so later same-thread combo posts no longer become variants or attack sets.
  Its `CZ-Widget.gif` image remains in Class Mechanics and no longer appears as a `Main`
  class-gallery image.
- `src/components/classAbilities/ClassAbilityDetail.tsx`: removed the detail-header `Temp` pill for
  Classes / Abilities; `Temp` remains a list-level filter only.
- `scripts/lib/accessories/cross-post-family.ts` and `src/data/belts.json`: consolidated
  `Necro U Alumni Sash`, `Necro U Salutorian Sash`, and `Necro U Valedictorian Sash` into the
  explicit `Necro U Sash` belt family with `Alumni`, `Salutorian`, and `Valedictorian` variants.
- `src/data/class-miscellaneous.json`: targeted refresh updated `Nythera` and `Kid Nythera` with
  alt images, fixed `Nythera` variant labels, parsed rare stats, and removed the bogus rare dialogue.
- `src/data/class-miscellaneous.json`: targeted refresh updated `Alexander` requirements and
  corrected method-level DC scoping on `Dread Pirate`.
- `docs/context/category_playbooks.md` and `docs/context/scraper_operations.md`: documented the
  same-source Regular/Misc dedupe, explicit class alt-image retention, compact stat parsing, no class
  dialogue extraction, special-character tag image rule, method-level DC scoping, and `Nythera`
  labels.

**Verified:**

- Targeted Miscellaneous scrape for `Nythera|Kid Nythera` → passed and preserved 53 Miscellaneous
  entries.
- Targeted Miscellaneous scrape for `Alexander|Dread Pirate` → passed and preserved 53 Miscellaneous
  entries.
- Targeted Regular and Miscellaneous scrape by URL for `|` (`fb.asp?m=22123522`) → passed. Both files
  now store `New Dimension` as non-DC and `Dimensional Transphaser, Armor Closet` as DC.
- Targeted Regular scrape for `Ascended Chickencow` → passed. Its first method is DA-only and its
  second method is DC-only.
- Targeted Regular scrape for `ChronoZ` → passed. Data audit shows it is a single item with 15
  attacks, no level/variant selector, `Original`/`Reforged` class images, and the widget image only
  in Class Mechanics.
- Targeted Regular scrape for `Ninja Monkey|Pirate Monkey|Zardbie`, plus targeted Miscellaneous
  scrape for `Zardbie` → passed. Data audit found zero remaining Regular/Miscellaneous class entries
  where every obtain method is DA while one method is DC.
- Data audit → `Necro U Sash` is one belt family; the former standalone `Necro U Alumni Sash`,
  `Necro U Salutorian Sash`, and `Necro U Valedictorian Sash` entries are gone and retained as
  family/source aliases where needed.
- Data audit → `Alexander` keeps `alexandersaga` / `special-character`, stores
  `Unlock Special Character Slot in Burnt House`, and omits redundant `Dragon Amulet`.
- Data audit → `Dread Pirate` remains page-level DC-bearing, but its `Armor Closet` obtain method is
  no longer incorrectly flagged DC.
- Data audit → `Nythera` has `(Base)` / `(Rare)`, the rare variant has defense/offense/resistance
  stats, and no dialogue fields remain on Regular/Miscellaneous class data.
- Data audit → `Nythera` has the forum `Alternative Image` `http://i.imgur.com/2yIIwkB.jpg`;
  `Kid Nythera` has `http://i.imgur.com/7dYwR9O.png`.
- Data audit → same-source Regular/Misc duplicates are limited to the four known overlap groups above,
  which are now handled by the loader.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 198 entries.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run validate` → passed across all dataset validators, shared dataset verification, and script
  typecheck.
- `npm run lint` → passed.
- `npx vite build` → passed.

**Not verified / known gaps:**

- No screenshot/browser visual pass was run for the card-gallery dedupe; validation covered data and
  type behavior only.
- The manifest total remains the raw sum of split class files, not the deduped gallery count.

**Next agent should:**

- Continue the broader Regular/Miscellaneous class cleanup only from fresh user spot checks; avoid broad
  scrapes unless the user runs them manually.
