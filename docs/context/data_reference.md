# Data Reference

> Static reference. Extracted from the pre-refactor monolithic `AGENTS.md`.
> Covers: Data Sources, Content Sections, Glossary, Price Types, Access Flags, Variant Ordering,
> Dataset inventories, Key Types, Slug conventions, Data quality notes.

## Data Sources

### Primary: DragonFable Forums

- URL: <https://forums2.battleon.com/f/tt.asp?forumid=256>
- Most detailed and up-to-date information
- ALL content data should be sourced from here
- Forum hotlinks are included in every badge entry
- Scrapers use `tm.asp` for listing/index pages (A-Z pages, Chronology), `printable.asp?m={messageId}` for individual post content, and shared thread-page post extraction when variants need direct reply-post source URLs (`fb.asp?m={messageId}`). Printable `[image]...[/image]` tags are normalized back to `<img src="...">` before parsing.

### Secondary: DragonFable Wiki (Reference Only)

- URL: <https://dragonfable.fandom.com/wiki/DragonFable_Wiki>
- Used ONLY as inspiration for UX design and content sectioning
- NOT used as a data source

## Content Sections

Based on the DF Encyclopedia forum structure (<https://forums2.battleon.com/f/tt.asp?forumid=256>):

| Section | Route | Status | Forum Category |
| --------- | ------- | -------- | ---------------- |
| Badges | `/badges` | ✅ Active (161 badges) | Badges |
| Pets / Guests | `/pets`, `/pets/:slug`, `/guests/:slug` | ✅ Active (221 pets, 83 guests) | Pets / Guests |
| Accessories | `/accessories`, `/accessories/:slug` | ✅ Active (accessories across 8 subtypes, with split assets for image-heavy subtypes) | Accessories |
| Weapons | `/weapons`, `/weapons/:slug` | ✅ Active (4 subtypes across 11 shards) | Weapons |
| Housing | `/housing`, `/housing/:slug` | ✅ Active (Houses, Backgrounds, Floors, Rugs, Shrubs, Stuff, Wall Items) | Housing and House Items |
| Classes / Abilities | `/classes` | Planned | Classes / Abilities |
| Locations & Quests | `/locations` | Planned | Locations / Quests / Events / Shops |
| Monsters | `/monsters` | Planned | Monsters |
| NPCs | `/npcs` | Planned | NPCs |
| Stackable Items | `/items` | Planned | Stackable / Non-Equippable Items |

## Glossary

### Currency & Access Abbreviations

| Abbrev | Full Name | Description |
| -------- | ----------- | ------------- |
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
| ------ | ----------- | --------- |
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

## Pets & Guests Data

**Pets and guests are stored in separate files:**

- **`src/data/pets.json`** — Pet entries only (`type: "pet"`) — 221 entries
- **`src/data/guests.json`** — Guest entries only (`type: "guest"`) — 83 entries
- **`src/data/badges.json`** — Badge entries — 161 entries
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

### Notes on data quality

- Release dates and images vary substantially by source post quality and forum age
- Forum images remain sparse for many pets because many posts do not expose standalone sprite assets
- Attribution lines ("Thanks to X for Y") are stripped at scrape time and render time
- Edit timestamps are stripped from notes
- `traits` field (formerly `specialMarkers`) represents behavioural markers, NOT elements

## Badge Categories

The app uses 5 top-level categories, matching the forum's "Badges Sorted by Category" grouping:

| Category ID | Display Name | Forum Name | Subcategories |
| ------------- | -------------- | ------------ | --------------- |
| `quest-completion` | Quests | Quests Badges | Early Days, Book 1 & 2, Book 3, Side Quests |
| `collection` | Classes | Classes Badges | Trained Classes, Special Classes |
| `combat` | Challenges | Challenges Badges | Arena Challenges, Skills |
| `seasonal` | Seasonal | Other Badges (seasonal) | Hero's Heart Day, Mogloween, Frostval |
| `misc` | Other | Other Badges (misc) | PvP, Warmonger, Misc, Retired |

### Current badge dataset (last scraped: June 2026)

| Display Name | Category ID | Subcategories | Count |
| -------------- | ------------- | --------------- | ------- |
| Quests | `quest-completion` | Early Days, Book 1 & 2, Book 3, Side Quests | 72 |
| Classes | `collection` | Trained Classes, Special Classes | 31 |
| Challenges | `combat` | Arena Challenges, Skills | 27 |
| Seasonal | `seasonal` | Hero's Heart Day, Mogloween, Frostval | 24 |
| Other | `misc` | PvP, Warmonger, Misc, Retired | 7 |
| **Total** | | | **161** |

Retired badges (Party On, Olaf!, Idle Heroes, etc.) are included in the dataset but marked `retired: true` and grouped under the "Retired" subcategory.

## Shared Reusable Components

| Component | Description | Used in |
| ----------- | ------------- | --------- |
| `ElementPill` | Colour-coded element/trait chip | Pets, Accessories, Weapons |
| `ElementLegend` | Expandable element reference panel | Pets, future sections |
| `StatBar` | Compact stat boxes | Pets, future combat entities |
| `SegmentToggle` | Multi-select type toggle (Pets/Guests) | Pets |
| `AccessPills` | DA Required + DC + DM tags | All sections |
| `ObtainSection` / `ObtainVariantCard` | Shared "How to Obtain" cards | All item-family categories |
| `ExpandableImageList` | Collapsed attack/ability/effect image toggle | Pets, Guests, Trinkets, Weapons |
| `MetricStrip` | Shared rate/cooldown/charge metric display | Pets, Guests, Weapons |
| `NotesList` / `OtherInformationSection` | Nested-bullet/quote/popup note renderer | All sections |
| `TriStateFilterPill` | Neutral → include → exclude filter pill | All filterable pages |
| `ItemImage` | Image with shared missing-image placeholder | Badges, Pets, Weapons, image-bearing accessories |

**Note**: All content types (Badges, Pets, Guests) use unified obtain card styling with gold left border. The heading "How to Obtain" is positioned INSIDE the card. Pets show additional price/sellback fields below a divider; Badges and Guests show location only.
