# Done Task Archive

Older completed-task history moved out of `AGENTS.md` so the live handover stays readable.

Keep the current status and the five most recent or most operationally relevant completed tasks in
`AGENTS.md`. During session close, move older live Done bullets here instead of letting the live
board grow without bound.

## Archived Snapshot — 2026-09-10

This is the completed-task inventory as it existed before the live board was shortened to five Done
items. The live board may repeat the newest few items for quick handover context.

### ✅ Done

#### Testing & quality gates

- [x] **Introduce a test framework** — `npm test` runs Node's built-in test runner through `tsx`,
      with starter coverage around public behavior for display normalization, badge filtering,
      tri-state filters, and related-item matching. Keep future tests focused on system behavior and
      public APIs rather than arbitrary coverage metrics.

#### Content sections shipped

- [x] Badges section — `/badges`, 161 entries, 5 categories + subcategories, retired handling
- [x] Pets / Guests section — `/pets`, `/pets/:slug`, `/guests/:slug`, 304 entries
- [x] Accessories section — `/accessories`, 8 subtypes, 2,520 entries, A-L/M-Z shards for helms + capes
- [x] Weapons section — `/weapons`, 4 subtypes, 3,286 entries across 11 shards
- [x] Housing section — `/housing`, 7 subtypes, 623 entries
- [x] Classes / Abilities section — `/classes`, 198 entries across 2 subtypes (144 Classes + 54
      Consumables); Armors, Regular, and Miscellaneous class data all complete
- [x] **Complete Classes subtype scraper/data** — Armors, Regular, and Miscellaneous class parsing,
      relation indexes (artifact / armor / default-weapon), and split datasets all populated and
      validated (manifest 198 = 144 class + 54 consumable)

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
- [x] **Reviewed accessory singular-sibling consolidation** — promoted 20 non-artifact accessory
      groups into itemfamilies after user review: Hunter's Wrap, Soulthread Loop, Star Captain's Belt,
      Bloodstone Ring, Moonstone Ring, Ancient Ring, Ring of the Emperor, Bear Tooth Necklace, Wild
      Necklace, Thursday's Necklace, Drakonnan's Helm, Skullhelm, Gnome Wig, Goggle Wig, Eyeball
      Helm, Custom HarleQuape (2010), Astral Avenger, Half Dread Wings, Thursday's Cape, and Wings
      of The Flames.
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
