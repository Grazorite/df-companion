# Implementation Plan: Accessories Section

## Overview

Build the Accessories section of DragonFable Companion with a full eight-subtype architecture, while implementing and validating **Bracers** and **Trinkets** first.

Accessory subtypes:

- Artifacts
- Belts
- Bracers
- Capes & Wings
- Helms
- Necklaces
- Rings
- Trinkets

The implementation should reuse the strongest existing patterns from Pets/Guests:

- printable scraper utilities
- access-flag computation
- item-family / multi-variant handling
- obtain-card rendering
- segment-style subtype switching

## Tasks

- [x] 1. Create accessory types and subtype constants **[Implements: Req 1, Req 2]**
  - [x] 1.1 Add `src/types/accessory.ts` with `AccessorySubtype`, `Accessory`, and accessory obtain-method types
  - [x] 1.2 Define subtype metadata (display name, route, JSON file, route slug)
  - [x] 1.3 Reuse existing `ItemFamily`/`LevelVariant` support for `type: 'accessory'`

- [x] 2. Add empty per-subtype data files and loading infrastructure **[Implements: Req 1, Req 7]**
  - [x] 2.1 Add `src/data/artifacts.json`
  - [x] 2.2 Add `src/data/belts.json`
  - [x] 2.3 Add `src/data/bracers.json`
  - [x] 2.4 Add `src/data/capes-wings.json`
  - [x] 2.5 Add `src/data/helms.json`
  - [x] 2.6 Add `src/data/necklaces.json`
  - [x] 2.7 Add `src/data/rings.json`
  - [x] 2.8 Add `src/data/trinkets.json`
  - [x] 2.9 Add `src/hooks/useAccessories.ts` to load subtype datasets through one shared interface

- [ ] 3. Build accessory scraper foundation **[Implements: Req 5]**
  - [x] 3.1 Create `scripts/scrape-accessories.ts`
  - [x] 3.2 Parse the accessories A-Z index (`m=20985110`) into subtype sections
  - [x] 3.3 Normalize split subtype ranges like `Capes & Wings (A-L)` + `(M-Z)` into one subtype
  - [x] 3.4 Create subtype-specific stub records with subtype, route slug, forum URL, and message ID
  - [ ] 3.5 Add resumable progress support
  - [x] 3.6 Add targeted subtype/letter flags for focused reruns

- [x] 4. Implement structured accessory post parsing **[Implements: Req 2, Req 4, Req 5]**
  - [x] 4.1 Reuse printable content extraction from `scripts/lib/printable-parser.ts`
  - [x] 4.2 Parse description, location, requirements, price, required items, and sellback
  - [x] 4.3 Parse level, element, stats, resists, ability, rarity, item type, equip spot, and category
  - [x] 4.4 Parse notes from `Other information`
  - [x] 4.5 Detect DA/DC/DM and category tags
  - [x] 4.6 Extract main and alternative images conservatively
  - [x] 4.7 For trinkets, follow linked ability posts and map them into guest-style attack data when present

- [ ] 5. Implement accessory family detection and consolidation **[Implements: Req 6]**
  - [x] 5.1 Support Roman numeral same-thread families
  - [x] 5.2 Support same-level branch families such as Normal/DC dual entries
  - [ ] 5.3 Reuse or extend cross-post family promotion logic for accessories
  - [x] 5.4 Preserve variant-specific source URLs, images, descriptions, and obtain methods
  - [x] 5.5 Compute family access flags across all obtain variants
  - [x] 5.6 Support same-thread multi-post family consolidation with per-variant media, notes, and ability overrides

- [ ] 6. Add validation for accessory datasets **[Implements: Req 7]**
  - [x] 6.1 Create `scripts/validate-accessories.mjs`
  - [x] 6.2 Validate required fields and subtype correctness
  - [x] 6.3 Validate slug uniqueness across all accessory subtype files
  - [ ] 6.4 Validate family structures and access-flag consistency
  - [x] 6.5 Hook accessory validation into build/validation scripts

- [x] 7. Build shared accessory UI primitives **[Implements: Req 3, Req 4]**
  - [x] 7.1 Create `AccessoryCard` using the project’s standard list-card pattern
  - [x] 7.2 Create `AccessoryDetail` using the project’s standard detail layout
  - [x] 7.3 Reuse obtain-card styling and access-pill rendering
  - [x] 7.4 Reuse family selector / stats-by-level presentation where applicable

- [x] 8. Build accessory list-page routing and filters **[Implements: Req 1, Req 3]**
  - [x] 8.1 Create shared `AccessoryListPage.tsx`
  - [x] 8.2 Register `/artifacts`, `/belts`, `/bracers`, `/capes-wings`, `/helms`, `/necklaces`, `/rings`, `/trinkets`
  - [x] 8.3 Add subtype segment-toggle navigation between routes
  - [x] 8.4 Add Level 1 access filters
  - [x] 8.5 Add Level 2 element filters
  - [x] 8.6 Add text search and result count behavior

- [x] 9. Build accessory detail-page routing **[Implements: Req 4]**
  - [x] 9.1 Create shared `AccessoryDetailPage.tsx`
  - [x] 9.2 Register subtype-prefixed detail routes
  - [x] 9.3 Render main/alt images, metadata, obtain cards, notes, and forum source links
  - [x] 9.4 Support family variant switching and variant-specific source updates

- [x] 10. Integrate Accessories into app navigation **[Implements: Req 1]**
  - [x] 10.1 Enable the Accessories nav item
  - [x] 10.2 Activate the Accessories home card
  - [x] 10.3 Show subtype counts or total accessory count where appropriate

- [x] 11. Implement Phase 1 real data rollout for Bracers and Trinkets **[Implements: Req 5, Req 8]**
  - [x] 11.1 Scrape and validate Bracers
  - [x] 11.2 Scrape and validate Trinkets
  - [x] 11.3 Wire Bracers and Trinkets into the live routes and detail pages
  - [x] 11.4 Spot-check representative entries including single items, same-level dual-branch items, Roman numeral families, and linked trinket skill posts

- [ ] 12. Perform QA and readiness checks **[Implements: Req 4, Req 7, Req 8]**
  - [x] 12.1 Confirm build passes with accessory validation enabled
  - [x] 12.2 Verify route and filter behavior across Bracers and Trinkets
  - [x] 12.3 Verify obtain-card fidelity against sample forum posts
  - [x] 12.4 Verify family rendering against representative multi-variant accessories
  - [ ] 12.5 Document any subtype-specific parser quirks discovered before scaling to the remaining six subtypes

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Foundation",
      "tasks": [1, 2, 3, 4, 6]
    },
    {
      "name": "Family Logic + Shared UI",
      "tasks": [5, 7]
    },
    {
      "name": "Routes + Pages",
      "tasks": [8, 9, 10]
    },
    {
      "name": "Phase 1 Rollout",
      "tasks": [11, 12]
    }
  ]
}
```

## Notes

### Recommended implementation order

The safest order is:

1. final schema and route architecture
2. scraper and validation backbone
3. Bracers real data
4. Trinkets real data
5. family/edge-case tuning from real examples
6. scale remaining subtypes into the same pipeline

### Phase 1 checkpoints

- **Checkpoint A**: empty accessory routes and subtype architecture exist — complete
- **Checkpoint B**: scraper can parse and write Bracers + Trinkets JSON — complete
- **Checkpoint C**: Bracers + Trinkets list/detail pages render from real data — complete
- **Checkpoint D**: multi-variant accessory families work for Phase 1 sample items — complete
- **Checkpoint E**: build passes with accessory validation enabled — complete

### Initial sample posts to verify against

- `Azaveyran Farewell (I, II, III)` — Roman numeral bracer family with DA/DC branches
- `Legion Bracer` — single-entry DC bracer
- `Lights of the Storm (Trinket)` — DC/DM trinket with required items and cosmetic note
- `Elemental Unity Defender (I-XV)` — large trinket family with ability text and complex stats
