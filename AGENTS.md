# AGENTS.md — DragonFable Companion

## Project Overview

A mobile-first React web application that serves as a companion for the Artix Entertainment game DragonFable. It aggregates game information (badges, quests, locations, etc.) from scattered forum threads into a unified, searchable interface.

**Current Status**: Static-site companion with active Badges, Pets/Guests, and Accessories sections

## Architecture

### Static-First Approach (MVP)

```
User → Static Site (Vercel/Netlify CDN) → Lazy-loaded JSON Assets
```

- No backend server or database
- Forum-scraped JSON datasets stored in the repository
- Large content datasets emitted as JSON assets and loaded lazily at runtime
- Client-side search and filtering (in-memory after dataset load)
- Content updates via git commits → auto-deploy

### Future Architecture (Post-MVP)

```
User → Static Site → REST API (Express) → PostgreSQL
```

Will be adopted when we need: user accounts, community contributions, admin panel, or dataset grows beyond what's comfortable as static JSON.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 18+ |
| Language | TypeScript | 5+ |
| Build | Vite | Latest |
| Styling | Tailwind CSS | 4 |
| Routing | React Router | v6 |
| Icons | Lucide React | Latest |
| Hosting | Vercel or Netlify | - |
| Linting | ESLint | Latest |
| Formatting | Prettier | Latest |

## Project Structure

```
dragonfable-companion/
├── public/
│   └── icons/              # Badge icons (static assets)
├── scripts/
│   ├── scrape-badges.ts    # Scrapes all badge data from DF forums (run via npm run scrape:badges)
│   ├── scrape-pets.ts      # Scrapes pets data from DF forums
│   ├── scrape-guests.ts    # Scrapes guests data from DF forums
│   ├── scrape-accessories.ts # Scrapes accessory subtype data from DF forums
│   ├── scrape-weapons.ts   # Scrapes weapon subtype data from DF forums
│   ├── validate-badges.mjs # Build-time validation for badges dataset
│   ├── validate-pets.mjs   # Build-time validation for pets/guests datasets
│   ├── validate-accessories.mjs # Build-time validation for accessory subtype datasets
│   ├── validate-weapons.mjs # Build-time validation for weapon subtype datasets
│   ├── verify-datasets.mjs # Cross-post-family invariant checks
│   ├── add_images.py       # Adds imageUrl from DF-Pedia GitHub to badges.json
│   └── add_subcategories.py # Maps badges to subcategories from forum groupings
├── src/
│   ├── components/
│   │   ├── badges/         # BadgeCard, BadgeDetail, BadgeList
│   │   ├── pets/           # Pet/Guest cards, detail components
│   │   ├── accessories/    # Accessory cards, list, detail, stats table
│   │   ├── weapons/        # WeaponCard, WeaponDetail, WeaponList, WeaponStatsTable
│   │   ├── layout/         # Navigation, Layout
│   │   └── shared/         # SearchBar, LoadingSkeleton, ObtainSection, ElementPill, etc.
│   ├── data/
│   │   ├── badges.json     # All 161 badge entries (scraped + enriched)
│   │   ├── pets.json       # Pet entries
│   │   ├── guests.json     # Guest entries
│   │   ├── artifacts.json  # Accessory subtype dataset
│   │   ├── belts.json      # Accessory subtype dataset
│   │   ├── bracers.json    # Accessory subtype dataset
│   │   ├── capes-wings-a-l.json # Split accessory subtype dataset
│   │   ├── capes-wings-m-z.json # Split accessory subtype dataset
│   │   ├── helms-a-l.json  # Split accessory subtype dataset
│   │   ├── helms-m-z.json  # Split accessory subtype dataset
│   │   ├── necklaces.json  # Accessory subtype dataset
│   │   ├── rings.json      # Accessory subtype dataset
│   │   ├── trinkets.json   # Accessory subtype dataset
│   │   ├── weapons-swords-axes-maces-a-g.json # Weapon subtype shard
│   │   ├── weapons-swords-axes-maces-h-n.json
│   │   ├── weapons-swords-axes-maces-o-z.json
│   │   ├── weapons-staves-wands-a-g.json # Weapon subtype shard
│   │   ├── weapons-staves-wands-h-n.json
│   │   ├── weapons-staves-wands-o-z.json
│   │   ├── weapons-daggers-a-g.json # Weapon subtype shard
│   │   ├── weapons-daggers-h-n.json
│   │   ├── weapons-daggers-o-z.json
│   │   ├── weapons-scythes-a-j.json # Weapon subtype shard
│   │   ├── weapons-scythes-k-z.json
│   │   ├── weapon-manifest.json # Weapon counts per subtype/shard
│   │   ├── elements.json   # Shared element and trait metadata
│   │   └── categories.json # 5 top-level category definitions
│   ├── hooks/
│   │   ├── useBadges.ts    # Badge data access, search, category/subcategory filtering
│   │   ├── usePets.ts      # Pet/guest data access and filtering
│   │   ├── useAccessories.ts # Accessory data access and filtering
│   │   ├── useWeapons.ts   # Weapon data access and filtering
│   │   └── useDebounce.ts
│   ├── types/
│   │   ├── badge.ts        # Badge, ForumLink, ObtainStep, BadgeFilters, etc.
│   │   ├── pet.ts          # Pet, Guest, attacks, stats
│   │   ├── item.ts         # Shared item-family types (ItemFamily, LevelVariant, traits)
│   │   ├── accessory.ts    # Accessory subtype and family types
│   │   └── weapon.ts       # Weapon, WeaponFamily, WeaponSpecial types
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── BadgesPage.tsx       # Two-level filter: category → subcategory
│   │   ├── BadgeDetailPage.tsx  # Full badge info with image, notes, forum links
│   │   ├── PetsPage.tsx         # Combined pets/guests browse page
│   │   ├── PetDetailPage.tsx    # Pet detail page
│   │   ├── GuestDetailPage.tsx  # Guest detail page
│   │   ├── AccessoryListPage.tsx # Accessory subtype browse page
│   │   ├── AccessoryDetailPage.tsx # Accessory detail page
│   │   ├── WeaponListPage.tsx   # Weapon subtype browse page
│   │   ├── WeaponDetailPage.tsx # Weapon detail page
│   │   └── ComingSoonPage.tsx
│   ├── utils/
│   │   ├── search.ts       # Word-prefix search + category/subcategory filtering
│   │   ├── dataLoaders.ts  # Lazy JSON asset loaders with in-memory caching
│   │   ├── variantHelpers.ts # Shared item-family helpers
│   │   ├── relatedItems.ts # Inferred Also See matching (name scoring + obtain fingerprints)
│   │   ├── imageLabels.ts  # Image caption inference and main/alternative image switcher labels
│   │   └── armorCustomization.ts # Armor customization appearance/modifies parser
│   ├── App.tsx
│   └── main.tsx
├── .env.example            # Template for forum cookie (for scraper)
├── AGENTS.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Data Sources

### Primary: DragonFable Forums
- URL: https://forums2.battleon.com/f/tt.asp?forumid=256
- Most detailed and up-to-date information
- ALL content data should be sourced from here
- Forum hotlinks are included in every badge entry
- Scrapers use `tm.asp` for listing/index pages (A-Z pages, Chronology), `printable.asp?m={messageId}` for individual post content, and shared thread-page post extraction when variants need direct reply-post source URLs (`fb.asp?m={messageId}`). Printable `[image]...[/image]` tags are normalized back to `<img src="...">` before parsing.

### Secondary: DragonFable Wiki (Reference Only)
- URL: https://dragonfable.fandom.com/wiki/DragonFable_Wiki
- Used ONLY as inspiration for UX design and content sectioning
- NOT used as a data source

## Content Sections

Based on the DF Encyclopedia forum structure (https://forums2.battleon.com/f/tt.asp?forumid=256):

| Section | Route | Status | Forum Category |
|---------|-------|--------|----------------|
| Badges | `/badges` | ✅ Active (161 badges) | Badges |
| Pets / Guests | `/pets`, `/pets/:slug`, `/guests/:slug` | ✅ Active (218 pets, 83 guests) | Pets / Guests |
| Accessories | `/accessories`, `/accessories/:slug` | ✅ Active (accessories across 8 subtypes, with split assets for image-heavy subtypes) | Accessories |
| Classes / Abilities | `/classes` | Planned | Classes / Abilities |
| Housing | `/housing` | Planned | Housing and House Items |
| Locations & Quests | `/locations` | Planned | Locations / Quests / Events / Shops |
| Monsters | `/monsters` | Planned | Monsters |
| NPCs | `/npcs` | Planned | NPCs |
| Stackable Items | `/items` | Planned | Stackable / Non-Equippable Items |
| Weapons | `/weapons` | ✅ Active | Weapons |

## Weapons Section

### Multi-Variant Consolidation

Weapon families follow the same base/DC split pattern as Pets and Accessories:
- **Base + DC access branches** (e.g. Abyssal Elf Scepter): kept as separate same-level variants (`I` / `I (DC)`), each with its own obtain method. The DC variant gets `dcRequired: true`.
- **Multiple non-DC methods** at the same level (e.g. 13th Staff level 13: Undead Slayer Store for Gold + The Stakeout for free): consolidated into ONE variant with multiple `obtainVariants` (rendered as Method 1/2). Notes are scoped per-level.
- **Single-level threads with base + DC** (e.g. `|` weapon): become a family with `(Base)` and `(DC)` variant labels.

The scraper detects families structurally (multiple title blocks across posts) — no name-based gate like `(I-VIII)` or `(All Versions)` is required.

### Mixed Variant Group Splits

Some weapon threads mix fundamentally different variant groups inside one forum family. In those cases, split the data into separate item families and connect them through `Also See` rather than showing one selector with Roman/level variants mixed with named variants. Current targeted split sets include:
- Batwing Blade/Broom/Hatchet progression variants split from their `Dark` variants.
- Wavecrest, High Tide, and Deluge Roman/base progressions split from named variants such as `Missed`, `Lost`, `Stray`, and `Wayward`.
- Sea's Blessing/Favor/Bounty split into `'09`, `'10`, and modern progressions.
- Amaterasu/Tsukuyomi progressions split from `Omikami`/`no-Mikoto`; Threadcutter/Time's Harvest split `Alpha` from Roman progressions; The Massive Axe splits `XL` from `I-IV`.

Weapon targeted refreshes support `--fresh`; use it when the selected family should replace existing local entries and aliases instead of merging into them. The fresh matcher intentionally preserves explicit named parenthetical siblings, so refreshing `Wavecrest (I-V)` does not delete `Wavecrest (Missed, Lost, Stray, Wayward)`.

### Special Classification Exceptions

- **CorDemi Codex** (`Basic CorDemiCodex`, `Advanced CorDemi Codex`, `Master CorDemi Codex`) is canonicalized under `sword-axe-mace` only. Although the weapon can switch into sword, dagger, and staff forms, the key form acts as a Sword and damage type is locked to Melee. Staff/dagger scraper runs must skip CorDemi stubs rather than duplicating the family into those subtype datasets.

## Glossary

### Currency & Access Abbreviations

| Abbrev | Full Name | Description |
|--------|-----------|-------------|
| DA | Dragon Amulet | Premium account status (one-time purchase). Items marked "DA Required" can only be equipped by players who own a Dragon Amulet. |
| DC | Dragon Coins | Premium currency purchased with real money. Used to buy exclusive items or bypass DA restrictions. |
| DM | Defender's Medals | Earned currency from participating in wars. Used at Defender's Medal shops. |
| Gold | Gold | Standard in-game currency earned from quests and battles. |

**Important note on DA requirements:** DA is per-obtain-variant, not per-item or per-level. Example: Goldfish Knight has 7 levels (I-VII), each with 2 obtain methods (free quest drop and 150 DC purchase). The free option requires DA at levels IV-VII but NOT at I-III. The DC option does NOT require DA at any level. This means the item should show hasDA, hasDC, AND hasFree tags.

**DA scoping on multi-variant posts:** When a forum post has both a base (DA) variant and a DC variant in the same thread, the DA tag image only applies to the title block it immediately precedes — it does NOT propagate to sibling title blocks. Section-level DA is only applied to non-DC obtain methods; DC methods keep their own per-block detection. The access-flag-repair preserves explicitly-scraped `daRequired=true` (from a DA tag on that specific variant's section) and will not override it.

### Guests vs Pets: Key Differences

**Guests** are companions you invite to join your party temporarily. They:
- Are NEVER purchased (no price, DC, DM, or Gold costs)
- Are obtained by invitation (completing quests, meeting requirements)
- Can require DA (some guests are DA-only)
- Have detailed combat stats (HP, MP, STR, DEX, etc.)
- Use badge-style obtain cards (location + requirements only, no price fields)
- **L1 filters**: Only "All" and "DA Required" (never Free/DC/DM tags)

**Pets** are permanent companions. They:
- Can be purchased (Gold, DC, DM) OR obtained free (quest rewards)
- Can be merged (crafted with required items)
- Can require DA for certain obtain methods
- Have simpler stats (level, damage, element)
- Show price/sellback information in obtain cards
- **L1 filters**: "All", "Free", "DA Required", "DC", "DM", "Merge Required"

### Price Type Definitions

| Type | Condition | Example |
|------|-----------|---------|
| free | Price is "N/A", "0 Gold", or "Free" AND no required items | Quest reward pet |
| merge | Price is "N/A" AND has required items | DM shop items, crafted items |
| gold | Price contains a Gold amount | "500 Gold" |
| dc | Price contains Dragon Coins | "150 Dragon Coins" |
| dm | Price contains Defender's Medals | "75 Defender's Medals" |

### Access Flag Computation

Family-level flags are computed from ALL obtain variants across ALL level variants:

- `hasDA` = ANY obtain variant has `daRequired=true`
- `hasDC` = ANY obtain variant has `priceType='dc'`
- `hasDM` = ANY obtain variant has `priceType='dm'`
- `hasFree` = ANY obtain variant has `priceType='free'`
- `hasMerge` = ANY obtain variant has `priceType='merge'`

Note: A single item can have multiple flags simultaneously. Example: Goldfish Knight has hasDA=true (free option at IV-VII requires DA), hasDC=true (DC purchase option exists), AND hasFree=true (free option exists at I-III without DA and IV-VII with DA). This is because different obtain methods exist across its level variants.

### Shared Variant Ordering

When a family has multiple variants at the same displayed level with the same stripped name, order the rows and selector labels by access branch: base/no special access first, DA-only second, DC last. Examples: `(Base)`, `(DC)` for unnamed access splits; `II`, `II (DC)` for Roman families. This ordering is shared across pets/guests, accessories, and weapons, and current JSON assets are normalized so the displayed table and selector order match the scraper output.

## Coding Standards

### Documentation Policy

**NO scattered MD files in project root!** Documentation belongs in one of two places:

1. **AGENTS.md** (this file) — Project-wide documentation, architecture, workflows
2. **Spec folders** (`.kiro/specs/{feature}/`) — Feature-specific living documentation

**Rules:**
- DO NOT create standalone MD files in project root (except README.md)
- Temporary debug/test notes should be deleted after use
- Feature documentation goes in `.kiro/specs/{feature}/STATUS.md` as a living document
- Keep it contained, clearly sectioned, and easy to navigate

**Why:** Scattered MD files create clutter and make it hard to find information. Consolidating keeps the project clean and maintainable.

### TypeScript
- Strict mode enabled
- No `any` types (use `unknown` if truly needed)
- Prefer interfaces over types for object shapes
- Export types from dedicated type files

### React Patterns
- Functional components only
- Custom hooks for shared logic (prefix with `use`)
- React.lazy for page-level code splitting
- Props interfaces defined above component

### Card Components (Standard Pattern)

**List View Cards:**
All list view cards must follow this pattern:
- **Fixed height**: `h-[120px]` (not min-height)
- **Title**: `line-clamp-1` (single line with ellipsis)
- **Description**: `line-clamp-2` (two lines with ellipsis)
- **Layout**: Flex with metadata row, title, description, chevron icon
- **Interaction**: Hover lift (`hover:-translate-y-0.5`), border highlight, shadow increase
- Examples: `BadgeCard.tsx`, `PetCard.tsx`

**Obtain Cards (Detail Pages):**
All "How to Obtain" sections must follow this unified pattern:
- **Styling**: `bg-bg-surface border-l-4 border-gold rounded-lg p-5`
- **Heading**: INSIDE the card, not above it
  - Style: `text-xs font-semibold text-text-muted uppercase tracking-wider mb-3`
  - Text: "How to Obtain" (singular), append "(Method 1)", "(Method 2)" if multiple methods
- **Content-specific fields**:
  - **Badges/Guests**: Location/instruction only
  - **Pets**: Location + divider + price/required items/sellback fields
- **Implementation**: Inline styling in detail pages for flexibility (not a shared component)
- Examples: `BadgeDetailPage.tsx`, `PetDetail.tsx` (handles both pets and guests)

**Detail Page Section Order:**
All item-family detail pages should use a consistent information order unless a category has a documented reason to differ:
1. Title, metadata pills (scoped to selected variant), description, release date
2. Primary image / alternative images when supported
3. Category-specific metadata strips
4. Stats / variant selector
5. Rarity and ability/attack sections
6. How to Obtain
7. Other Information
8. Sources
9. Also See

**Image selector independence:** On pets and guests, the image selector is independent from the level/variant selector — switching variants does not move the image. The image only resets when navigating to a different entry. Weapons intentionally link the two selectors under their own conditions (variant-specific images); pets/guests do not.

**Image expectation and placeholders:** Badges, pets/guests, weapons, and image-bearing accessory subtypes should display the shared missing-image placeholder when an expected image is absent or fails to load. For accessories, this requirement applies to capes/wings and helms, plus artifacts that are helm/cape-like by item type or equip spot. Do not apply this placeholder rule to belts, bracers, necklaces, rings, trinkets, or non-helm/cape artifacts. Some items are intentionally invisible and should not show the placeholder; document these as hardcoded exceptions and preserve their Other Information notes instead (for example: Cloak of Shadows, Invisible Cape, Invisible Helm, Mantle of Shadows, Wrap of Shadows). For every future category, ask whether images are expected before implementing the detail image section or placeholder behavior.

`Also See` must appear below `Sources` and should use the same related-card section treatment as Pets/Guests: top border, compact uppercase heading, and a responsive two-column card grid.

**Expandable attack/skill cards:** Expanded attack content should use one consistent padded content shell (`p-4 sm:p-5`) with vertical spacing between blocks. Avoid mixing per-child top/bottom margins for effect text, stats tables, notes, and attack images; this keeps guest attacks, pet attacks, trinket skills, and weapon specials visually aligned.

`Also See` may combine explicit forum refs with conservative inferred refs. Inferred refs are category-scoped and should require a normalized obtain-method match plus high name similarity. Cross-subtype inferred refs are allowed only inside a top-level category that can load all subtype JSON together (currently Accessories and Weapons); visually distinguish cross-subtype cards with a small subtype chip where the card design supports it. Pets/Guests, Accessories, and Weapons share `src/hooks/useRelatedItems.ts` for explicit refs, reverse explicit refs, and inferred refs; category hooks should provide adapters instead of duplicating that algorithm. Future family-capable categories should use this shared hook first, then add category-specific inference through its optional extension points only when the existing obtain-fingerprint rule is insufficient.

**Inferred Also See matching** uses `obtainMethodInferenceFingerprint` (location + priceType + variant-normalized recipe) — a relaxed fingerprint that ignores exact prices, DA/DC flags, and access requirements. This lets items from the same shop at the same price type (e.g. all "Rare Pets" DC items, or merge recipes differing only by variant label) link to each other. The conservative name-similarity threshold (Jaccard + prefix scoring ≥ 0.55) prevents false positives. Examples: all 12 Plushie pets link; Exalted Blaster (Amalgam/Destiny/Doom) trinkets link.

Weapons additionally infer exact-name cross-subtype siblings when the displayed name is specific enough and at least one obtain price type overlaps. This covers same-named sword/scythe/staff/dagger counterparts without merging them into one family.

For subtype-heavy datasets, alias/canonical checks must be scoped to the subtype when slugs can validly repeat across subtypes. A family alias should never point at another canonical entry in the same subtype; scraper cleanup should drop that alias rather than deleting the canonical entry. Alias lists should be unique and should not include the family’s own canonical slug; same-thread families often generate repeated slug candidates and must dedupe them before writing JSON.

### Styling (Tailwind CSS)
- Mobile-first: write mobile styles first, then add `sm:`, `md:`, `lg:` for larger breakpoints
- Minimum 44x44px touch targets on mobile (use `min-h-11 min-w-11` or `p-3`)
- Base font: 16px (Tailwind default)
- Max content width: 75 characters for readability
- **Use design tokens** — never hardcode colours or shadows (see token table below)

### Filter Pills Pattern (applies to all content sections)

**Universal Filter Hierarchy** (all pages follow this pattern):

**Level 1 (Highest): Access filters** — Universal across all pages
- Styling: `bg-gold-bright text-bg-base` when active, `text-xs px-3 py-1.5` sizing
- Options: `All`, `Free` (if applicable), `DA Required` (if applicable), `DC` (if applicable)
- Badges: Mutually exclusive (single-select)
- Pets: Multi-select with AND logic (can be both DA Required AND Free/DC/DM)
- Page-specific subset based on content type

**Level 2: Category filters** — Page-specific content categories
- Styling: `bg-orange-500/80 text-white` when active, `text-[11px] px-2.5 py-1` sizing (unless explicitly overridden)
- Mutually exclusive within level (badges) or multi-select (pets)
- Examples: Badges (Quests, Classes, Challenges, Seasonal, Other, Retired), Pets (Temp, Rare, Seasonal, etc.)

**Level 3: Subcategory/Element filters** (if applicable)
- Styling: `bg-gold/20 text-gold border-gold/50` when active, `text-[10px] px-1.5-2 py-0.5` sizing
- Nested under active Level 2 category (badges) or independent multi-select (pets)
- Examples: Badges (Book 1 & 2, Book 3, Side Quests), Pets (ICE, FIR, SHR element/trait codes)

**Visual Hierarchy**: Each filter level is visually distinct through size — L1 (largest), L2 (medium), L3 (smallest)

**Badges Page** — Filter levels applied:
- **Level 1**: All, DA Required
- **Level 2**: All, Quests, Classes, Challenges, Seasonal, Other, Retired (mutually exclusive)
  - Note: Retired is a special category — selecting it shows only retired badges; other L2 categories exclude retired badges by default
- **Level 3**: Subcategories (e.g., "Book 3", "Side Quests") — only appear when a L2 category is selected

URL query params supported by `/badges`:
- `access` — `all` (default) or `da` for DA Required
- `category` — filter by category ID (e.g. `combat`, `seasonal`) or `retired` for retired badges
- `sub` — filter by subcategory (e.g. `Book+3`, `Arena+Challenges`)
- `q` — text search

By default, retired badges are hidden from all categories. They only appear when `category=retired` is set.

**Pets/Guests Page** — Filter levels applied:
- **Segment Toggle** (top): Pets, Guests (both active by default, multi-select)
- **Level 1**: Multiple Versions, DA Required, Merge Required, Free, DC, DM (multi-select with AND logic)
  - **Guest-only mode**: Only "Multiple Versions" and "DA Required" shown (guests are never purchased)
  - **Pet-only or Both modes**: All filters shown
  - Note: An entry can be both DA Required AND Free/Merge/DC/DM
  - Pet-only filters (Merge Required, Free, DC, DM) are hidden when Guests only is selected
  - No label text (pills displayed directly, consistent with Badges page)
- **Level 2**: Multi-select categories — Temp, Rare, Seasonal, Special Offer, Retired (OR logic)
  - Works like badges: when Retired selected, only show retired; otherwise exclude retired
  - No label text (pills displayed directly, consistent with Badges page)
- **Level 3**: Element/Trait filters (multi-select pills, OR logic, custom colours)
  - No label text (pills displayed directly, consistent with Badges page)
- **Legend**: Expandable reference for element codes (below filters)

URL query params supported by `/pets`:
- `type` — `pet`, `guest`, or comma-separated `pet,guest` (default: both)
- `access` — comma-separated: `da`, `free`, `merge`, `dc`, `dm` (e.g., `da,free` for DA Required AND Free)
- `category` — comma-separated: `temp`, `rare`, `seasonal`, `special-offer`, `retired`
- `element` — comma-separated element/trait codes (e.g. `ICE,FIR,SHR`)
- `q` — text search

**Accessories Page** — Filter levels applied:
- **Subtype selector**: query-param-driven subtype switcher on `/accessories?type=artifact|belt|bracer|cape-wing|helm|necklace|ring|trinket`
- **Level 1**: `Multiple Versions`, `DA Required`, `Merge Required`, `Free`, `DC`, `DM`
- **Level 2**: `Cosmetic` when the loaded subtype dataset contains cosmetic entries; then `Temp`, `Rare`, `Seasonal`, `Special Offer`, `Retired` where present
- **Level 3**: Element filters
- **Detail pages**: shared accessory detail layout with family switching, obtain cards, and trinket skill rendering when linked ability posts exist

Accessory consolidation defaults to keeping same-thread or explicitly connected level/access variants together as one item family. Split related accessories into separate entries only when they are meaningfully different items and the forum relationship should be represented as `Also See` instead of a selector. Example: Necromancer Cape and Necromancer Cloak are separate entries with mutual Also See links, while same-name level/DC branches normally remain one family with clear variant labels.

Some helm families are intentionally split even when they are same-thread or explicitly linked, because mixing Roman/numeric progressions with named sibling items makes the selector harder to read. These are handled as hardcoded accessory post-processing exceptions and linked back together through `Also See`: Baron Cat Mask / Fierce Baron Cat Mask, Dravir Warhelm / Radiant Dravir Warhelm, Greedy Greedling Helm / Super Greedy Greedling Helm, Royal Doom / Retroclear Royal Doom, and Tyrant Hood / Magical Tyrant Hood.

Before promoting that split rule broadly, audit all family-capable datasets for mixed progression labels (Roman/numeric levels plus named siblings) and spot check candidates with the user. Do not auto-split broad candidates without review, because some mixed labels are intentional progression names. Separately, Shocking Hair is a cross-post helm family that consolidates Shocking Hair, Shockingly Good/Nice/Swiped/Amazing/Fantastic/Awesome Hair; Electric Hair stays standalone and links through `Also See`.

Stats tables and selectors should avoid redundant variant columns. A one-row family never needs a Variant column. If all variant labels are only access labels like `(Base)` / `(Base) (DC)` and the levels are unique, treat the selector/table as level-driven instead of variant-driven; same-level access branches can still show variant labels where needed.

On detail pages, metadata is split into distinct types:

**Clickable filter pills** (structured metadata — link to list page with filter applied):
- **Category/Element pill** → links to `/[section]?category=X` or `/pets?element=ICE`
- **DA Required pill** → links to `/[section]?access=da`
- **DC pill** → links to `/[section]?access=dc` (shows DC logo on Pets/Weapons, not on Badges)
- **Retired pill** (Badges) → links to `/badges?category=retired`
- Style: Level 1 filters use gold styling, Level 2 use orange/custom colours, cursor pointer, hover opacity

**Non-clickable tags** (raw search keywords for the search index, not a filter):
- Displayed in a "Tags" section with a label making the distinction clear
- Style: muted grey pill, no hover state, `cursor-default`
- Tags are for search relevance only, not navigation

When implementing future sections (Quests, Locations, Weapons, etc.), follow the same pattern:
- Level 1: Access filters (All, Free if applicable, DA Required if applicable, DC if applicable)
- Level 2: Content-specific categories (mutually exclusive within level)
- Level 3: Subcategories nested under L2 (if applicable)
- Detail pages: Structured metadata → clickable pills; raw keywords → non-clickable tags section

### Design Token ReferenceAll colours are defined in `src/index.css` as a Tailwind CSS 4 `@theme` block. Use the corresponding utility classes:

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-bg-base` | `#111315` | Page background |
| `bg-bg-surface` | `#1a1a1a` | Cards, content panels |
| `bg-bg-elevated` | `#212529` | Navigation, overlays |
| `bg-bg-overlay` | `#343a40` | Hover states, chips |
| `border-border-default` | `#343a40` | Default borders |
| `border-border-hover` | `#495057` | Hover border colour |
| `text-gold` | `#f69a07` | Headings, active nav, accents |
| `text-gold-bright` | `#ffc107` | CTAs, active filter chips |
| `text-text-primary` | `#f8f9fa` | Body text, headings |
| `text-text-secondary` | `#9ca3af` | Supporting text |
| `text-text-muted` | `#6c757d` | Timestamps, labels, placeholders |
| `shadow-subtle` | — | Cards resting state |
| `shadow-medium` | — | Cards hovered state |

### File Naming
- Components: PascalCase (BadgeCard.tsx)
- Hooks: camelCase with `use` prefix (useBadges.ts)
- Utils: camelCase (search.ts)
- Data: kebab-case (badges.json)

### Item Title Display and Sorting
- Display item titles with leading articles in natural reading order. Forum titles like `Golden Egg, The` should render as `The Golden Egg`.
- Sort item titles by an article-insensitive key, so `The King's Crown` sorts under `K`, not `T`.
- Keep existing slugs and source URLs stable; this rule is presentation and ordering only unless a scraper explicitly needs to normalize newly generated data.

### Forum Description Copy
- Use the forum's own category and subtype descriptions for section cards, list-page headers, and landing-page blurbs whenever the forum provides usable text.
- Write original UI copy only when the forum has no direct description or when a combined app surface needs a concise blend of multiple forum descriptions.

### Responsive Breakpoints
- Mobile: default (< 640px)
- Tablet: `sm:` (640px+)
- Desktop: `lg:` (1024px+)

## Data Curation Workflow

### Adding a New Badge

1. Find badge info on the DragonFable forums
2. Add entry to `src/data/badges.json`:

```json
{
  "id": "unique-slug-here",
  "name": "Badge Display Name",
  "slug": "unique-slug-here",
  "description": "Flavour text / italic description from the forum post",
  "category": "quest-completion",
  "subcategory": "Side Quests",
  "requirements": "Completion of Quest Name",
  "daRequired": false,
  "retired": false,
  "howToObtain": [
    { "order": 1, "instruction": "Completion of Quest Name" }
  ],
  "forumLinks": [
    {
      "url": "https://forums2.battleon.com/f/tm.asp?m=XXXXX",
      "title": "DF Encyclopedia: Badge Name",
      "isPrimary": true
    }
  ],
  "imageUrl": "https://raw.githubusercontent.com/DF-Pedia/DF-Pedia/master/badges/BadgeName.png",
  "tags": ["subcategory-tag"],
  "notes": "Optional bullet 1. • Optional bullet 2."
}
```

3. Commit and push → site auto-deploys

### Bulk Import via Scraper

A scraper script is available to automatically populate badges.json from the forum:

```bash
# 1. Get your session cookie (see .env.example for instructions)
cp .env.example .env
# 2. Paste your cookie into .env (see instructions in the file)
# 3. Run the scraper
npm run scrape:badges
```

The scraper:
- Fetches the **A-Z Badges master post** (`tm.asp?m=22304590&mpage=1`) — single page containing all badge names, forum links, and category groupings
- Fetches **each individual badge thread** (161 requests at 0.8s intervals ≈ ~4 minutes total) to get: description, DA status, requirements, category, notes
- Maps badges to subcategories using the forum's "Badges Sorted by Category" post groupings
- Applies seasonal category overrides: forum labels Mogloween/Frostval/HHD badges as "Other Badges" — remapped by name
- Writes complete `badges.json` sorted alphabetically

After scraping, run `python3 scripts/add_images.py` to add badge image URLs from DF-Pedia GitHub, and `python3 scripts/add_subcategories.py` to re-apply subcategory mappings.

**Cookie expiry**: The forum cookie expires after some time. If the scraper fails, refresh the forum page in your browser and re-copy the cookie.

### Current badge dataset (last scraped: June 2026)

| Display Name | Category ID | Subcategories | Count |
|--------------|-------------|---------------|-------|
| Quests | `quest-completion` | Early Days, Book 1 & 2, Book 3, Side Quests | 72 |
| Classes | `collection` | Trained Classes, Special Classes | 31 |
| Challenges | `combat` | Arena Challenges, Skills | 27 |
| Seasonal | `seasonal` | Hero's Heart Day, Mogloween, Frostval | 24 |
| Other | `misc` | PvP, Warmonger, Misc, Retired | 7 |
| **Total** | | | **161** |

Retired badges (Party On, Olaf!, Idle Heroes, etc.) are included in the dataset but marked `retired: true` and grouped under the "Retired" subcategory.

1. Fetches the **A-Z Badges master post** (`tm.asp?m=22304590&mpage=1`) which lists all 161 active badges alphabetically with forum links, plus the retired section
2. Parses each badge link and detects `retired: true` for anything that only appears in the retired section
3. Fetches **each individual badge thread** (161 requests at 0.8s intervals ≈ ~4 minutes total) to get: description, DA status, requirements, category, notes
4. Applies category overrides: seasonal badges labelled "Other Badges" by the forum are re-mapped by name pattern (Mogloween, Frostval, HHD, etc.)
5. Writes complete `badges.json` sorted alphabetically

## Pets Section

### Mixed Variant Group Splits

Pets usually keep same-thread or linked variants together, including normal/DC access branches and level progressions. Split a pet family only when one family mixes a named progression group with a distinct named sibling item that is clearer as its own entry. Current targeted split set: Baron/BraveSirRobin/Deatharrows/Josh/LFAL/Prius `(Kitten, Cat)` pets are separate from their `Fierce ... Cat` pets, `Goldfish` is separate from `Goldfish Knight`, `Steam Tog` is separate from `PowerTog`, and `Extra Fluffy Tog Extreme` is separate from `Extra Fluffy Tog I-III`; split siblings receive mutual `Also See` links.

### Data

**Pets and guests are stored in separate files:**

- **`src/data/pets.json`** — Pet entries only (`type: "pet"`) - 221 entries
- **`src/data/guests.json`** — Guest entries only (`type: "guest"`) - 83 entries  
- **`src/data/badges.json`** — Badge entries - 161 entries
- **`src/data/elements.json`** — 22 elements + 5 traits (A/C, ALA, N/A, SHR, W/S)

**UI Loading:**
- `src/hooks/usePets.ts` loads **both** pets.json and guests.json
- Combines them into one browsable in-memory dataset for UI consumption
- Components can receive either single entries or shared `ItemFamily` structures, depending on the data
- Datasets are loaded lazily via `src/utils/dataLoaders.ts` and cached in memory after first load

**Why separate files?**
- Clear data ownership (pets scraper → pets.json, guests scraper → guests.json)
- Independent update cycles
- Easier to manage and debug
- No type filtering needed before writing

### Key Types

- `Pet` — full pet/guest entry with elements, traits, obtainMethods, attacks, evolutions, alsoSee, category flags
- `EntryType` — `'pet' | 'guest'`
- `ObtainMethod` — location, price, priceType (`gold|dc|dm|free|merge`), requiredItems, sellback
  - `free` = explicit "0 Gold" or "Free" price
  - `merge` = Price is "N/A" AND has requiredItems field
- `AlsoSeeRef` — `{ name, slug, type }` for typed cross-references
- `Trait` — behavioural markers (A/C=As Character, SHR=Shrinks, etc.)
- Category flags — `dmRequired`, `isTemp`, `isRare`, `isSeasonal`, `isSpecialOffer`, `retired` (all optional booleans)

### Slug convention

All pet/guest slugs are **type-prefixed**: `pet-king-linus`, `guest-artix`. This ensures global uniqueness across types.

### Scraper

```bash
npm run scrape:pets               # Scrape all pets
npm run scrape:pets -- --letter=A  # Scrape only letter A (for testing)
npm run scrape:pets -- --start=C   # Resume from letter C onwards
npm run scrape:pets -- --letters=A,B # Scrape multiple letters
npm run scrape:pets -- --names="Goldfish Knight" # Refresh specific pet names
npm run scrape:pets -- --names="Goldfish Knight" --fresh # Ignore matching cached entries
npm run images:pets                # Add DF-Pedia GitHub images to pets.json
npm run images:pets -- --letters=A,B # Add images for specific letters only
```

**Guest Scraper:**
```bash
npm run scrape:guests                # Scrape all guests
npm run scrape:guests -- --letter=A   # Scrape only letter A (for testing)
npm run scrape:guests -- --letters=A,B # Scrape multiple letters
npm run scrape:guests -- --names=Aegis # Refresh specific guest names
npm run scrape:guests -- --names=Aegis --fresh # Ignore matching cached entries
npm run scrape:guests -- --fresh --concurrency=1 # Local full refresh; scrapes normal guest data/images and reuses generated CharPage PNGs without running Ruffle
npm run scrape:guests -- --names="Cranix|Dain Lorilann|Elgert|Mennace|Xor Vrailin II" --fresh --concurrency=1 --capture-charpages # Slow local A/C CharPage capture/recapture
npm run images:guests                 # Extract guest images from forum to guests.json
npm run images:guests -- --force      # Force refresh all guest images
```

Progress saved to `src/data/pets-progress.json` (gitignored).

**Multi-Variant Detection (Sprint 5)**:
Sprint 5 adds support for multi-variant pets (like Goldfish Knight I-VII). See `.kiro/specs/multi-variant-items/SPRINT5_GUIDE.md` for detailed implementation instructions. Status: IN PROGRESS. Current scraper outputs single-variant Pet objects; multi-variant detection will output ItemFamily objects for pets with multiple levels/obtain methods.

**DA/DC Detection:**
- `daRequired`: Automatically detected if forum post contains `<img src="...tags/DA.png">`
- `dcRequired`: Automatically detected if forum post contains `<img src="...tags/DC.png">`
- `dmRequired`: Automatically detected if forum post contains `<img src="...tags/DM.png">`
- Both flags are set at scrape time by checking for image tags in the raw HTML
- An entry can be both DA and DC/DM
- For multi-variant families, DA/DC are detected per-title-block: a DA tag before the base title block does NOT bleed onto the DC variant unless the DC block also has its own DA tag
- Access-flag-repair preserves explicitly-scraped `daRequired=true` values and will not clear them. Narrow item-specific repairs may override this only where the forum pattern is known; Goldfish Knight levels IV-VII are `Normal` DA-only plus `DC` DC-only.

**Multi-Variant Access Branches (Pets):**
When a pet thread has both a free/base variant and a DC variant, the scraper splits them into separate level variants using `buildLevelAccessVariants`:
- `variantName: 'Normal'` → displays as `(Base)` in the UI
- `variantName: 'DC'` → displays as `(DC)` in the UI
- Forum label `(Resource)` is mapped to `Normal` (same as base tier)
- For "(All Versions)" families where the same labels repeat across levels, the UI prefixes with the level in parentheses: `(10)`, `(10) (DC)`, `(20)`, `(20) (DC)`, etc.

**Attack Images:**
Pet attack image links should be retained when the forum hotlinks attack labels (for example Goldfish Knight's `Attack Type 1` / `Attack Type 2`). Combined attack labels such as `Attack Type 1 / 1.1` should inherit images from matching sublabels, and sparse family variants should inherit attack images from siblings with the same attack name and description. Attack image URL parsing must allow apostrophes inside quoted DF-Pedia URLs, such as `Ostara'sDracobunny-AttackType1.0.png`. Detail pages must keep attack images hidden by default behind an explicit image toggle, after the attack description, rate strip, and any attack-specific notes. Multi-image attacks should display each image with its sub-attack caption when the label count matches the image count, such as `Attack Type 1` and `Attack Type 1.1`. Pet attack rates in `(Rate: X)` / `[Rate: X]` text use the same shared metric-strip display as weapon specials, with the rate removed from the prose. Use the shared expandable image list when extending this pattern to guest appearances, trinket skills, and weapon specials.

`<Dragon>` pet skills are a targeted scraper special case. Only the current `Pet Dragon Skills (2019-Present)` block is parsed; retired 2015-2019 and 2007-2015 skill sections are ignored and must not mark the pet retired. Dragon skill cooldowns are stored on the attack and rendered through the same metric strip as rates. The Noxious Fumes images are stage-specific and use the explicit `Dragon-Stun-{Baby|Toddler|Kid}1.0/1.1.png` DF-Pedia URLs when the forum's combined appearance label cannot be split into normal hotlinks.

**Family Elements and Traits (Additive):**
Family-level `elements` and `traits` are the UNION across all variants. Example: Linus's base form is `[ICE]` while Prince/King/Emperor Linus are `[ICE][SHR]`, so the family exposes both. Per-variant `traits` are stored on each `LevelVariant` to scope element/trait pills on detail pages to the selected variant. The card gallery shows the family-level union.

**Category Detection (Level 2 filters):**
- `isTemp`: Detected via `<img src="...tags/Temp.png">`
- `isRare`: Detected via `<img src="...tags/Rare.jpg">`
- `isSeasonal`: Detected via `<img src="...tags/Seasonal.jpg">`
- `isSpecialOffer`: Detected via `<img src="...tags/SpecialOffer.png">`
- `retired`: Detected via `<img src="...tags/Retired.png">`
- An entry can have multiple L2 categories (e.g., both Seasonal AND Rare)

**Type Detection (Pet vs Guest):**
- **Primary source**: A-Z Pets & Guests master page sections — pets and guests are scraped from their dedicated sections
- **Fallback/reference**: Chronology is still fetched for release dates and historical cross-checks

**Workflow:**
1. `npm run scrape:guests` — scrapes forum data (descriptions, attacks, DA/DC/DM/categories, source URLs from direct reply posts, release dates from Chronology)
2. `npm run images:guests` — adds DF-Pedia GitHub image URLs for guests (auto-uses Python venv)
   - Searches for images BEFORE "Appearance" section
   - Skips button/attack images (anything with "Button", "Attack.png" in URL)
   - Not all guests have images on forum — broken images show fallback UI

**Local A/C guest CharPage capture:**
- Guest entries tagged `A/C` can sometimes link only to old DragonFable character pages that render through Flash/Ruffle instead of exposing a normal image URL.
- Normal guest scrapes still collect all standard forum data and ordinary image URLs, but they do not open Ruffle/Playwright for CharPage screenshots. If a generated CharPage PNG already exists, the scraper reuses it quickly; otherwise the entry remains missing an image.
- Add `--capture-charpages` together with `--name`/`--names` to explicitly run the slow local-only capture for named missing-image `A/C` guests when a DragonFable character-page link is present in the forum post.
- Captured PNGs are written to `public/generated/guests/charpages/{guest-slug}.png` and the scraper stores the public path in `guests.json`.
- This is not production runtime logic; the live app only serves the captured static image.
- One-time local setup after installing dependencies: `npx playwright install chromium`.
- Recommended local refresh command: `npm run scrape:guests -- --fresh --concurrency=1`.
- Recommended targeted capture command: `npm run scrape:guests -- --names="Cranix|Dain Lorilann|Elgert|Mennace|Xor Vrailin II" --fresh --concurrency=1 --capture-charpages`.
- If Ruffle changes or the CDN is unavailable, set `RUFFLE_SCRIPT_URL` to a local/self-hosted Ruffle script URL before running the scraper.

**Dragon guest special case:**
- `<Dragon>` guest is sourced from `https://forums2.battleon.com/f/tm.asp?m=16130782`, but the current A-Z guest list does not expose a canonical `guest-dragon` row. The guest scraper injects a synthetic `guest-dragon` stub so full and targeted guest scrapes keep this as its own guest itemfamily.
- Variant posts: `16130782` = Toddler, `22231249` = Kid, `22231251` = Dragon of Doom. Skill posts: `22231250` = current Toddler/Kid skills, `22231252` = Dragon of Doom skills. Shared notes come from the thread's final Other Information post.
- Guest attack appearance parsing supports multiple appearance images per skill through `appearanceUrls`, displayed behind the existing collapsed attack panels.

**Python Environment:**
- Image scripts automatically create and use a Python virtual environment (`.venv/`)
- First run will setup the venv and install `requests` library
- To manually setup: `npm run setup:python`
- Venv is gitignored and local to your machine

### Shared Reusable Components

| Component | Description | Used in |
|-----------|-------------|---------|
| `ElementPill` | Colour-coded element/trait chip | Pets, future Weapons |
| `ElementLegend` | Expandable element reference panel | Pets, future sections |
| `StatBar` | Compact stat boxes | Pets, future combat entities |
| `SegmentToggle` | Multi-select type toggle (Pets/Guests) | Pets |
| `AccessPills` | DA Required + DC + DM tags | Pets, Badges (future), all sections |

**Note**: All content types (Badges, Pets, Guests) use unified obtain card styling with gold left border. The heading "How to Obtain" is positioned INSIDE the card. Pets show additional price/sellback fields below a divider; Badges and Guests show location only.

### Notes on data quality

- Release dates and images vary substantially by source post quality and forum age
- Forum images remain sparse for many pets because many posts do not expose standalone sprite assets
- Attribution lines ("Thanks to X for Y") are stripped at scrape time and render time
- Edit timestamps are stripped from notes
- `traits` field (formerly `specialMarkers`) represents behavioural markers, NOT elements

### Badge Categories

The app uses 5 top-level categories, matching the forum's "Badges Sorted by Category" grouping:

| Category ID | Display Name | Forum Name | Subcategories |
|-------------|--------------|------------|---------------|
| `quest-completion` | Quests | Quests Badges | Early Days, Book 1 & 2, Book 3, Side Quests |
| `collection` | Classes | Classes Badges | Trained Classes, Special Classes |
| `combat` | Challenges | Challenges Badges | Arena Challenges, Skills |
| `seasonal` | Seasonal | Other Badges (seasonal) | Hero's Heart Day, Mogloween, Frostval |
| `misc` | Other | Other Badges (misc) | PvP, Warmonger, Misc, Retired |

## Development Commands

### Clear Data Cache

```bash
npm run clear:pets      # Clear pets.json and pets-progress.json
npm run clear:guests    # Clear guests.json and guests-progress.json
npm run clear:all       # Clear both pets and guests
```

### Scraping Workflows

**Pet Scraping:**
```bash
npm run clear:pets              # Clear existing data
npm run scrape:pets             # Scrape all pets → pets.json (includes images from forum)
npm run scrape:pets -- --letter=A  # Scrape only letter A (for testing)
npm run scrape:pets -- --letters=A,B  # Scrape multiple letters
npm run scrape:pets -- --names="Goldfish Knight"  # Refresh specific pet names
```

**Guest Scraping:**
```bash
npm run clear:guests            # Clear existing data
npm run scrape:guests           # Scrape all guests → guests.json (includes images from forum)
npm run scrape:guests -- --letter=A   # Scrape only letter A (for testing)
npm run scrape:guests -- --letters=A,B # Scrape multiple letters
npm run scrape:guests -- --names=Aegis --fresh # Refresh a specific guest and bypass cache
```

**Badge Scraping:**
```bash
npm run scrape:badges
npm run scrape:badges -- --names="Arachnalchemy Mastery" # Refresh specific badge names
```

**Accessory Scraping:**
```bash
npm run scrape:accessories                          # Scrape all accessory subtype datasets
npm run scrape:accessories -- --subtypes=trinket   # Scrape a single subtype
npm run scrape:accessories -- --subtypes=bracer,trinket --letters=A,B
npm run scrape:accessories -- --subtypes=cape-wing --names="Mantle of Shadows,Invisible Cape"
```

**Weapon Scraping:**
```bash
npm run scrape:weapons -- --subtypes=scythe --letters=A
npm run scrape:weapons -- '--letters=#' --concurrency=2
npm run scrape:weapons -- --subtypes=scythe --names="Abyssal Heart"
npm run scrape:weapons -- --subtypes=scythe --url='https://forums2.battleon.com/f/tm.asp?m=22357170'
```

**Notes:**
- All scraper entry points support `--names="Name One,Name Two"` for scoped refreshes. Pets and guests also support `--fresh` to bypass cached progress for the selected names.
- Scoped name/letter runs preserve out-of-scope data instead of writing a tiny partial dataset.
- Weapons additionally support `--url=` / `--urls=` for direct forum-post refreshes when the master index is missing or misclassifying an item; pass exactly one `--subtypes=` value with direct URLs.
- Weapon index navigation links such as `(A-G)` and `(A-J)` are ignored before scraping; they are not item entries.
- Pet, guest, and accessory scrapers share forum thread post extraction so multi-variant source links can point to direct `fb.asp?m={messageId}` reply posts.
- Shared `Also See` parsing collects all `Also See:` / `Also See (...)` sections in a post, including later sections after `Other Information`, and dedupes the resolved refs.
- Family-capable partial refreshes must be family-safe: if a later batch scrapes a standalone entry whose slug is already owned by an existing family, keep the family in the merge pool and fold/canonicalize through post-processing instead of replacing the family shell. Shared guard helpers live in `scripts/lib/family-merge-guard.ts`; category-specific adapters still own variant construction.
- Helms and Capes & Wings are stored as A-L / M-Z JSON shards (`helms-a-l.json`, `helms-m-z.json`, `capes-wings-a-l.json`, `capes-wings-m-z.json`) to keep image-heavy lazy-loaded assets smaller while preserving one UI subtype.
- Both scrapers extract images directly from forum posts during scraping
- Main image and alternative images with captions are captured automatically
- Images are extracted from the forum HTML (before "Appearance" section for guests to avoid skill buttons)
- For long targeted scrape runs, Codex should give the user the exact terminal command, prerequisite notes, and expected output files so the user can run the scrape locally while Codex focuses on scraper logic, validation, and data review. Codex can still run short targeted scrapes when needed to verify a fix in the current task.
- Scrapers must automatically regenerate any lightweight manifest/count files for the datasets they write. Manifest refresh should not be a manual post-scrape step.
- Deleted/moved forum posts (HTTP 500 on `printable.asp`) are handled gracefully via `isPostUnavailableError` — the item is skipped with a warning and the run continues. This applies to all scrapers (weapons, accessories, badges, pets, guests).
- For multi-post accessory families, trailing posts that contain no item data (e.g. a shared "Other information" + credits post) are checked for supplemental notes and armor customization, which are applied as shared family data.

### Other Commands

```bash
npm run dev            # Start development server
npm run build          # Production build
npm run preview        # Preview production build locally
npm run lint           # Run Oxlint
npm run format         # Run Prettier
npm run scrape:badges  # Scrape forum badges (supports --names)
npm run scrape:pets    # Scrape forum pets (supports --letters, --names, --fresh)
npm run scrape:guests  # Scrape forum guests (supports --letters, --names, --fresh)
npm run scrape:accessories # Scrape accessories (supports --subtypes, --letters, and --names)
npm run scrape:weapons # Scrape weapons (supports --subtypes, --letters, --names, and --url/--urls)
npm run validate       # Run all dataset validators + cross-post-family verify + script typecheck
npm run verify         # Cross-post-family invariant checks (dup slugs, alias/AlsoSee integrity)
npm run images:guests  # Extract guest character images from forum (auto-uses venv)
```

**Dataset verification (`npm run verify`)** runs `scripts/verify-datasets.mjs` over the
family-capable datasets (accessories, weapons, pets/guests) and is also part of `npm run
validate` / `npm run build`. It separates:

- **Errors (fail the build):** duplicate canonical slugs; `Also See` / evolution refs that
  point at an alias slug instead of the canonical family slug; self-referential refs; refs
  with no local target and no URL.
- **Warnings (non-fatal):** an alias slug claimed by two families; an alias slug also emitted
  as a standalone entry. These indicate a scraper-side fix is needed and cannot be corrected
  safely by hand.

A family listing its own slug in `aliasSlugs` is an intentional same-thread convention and is
ignored by the verifier.

### Scraper Structure Guidelines

Scrapers should be treated as orchestration entry points, not long-term homes for every parsing rule. Prefer this structure as existing scrapers are touched:

- `scripts/scrape-*.ts`: CLI arguments, fetch loop, progress/reporting, final dataset write
- `scripts/lib/printable-parser.ts`: shared forum fetch/content extraction helpers
- `scripts/lib/forum.ts`: shared HTTP fetch, retry logic, rate limiting, and `isPostUnavailableError` (deleted-post detection)
- `scripts/lib/obtain-formatting.ts`: shared obtain-card parsing and display formatting
- `scripts/lib/also-see.ts`: shared `Also See:` extraction from forum HTML
- `scripts/lib/access-flag-repair.ts`: shared DA/DC/DM and category flag repair logic
- `scripts/lib/family-merge-guard.ts`: shared family-safe scoped-refresh guards and family-aware same-slug dedupe
- `scripts/lib/tags.ts`: shared retired-tag detection helper
- `scripts/lib/cross-post-family.ts`: pet/guest cross-post family promotion only
- `scripts/lib/accessories/*`: accessory subtype strategies for image rules, family inspection, conservative cross-post promotion, and subtype-specific quirks
- `src/utils/imageLabels.ts`: shared image caption inference and main/alternative image switcher labels for item detail pages. When the main image also appears in the alternatives list carrying a bold forum caption (e.g. "Pirate Monkey"), that caption takes precedence over the generic "Main" label. Guest portrait matching allows `pic`/`Petpic` suffixes (e.g. `Princesspic.png`). Attack-appearance hyperlinks in the fallback branch are NOT harvested as character alternative images.

**Guest/Trinket Attack Notes:**
Attack effect bullet points that are part of the effect description (e.g. "Performs one of the following attacks: • X • Y") stay inline in the `effect` field and are NOT split into "Other Information". Only content under an explicit `<b><u>Other information</u></b>` heading is separated into `attack.notes`. This applies to both guest attacks and trinket skills (shared via `GuestAttacks.tsx`).

Shared extraction should stop at neutral parsed facts. Category-specific behavior should stay category-specific: pets/guests may promote safe `Also See` relationships into item families; accessories may promote configured subtypes when the relationship has explicit `Also See` links plus title/content evidence, while unresolved accessory `Also See` refs should not render as source-link cards.

## Deployment

- **Platform**: Vercel or Netlify (static site)
- **Trigger**: Auto-deploy on push to `main` branch
- **Preview**: PR previews for testing changes
- **Domain**: TBD

## Constraints and Decisions

| Decision | Rationale |
|----------|-----------|
| Static site (no backend) | Zero infrastructure cost, instant deploys, simple to maintain for solo developer |
| JSON data in repo | Version controlled, no database to manage, easy to edit, validated at build time |
| Client-side search | Lazy-loaded JSON assets keep the initial app shell small while in-memory search remains fast once a section dataset is loaded |
| Mobile-first | Players likely use companion during gameplay (phone beside computer) |
| Forum hotlinks first | Provides value immediately without needing to reproduce all forum content |
| Tailwind CSS | Rapid responsive development, consistent design tokens, small bundle |
| No testing framework yet | Added when complexity warrants it; manual QA sufficient for MVP static site |

## Performance Targets

- Initial load: < 2 seconds on 3G
- Search response: < 50ms (client-side)
- Total bundle (incl. data): < 500KB gzipped
- Lighthouse: 90+ performance, 90+ accessibility

**Current loading strategy note:** large forum datasets are emitted as JSON assets and fetched lazily rather than bundled into the main JavaScript payload. This keeps the primary app chunk small while preserving the static-site deployment model.
