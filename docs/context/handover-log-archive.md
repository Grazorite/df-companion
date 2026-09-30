# Handover Log Archive

> Older log entries moved from `AGENTS.md` to keep the orchestrator file under ~600 lines.
> Entries here are **read-only history** after archival. New session entries always go in `AGENTS.md`
> under `## 📝 Reverse-Chronological Handover Log`; at session close, prepend entries rotated out of
> that live log here without rewriting their content.
>
> **Reading `Commit(s): uncommitted`:** it means uncommitted _at the time of writing_, not still
> uncommitted. Treat `git log` as authoritative for what shipped when.

---

## Entries

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

### 2026-09-01 — Class portrait and named attack-image cleanup

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** no board item moved; user-requested targeted class scraper/data correction

**Changed:**

- `scripts/scrape-classes.ts`: class image extraction now performs a trailing-gallery pass for
  non-skill chunks after the last attack, so final class portraits inside the broad skill region are
  no longer skipped. `Shadow Rogue` is the reference case.
- `scripts/scrape-classes.ts`: added explicit Male/Female class portrait fallbacks for
  `Icebound Revenant` and `Dreaming Togslayer`, whose forum pages expose paired portraits in a shape
  the generic matcher cannot reliably infer.
- `scripts/scrape-classes.ts`: class attack image captions now normalize named parenthetical labels
  such as `Appearance (Charging)` / `Appearance (Attacking)` and the forum typo `Apperance (Hit)` to
  short captions (`Charging`, `Attacking`, `Hit`, etc.).
- `src/data/class-regular.json` and `src/data/class-miscellaneous.json`: targeted refreshes updated
  the affected Regular/Miscellaneous class entries without running a broad scrape.
- `docs/context/category_playbooks.md` and `docs/context/scraper_operations.md`: documented the
  final-gallery class image path and named attack-image caption normalization.

**Verified:**

- Targeted Regular scrape for `Dreaming Togslayer|Icebound Revenant|Shadow Rogue` → passed and
  preserved 62 Regular entries.
- Targeted Miscellaneous scrape for `Alexander|Dread Pirate|Edd Disguise|Knight Lite|Nythera|Unbread`
  → passed and preserved 53 Miscellaneous entries.
- Data audit → `class-regular.json` and `class-miscellaneous.json` have 0 entries missing either a
  top-level `imageUrl` or family `shared.imageUrl`.
- Data audit → `Dreaming Togslayer` has Male/Female portraits; `Togmaster Strike` attack images are
  captioned `Charging` / `Attacking`; `Punt` attack images are captioned `Kick` / `Hit`.
- Data audit → Regular/Miscellaneous class attack captions have 0 leaked `Apperance` typos or raw
  parenthetical captions.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 198 entries.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run validate` → passed across badges, pets/guests, accessories, weapons, housing, class
  abilities, shared dataset verification, and script typecheck.
- `npm run lint` → passed.

**Not verified / known gaps:**

- No screenshot/browser visual pass was run for this targeted scraper/data correction.
- Armors are intentionally excluded from the image audit because that subtype does not render class
  portraits.

**Next agent should:**

- Continue Regular/Miscellaneous class special-case cleanup from the current user spot checks, then
  run the class validator and shared dataset checks before claiming the class scrape clean.

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
- `scripts/scrape-classes.ts` and `src/data/class-regular.json`: SoulWeaver-style grouped attack
  image captions now parse from long same-line prefixes, preserve duplicate URLs when captions
  differ, and remove consumed caption lines from attack notes. Artifact sections with no real skill
  blocks, such as Shadowheart Bracer on Ancient/Shadow classes, create zero-attack selector options
  with artifact-specific notes instead of fake attacks. Ancient Shadow Warrior/Mage/Rogue have fixed
  opaque Imgur image fallbacks.
- `scripts/scrape-classes.ts`: playable class title inference now ignores pure access parentheticals
  such as `(DA Required)`, and normalization drops stale access-only title duplicates when the base
  class entry exists from the same source.
- `scripts/lib/class-default-weapon-relations.ts`,
  `scripts/generate-class-default-weapon-relations.ts`,
  `src/data/class-default-weapon-relations.json`,
  `src/hooks/useClassDefaultWeaponRelations.ts`,
  `src/components/classAbilities/ClassAbilityDetail.tsx`, and
  `src/components/weapons/WeaponDetail.tsx`: playable class `Default Weapon` forum links now become
  app-route links when a matching weapon source exists, and weapon detail pages hotlink the reverse
  class relation inline in the default weapon's How to Obtain text.
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
- Targeted Regular scrape for `SoulWeaver|Ancient Shadow Warrior|Ancient Shadow Mage|Ancient Shadow
Rogue` → passed and preserved 62 regular class entries. `SoulWeaver` Base `Unleash SoulSynch` has
  4 captioned images; both Sealing Slash variants have 6 captioned images; `Attack` has 3 captioned
  images; Baltael's `Unleash SoulSynch` has the same 4 captioned images. Shadowheart Bracer no
  longer creates fake `Other information` attacks on the refreshed Ancient Shadow entries and now
  remains selectable with zero attacks plus its passive note.
- Targeted Regular scrape for `Shadow Warrior|Shadow Mage|Shadow Rogue|DragonLord` → passed and
  preserved 62 regular class entries after duplicate-title cleanup. Audit found no remaining class
  attacks named `Other information` in Regular or Miscellaneous class data.
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
- Data audit → `Chronomancer` has 15 attacks, `Original` / `Reforged` class images, and
  `Blade of Meanwhile` attack images captioned `Original` / `Reforged`.
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
- `scripts/scrape-accessories.ts` and `scripts/scrape-weapons.ts`: note parsing now preserves
  indented stat continuations under "had the initial/following stats" Other Information lines, even
  when the first `Stats:` line is normalized flush-left by forum text extraction.
- `src/components/shared/NotesList.tsx`: nested note rendering now treats any leading whitespace as at
  least one nested level, so one-space legacy note rows do not render flat.
- `src/utils/variantHelpers.ts`: repeated identical variant labels across unique levels now use
  level-driven display and hide the Variant stats-table column. This fixes `Soulforged Ring
(Red/Blue/Green)` families, where each color family stores the same color label on every level row.
- `scripts/lib/accessories/cross-post-family.ts` and `src/data/rings.json`: `First Golden Ring`
  through `Fifth Golden Ring` now consolidate into one scoped `Golden Rings` itemfamily with
  `First`, `Second`, `Third`, `Fourth`, and `Fifth` variants. The separate `Golden Ring` entry stays
  standalone.
- `src/data/necklaces.json`, `src/data/rings.json`, `src/data/weapons-scythes-a-j.json`, and
  `src/data/weapons-scythes-k-z.json`: targeted refreshes repaired current flattened stat-note
  examples, including `The Answer`, the Dreamscape necklace notes, `Infected Megabytes`, and
  `Necrotic Blade of Doom`.
- `scripts/scrape-weapons.ts`, `src/data/weapons-scythes-a-j.json`, and
  `src/data/weapon-manifest.json`: `Infected Megabytes` now follows the mixed-variant split rule:
  `Infected Megabytes (Cosmetic)` is separate from the non-cosmetic `Infected Megabytes (I-III)`
  Roman progression, with mutual `Also See` links.
- `src/data/weapon-manifest.json`: updated after targeted scythe refreshes; current weapon total is
  3,286 entries after the `Infected Megabytes` split.
- `scripts/scrape-classes.ts`: Regular and Miscellaneous class listing/detail parsing now exists.
  The parser scopes to the selected A-Z subcategory, extracts direct reply content instead of forum
  wrapper chrome, parses first-post class data only, uses subcategory-aware non-armor class slugs,
  and captures release dates, images, guest-shaped stats, `Access Point` obtain methods, default
  weapon text/link, attacks, notes, and special-character tags.
- `src/types/item.ts`, `src/types/classAbility.ts`, and
  `src/components/classAbilities/ClassAbilityDetail.tsx`: Classes / Abilities details can now render
  release dates, guest-style stat panels, and a Default Weapon card for playable class entries.
- `src/data/classes.json` and `src/data/class-abilities-manifest.json`: targeted samples added for
  `Ancient Exosuit` regular class and `Alexander` miscellaneous class; class total is now 33, class
  abilities total is now 87.

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
- Targeted accessory refreshes for `Answer, The`, affected Dreamscape necklaces, and affected
  Nightmares rings → passed; `The Answer` now stores `Stats:` and `Resists:` as indented child lines.
- Targeted weapon refresh for `Infected Megabytes` and `Necrotic Blade of Doom` → passed; affected
  initial-stat note rows now store two-space nested indentation.
- Flattened stat-note audit across current JSON → 0 remaining unindented `Stats` / `Resists` /
  `Damage` / `Sellback` continuation rows after a colon-ended parent note.
- `node scripts/validate-weapons.mjs` → passed, 3,286 entries.
- Runtime formatter audit → `Soulforged Ring (Red)`, `(Blue)`, and `(Green)` now resolve selector
  labels to `40`, `60`, `90` with `showVariantColumn=false`.
- Data audit → `Golden Rings` has variants `First`, `Second`, `Third`, `Fourth`, `Fifth`; standalone
  `Golden Ring` remains separate.
- Data audit → `Infected Megabytes (Cosmetic)` is a single cosmetic variant; `Infected Megabytes
(I-III)` has variants `I`, `II`, `III`, is not cosmetic-tagged, and links back to the cosmetic
  sibling.
- Targeted class scrapes for `Ancient Exosuit` armor, `Ancient Exosuit` regular, and `Alexander`
  miscellaneous → passed. Armor stayed image/stat-free; regular and miscellaneous rows use
  subcategory-aware slugs and parsed class attack/default-weapon data. `Ancient Exosuit` regular
  picked up `August 4th, 2015` from class chronology.
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
- Regular/Miscellaneous Classes are not broadly populated yet. The starter parser handles first-post
  data only; later-post classes such as DragonLord and SoulWeaver still need case-by-case follow-up.
- Default Weapon links on class detail pages currently preserve the forum target. The requested
  two-way app-route inline relation between class pages and weapon pages still needs a lightweight
  relation-index pass before a full class scrape is considered finished.

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
> [`docs/context/handover-log-archive.md`](./handover-log-archive.md)** to keep this
> file under 600 lines. Read that file only when investigating historical context — the entries above
> cover the current working session.

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

### 2026-08-24 — Classes Armors A/D sample parser

**Agent:** orchestrator (GPT-5 Codex) · **Commit(s):** `the commit containing this entry`
**Kanban moved:** Complete Classes subtype scraper/data → In Progress

**Changed:**

- `scripts/scrape-classes.ts`: added the Classes `Armors` sub-subtype path from
  `fb.asp?m=22303582`, parsing armor family/name data, obtain methods, level/rarity, tags, Other
  Information, Also See, and the armor-specific `Equips Class` field/link. Repeated same-title armor
  blocks now merge into one entry with multiple obtain methods, which fixes Ancient Shadow armor
  pages that put stats/class data after the second obtain block. Detail pages that are class pages
  rather than armor items are skipped by checking `Item Type: Armor`.
- `src/types/item.ts`, `src/types/classAbility.ts`, `src/components/classAbilities/*`, and
  `src/hooks/useClassAbilities.ts`: added `equipsClass` / `equipsClassUrl` support through shared
  family variants, detail display, gallery chips, and search text.
- `scripts/validate-class-abilities.mjs`: validates armor entries have `Equips Class`, while allowing
  blank armor descriptions when the forum has none.
- `src/data/classes.json` and `src/data/class-abilities-manifest.json`: populated a targeted A/D
  Armors sample, 13 class entries. Consumables remain at 54 entries.
- `docs/context/category_playbooks.md`, `docs/context/scraper_operations.md`, and
  `docs/context/ui_patterns.md`: documented Armors as obtainable class-granting items, not playable
  class pages; documented the sample/full scrape commands and compact `Equips Class:` detail display.

**Verified:**

- `npm run scrape:classes -- --subtype=class --class-subcategory=armor --letters=A,D --fresh` →
  wrote 13 armor entries. The scraper still visits overlapping Regular/Miscellaneous links in the
  source page, but skips them after `Item Type: Armor` inspection.
- A/D data audit → all 13 sample armor entries have `equipsClass`; `Dimensional Transphaser`
  correctly stores the equipped class as `|`; the three Ancient Shadow armors each have two obtain
  methods and blank descriptions because the source pages have no flavor text.
- `npm run typecheck:scripts` → passed.
- `npx tsc --noEmit -p tsconfig.json` → passed.
- `node scripts/validate-class-abilities.mjs` → passed, 67 entries across 2 subtypes.
- `node scripts/verify-datasets.mjs` → passed.
- `npm run build` → passed.

**Not verified / known gaps:**

- Only A/D Armors were scraped. Regular and Miscellaneous class-page parsing are not implemented.
- The Armors listing parser currently relies on detail-page `Item Type: Armor` filtering because the
  forum source page interleaves armor and class-page links. This is correct but noisier/slower than an
  ideal section parser.
- No browser visual QA was run on the new `Equips Class:` display.

**Next agent should:**

- Spot-check the A/D Armors detail UI, then either refine the listing section parser or hand the user
  the full armor scrape command once the sample presentation is approved.

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
- A simple stale-data audit found badge notes with legacy `•` flattening; badge scraper output is
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
