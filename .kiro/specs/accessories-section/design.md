# Technical Design Document

## Overview

This design document describes the Accessories section for DragonFable Companion. Accessories are a new major content vertical sourced from the DF Encyclopedia’s A-Z Accessories index (`m=20985110`) and split into eight subtypes:

- Artifacts
- Belts
- Bracers
- Capes & Wings
- Helms
- Necklaces
- Rings
- Trinkets

The design intentionally mirrors the proven architecture from Pets/Guests:

- forum-scraped JSON data committed to the repository
- reusable detail/list rendering patterns
- access-flag computation across obtain variants
- multi-variant family support
- printable.asp parsing as the raw content source

**Phase 1 delivery strategy:** build the full accessories architecture from day one, but populate and verify **Bracers** and **Trinkets** first.

**Current implementation status:** the shared accessory routes, validation, and real-data rollout are in place. Helms and Capes & Wings are stored as A-L / M-Z JSON shards for lazy-loading efficiency while remaining one logical UI subtype each. The main remaining engineering tasks are resumable scraper progress, deeper family-validation checks, and continuing subtype-specific scrape passes.

## Components and Interfaces

### New Files

| File | Type | Description |
|------|------|-------------|
| `scripts/scrape-accessories.ts` | Scraper | Shared accessories scraper with subtype-aware output |
| `scripts/validate-accessories.mjs` | Validation | Build-time validation for accessories datasets |
| `src/types/accessory.ts` | Types | Accessory-specific schema definitions |
| `src/data/artifacts.json` | Data | Artifact entries |
| `src/data/belts.json` | Data | Belt entries |
| `src/data/bracers.json` | Data | Bracer entries |
| `src/data/capes-wings-a-l.json` | Data | Cape and wing entries A-L |
| `src/data/capes-wings-m-z.json` | Data | Cape and wing entries M-Z |
| `src/data/helms-a-l.json` | Data | Helm entries A-L |
| `src/data/helms-m-z.json` | Data | Helm entries M-Z |
| `src/data/necklaces.json` | Data | Necklace entries |
| `src/data/rings.json` | Data | Ring entries |
| `src/data/trinkets.json` | Data | Trinket entries |
| `src/hooks/useAccessories.ts` | Hook | Unified accessory loading/filtering across subtype files |
| `src/pages/AccessoryListPage.tsx` | Page | Shared subtype list-page implementation |
| `src/pages/AccessoryDetailPage.tsx` | Page | Shared accessory detail-page implementation |
| `src/components/accessories/AccessoryCard.tsx` | UI | Accessory list card |
| `src/components/accessories/AccessoryDetail.tsx` | UI | Accessory detail renderer |

### Modified Files

| File | Changes |
|------|---------|
| `src/App.tsx` | Register accessory routes |
| `src/components/layout/Navigation.tsx` | Enable Accessories nav item |
| `src/pages/HomePage.tsx` | Activate Accessories card |
| `scripts/lib/printable-parser.ts` | Reused for accessories scraper |
| `src/utils/variantHelpers.ts` | Reused or extended for accessory families |
| `scripts/lib/also-see.ts` | Shared neutral parser for `Also See:` source references |
| `scripts/lib/cross-post-family.ts` | Pet/guest cross-post family promotion helper; accessories should not use `Also See` for promotion by default |
| `scripts/lib/accessories/*` | Accessory subtype strategies for image extraction, thread inspection, and subtype-specific quirks |

### Route Interface

Accessories use **separate top-level subtype routes** with a shared implementation:

| Route | Purpose |
|-------|---------|
| `/artifacts` | Artifact list page |
| `/belts` | Belt list page |
| `/bracers` | Bracer list page |
| `/capes-wings` | Cape/Wing list page |
| `/helms` | Helm list page |
| `/necklaces` | Necklace list page |
| `/rings` | Ring list page |
| `/trinkets` | Trinket list page |
| `/<subtype>/:slug` | Accessory detail page for the subtype |

The page UI exposes a **segment-style subtype toggle** so users can jump between subtype routes without returning to Home.

### Type Interfaces

#### `AccessorySubtype`

```typescript
type AccessorySubtype =
  | 'artifact'
  | 'belt'
  | 'bracer'
  | 'cape-wing'
  | 'helm'
  | 'necklace'
  | 'ring'
  | 'trinket'
```

#### `AccessoryObtainMethod`

```typescript
interface AccessoryObtainMethod {
  location: string
  price?: string
  priceType: 'free' | 'gold' | 'dc' | 'dm' | 'merge'
  sellback?: string
  requirements?: string
  requiredItems?: string
  daRequired?: boolean
  dcRequired?: boolean
  dmRequired?: boolean
}
```

#### `Accessory`

```typescript
interface Accessory {
  id: string
  name: string
  slug: string
  type: 'accessory'
  subtype: AccessorySubtype
  description: string
  forumUrl: string
  releaseDate: string

  imageUrl?: string
  alternativeImages?: Array<{ url: string; caption?: string }>

  level?: string
  element?: string
  stats?: string
  resists?: string
  ability?: string
  rarity?: string
  itemType?: string
  equipSpot?: string
  category?: string

  daRequired?: boolean
  dcRequired?: boolean
  dmRequired?: boolean

  obtainMethods: AccessoryObtainMethod[]
  notes?: string
  alsoSee?: AlsoSeeRef[]

  isTemp?: boolean
  isRare?: boolean
  isSeasonal?: boolean
  isSpecialOffer?: boolean
  retired?: boolean
}
```

#### `AccessoryFamily`

Accessories reuse the existing `ItemFamily` pattern with `type: 'accessory'` and `subtype` on the family plus variant-level metadata.

## Architecture

### Data Loading Strategy

Unlike pets/guests, accessories are stored in **separate subtype JSON files**. Large image-heavy subtypes can use multiple JSON shards without changing the route or UI subtype. The UI layer loads them through a shared hook:

```text
src/data/artifacts.json
src/data/belts.json
src/data/bracers.json
...
src/data/helms-a-l.json + src/data/helms-m-z.json
src/data/capes-wings-a-l.json + src/data/capes-wings-m-z.json
src/data/trinkets.json
        ↓
useAccessories()
        ↓
shared list/detail rendering
```

This keeps file ownership clean while still allowing the application to share card/detail/filter components.

### Subtype Routing Strategy

Each subtype has its own top-level route, but they all use the same list-page implementation:

```text
/bracers      ┐
/trinkets     │
/rings        │  -> AccessoryListPage(subtype)
/helms        │
...           ┘
```

The subtype toggle behaves like the Pets/Guests control conceptually, but instead of filtering one mixed in-memory page, it navigates between subtype routes.

### Filtering Model

Accessories use:

- **Subtype toggle**: route-level subtype selection
- **Level 1**: access filters (`Multiple Versions`, `DA Required`, `Merge Required`, `Free`, `DC`, `DM`)
- **Level 2**: element filters only

No trait filter is included in Phase 1.

### Scraper Pipeline

```text
Fetch Accessories A-Z index (m=20985110)
  -> split entries by subtype section
  -> build subtype-specific stubs
  -> fetch printable posts
  -> parse structured fields
  -> detect same-thread / same-level families
  -> apply cross-post family promotion
  -> write per-subtype JSON outputs
  -> validate datasets
```

The scraper entry file should remain an orchestration layer. Shared neutral parsing belongs in `scripts/lib/*`; accessory-specific decisions belong in subtype strategy modules under `scripts/lib/accessories/*`.

### Subtype Index Parsing

The accessories index is a single forum post with content headings such as:

- `Artifacts (A-Z)`
- `Belts (A-Z)`
- `Bracers (A-Z)`
- `Capes & Wings (A-L)` and `Capes & Wings (M-Z)`
- `Helms (A-L)` and `Helms (M-Z)`
- `Necklaces (A-Z)`
- `Rings (A-Z)`
- `Trinkets (A-Z)`

The scraper SHALL:

1. detect subtype boundaries
2. merge split ranges (`A-L` + `M-Z`) into one logical subtype
3. preserve subtype assignment on every stub

### Detail Preservation Strategy

Phase 1 preserves forum wording rather than aggressively normalizing all accessory stat lines. The parser should therefore extract string fields conservatively:

- `Stats`
- `Resists`
- `Ability`
- `Category`
- `Equip Spot`
- `Item Type`

These fields should render cleanly without premature interpretation. Structured normalization can be added later once real data coverage is understood.

### Trinket Ability Strategy

Trinkets add one extra parsing path beyond the baseline accessory schema:

- some trinkets expose an `Ability` field that links to a separate forum post
- when that linked post contains structured skill data, the scraper should map it into the existing guest-style attack model
- the linked skill post should be treated as a detail expansion of the trinket, not as a separate accessory entry or family

This keeps active-effect trinkets aligned with the existing expander-based skill UI and avoids inventing a trinket-only attack renderer.

### Also See Strategy

Accessories may expose `Also See:` links in forum posts. These links should be preserved and rendered as related items, but they should not be used to consolidate separate accessory posts into one `ItemFamily`. This differs from pets/guests, where carefully scored cross-post relationships can be promoted when names, mechanics, and obtain data indicate true variants.

This distinction is deliberate for Helms and Capes & Wings: some entries share images and stats but differ by obtain method, rarity/tagging, or availability, and should remain separate cards.

### Multi-Variant Strategy

Accessories must support the same major variant modes as pets and guests:

1. **Roman numeral single-thread families**
   - example: `Azaveyran Farewell (I, II, III)`
2. **Same-level dual-branch variants**
   - example: normal/drop branch vs DC branch
3. **Cross-post multi-variant promotion**
   - for related accessories spread across separate posts

The design reuses existing family patterns:

- family-level shared description/media where valid
- variant selectors
- per-variant source URLs
- per-variant obtain methods and notes

Phase 1 currently implements:

- same-thread Roman numeral families
- same-thread multi-post families
- same-level obtain-branch distinction within a family

Full cross-post family promotion remains a later extension and should continue following the same conservative anti-overmerge rules used for pets and guests.

### Phase 1 Rollout

The architecture is final from the start, but the implementation order is:

1. shared accessory types, hooks, routes, validation
2. scraper support for Bracers and Trinkets
3. UI verification against Bracer/Trinket real data
4. expand remaining subtypes into the same pipeline

This lets the project validate the full design against smaller datasets first.

## Data Models

### File Ownership

| File | Contents |
|------|----------|
| `artifacts.json` | Artifact entries/families only |
| `belts.json` | Belt entries/families only |
| `bracers.json` | Bracer entries/families only |
| `capes-wings.json` | Cape/Wing entries/families only |
| `helms.json` | Helm entries/families only |
| `necklaces.json` | Necklace entries/families only |
| `rings.json` | Ring entries/families only |
| `trinkets.json` | Trinket entries/families only |

### Access Flag Computation

Family-level access flags are computed from all obtain variants across all level variants, matching the pet logic:

- `hasDA` = any obtain variant has `daRequired=true`
- `hasDC` = any obtain variant is `dc`-priced or explicitly `dcRequired`
- `hasDM` = any obtain variant is `dm`-priced or explicitly `dmRequired`
- `hasFree` = any obtain variant has `priceType='free'`
- `hasMerge` = any obtain variant has `priceType='merge'`

### Obtain Method Parsing

Accessory obtain methods follow the same general field model as pets:

- `Location`
- `Requirements`
- `Price`
- `Required Items`
- `Sellback`

Unlike guests, accessories should preserve all price/sellback fields because these are meaningful to the item type.

### Image Model

Accessories should support:

- main image
- alternate images with captions
- variant-specific images in families

As with recent guest/pet work, the parser should prefer:

1. explicit DF-Pedia / image links in the post tail
2. last-image main portrait/item-art assumptions when forum structure supports it
3. alternative images only when linked as distinct appearance/variant media rather than incidental button or UI images

## Error Handling

### Index Parsing Errors

- If a subtype boundary cannot be found, the scraper should log a warning and continue with the recoverable subtype sections
- If an entry cannot be confidently assigned to a subtype, the scraper should skip it and report it

### Post Parsing Errors

- If a printable post cannot be fetched, the scraper should log the message ID and continue
- If an item parses partially, the scraper should prefer partial structured output over dropping the entry entirely
- If a field is absent, omit it instead of inventing placeholder values unless the UI depends on a stable fallback string

### Variant Detection Errors

- If a family relationship is ambiguous, the scraper should keep entries separate rather than over-merge
- If same-level branch detection fails, the fallback should preserve at least one valid accessory entry rather than produce an invalid family

### Validation Errors

- Invalid subtype
- duplicate slug
- missing required field
- malformed `levelVariants`
- inconsistent family access flags

These should fail validation loudly before build/deploy.

## Correctness Properties

### Property 1: Subtype Integrity

Every accessory must belong to exactly one supported subtype dataset.

### Property 2: Route Stability

Every list and detail route must remain subtype-stable and derivable from the accessory’s subtype and slug.

### Property 3: Obtain Fidelity

Accessory obtain cards must preserve the forum’s acquisition information without dropping requirements, required items, prices, or sellback data.

### Property 4: Conservative Family Consolidation

Accessory family logic must prefer under-merging to over-merging.

### Property 5: Reusable Architecture

The Bracers/Trinkets-first rollout must not require a separate architecture from the remaining six subtypes.

### Property 6: UI Consistency

Accessory list/detail experiences should feel native beside Badges, Pets, and Guests, reusing established filter, card, and obtain-card patterns wherever appropriate.

Shared detail-section ordering should match the item-family pattern used by Pets/Guests. In particular, `Also See` renders after `Sources`, not before it, and uses the same bordered related-card section style. Category-specific content may add sections above stats or obtain data only when the source schema requires it, such as artifact `Modifies` / `Equip Spot`.
