# UI Patterns

> Static reference. Extracted from the pre-refactor monolithic `AGENTS.md`.
> Covers: Card components, Obtain cards, Detail page section order, Image rules, Also See rules,
> Expandable attack/skill cards, Filter pills hierarchy, Per-page filters and URL params,
> Detail-page metadata pills, Stats tables.

## Card Components (Standard Pattern)

### List View Cards

All list view cards must follow this pattern:

- **Fixed height**: `h-[120px]` (not min-height)
- **Title**: `line-clamp-1` (single line with ellipsis)
- **Description**: `line-clamp-2` (two lines with ellipsis)
- **Layout**: Flex with metadata row, title, description, chevron icon
- **Interaction**: Hover lift (`hover:-translate-y-0.5`), border highlight, shadow increase
- Examples: `BadgeCard.tsx`, `PetCard.tsx`
- Cards that navigate to detail pages should carry the current browse URL with the shared
  navigation-context helper. Detail pages should read that `from` context for their top back link,
  so filters/search/subtype state are preserved when returning to the category list. Related/Also
  See cards should preserve the same original `from` context when chaining between detail pages.

### Obtain Cards (Detail Pages)

All "How to Obtain" sections must follow this unified pattern:

- **Styling**: `bg-bg-surface border-l-4 border-gold rounded-lg p-5`
- **Heading**: INSIDE the card, not above it
  - Style: `text-xs font-semibold text-text-muted uppercase tracking-wider mb-3`
  - Text: "How to Obtain" (singular), append "(Method 1)", "(Method 2)" if multiple methods
- **Content-specific fields**:
  - **Badges/Guests**: Location/instruction only
  - **Pets**: Location + divider + price/required items/sellback fields
- **Access/currency method pills**: shared obtain cards show per-method `DA Required` and `DC` pills
  when the method requires DA or uses Dragon Coins. The label is `DC`, not `DC Required`, because the
  meaning is already scoped to the obtain method.
- **Implementation**: Use shared obtain-card components for item-family categories where possible;
  avoid duplicating obtain-card styling in detail pages.
- Examples: `BadgeDetailPage.tsx`, `PetDetail.tsx` (handles both pets and guests)

## Detail Page Section Order

All item-family detail pages should use a consistent information order unless a category has a
documented reason to differ:

1. Title, metadata pills (scoped to selected variant), description, release date
2. Primary image / alternative images when supported
3. Category-specific metadata strips
4. Stats / variant selector
5. Rarity and ability/attack sections
6. How to Obtain
7. Other Information
8. Sources
9. Also See

Item descriptions should be rendered through the shared description normalizer. Forum/source-only
access markers such as `(DA required)` and `(DC item)` belong in access pills and obtain-method
metadata, not in the italic description prose.

### Image selector independence

On pets, guests, and accessories, the image selector is independent from the level/variant selector
— switching variants does not move the image. The image only resets when navigating to a different
entry, and the index is clamped if the available image set shrinks.

Weapons link the two selectors **only** when the selected variant has a dedicated captioned image
whose caption matches its variant label (normalized, case-insensitive, ignoring `(Default)` /
`(Clicked)` suffixes). Weapons without per-variant captioned images behave like every other category
— the user's image selection is preserved.

### Image expectation and placeholders

Badges, pets/guests, weapons, and image-bearing accessory subtypes should display the shared
missing-image placeholder when an expected image is absent or fails to load. For accessories, this
requirement applies to capes/wings and helms, plus artifacts that are helm/cape-like by item type or
equip spot. Do not apply this placeholder rule to belts, bracers, necklaces, rings, trinkets, or
non-helm/cape artifacts. Some items are intentionally invisible and should not show the placeholder;
prefer suppressing from Other Information/notes text such as "Weapon is not visible." or "Cape
appears invisible" before adding hardcoded exceptions, and preserve those notes instead. Existing
hardcoded exceptions cover known invisible accessory entries where needed (for example: Cloak of
Shadows, Invisible Cape, Invisible Helm, Mantle of Shadows, Wrap of Shadows). For every future
category, ask whether images are expected before implementing the detail image section or
placeholder behavior.

### Main image captions

When the main image also appears in the alternatives list carrying a bold forum caption (e.g.
"Pirate Monkey"), that caption takes precedence over the generic "Main" label.

## Also See

`Also See` must appear below `Sources` and should use the same related-card section treatment as
Pets/Guests: top border, compact uppercase heading, and a responsive two-column card grid.

`Also See` may combine explicit forum refs with conservative inferred refs. Inferred refs are
category-scoped and should require a normalized obtain-method match plus high name similarity.
Cross-subtype inferred refs are allowed only inside a top-level category that can load all subtype
JSON together (currently Accessories and Weapons); visually distinguish cross-subtype cards with a
small subtype chip where the card design supports it. Pets/Guests, Accessories, and Weapons share
`src/hooks/useRelatedItems.ts` for explicit refs, reverse explicit refs, and inferred refs; category
hooks should provide adapters instead of duplicating that algorithm. Future family-capable categories
should use this shared hook first, then add category-specific inference through its optional
extension points only when the existing obtain-fingerprint rule is insufficient.

**Inferred Also See matching** uses `obtainMethodInferenceFingerprint` (location + priceType +
variant-normalized recipe) — a relaxed fingerprint that ignores exact prices, DA/DC flags, and access
requirements. This lets items from the same shop at the same price type (e.g. all "Rare Pets" DC
items, or merge recipes differing only by variant label) link to each other. The conservative
name-similarity threshold (Jaccard + prefix scoring ≥ 0.55) prevents false positives. Examples: all
12 Plushie pets link; Exalted Blaster (Amalgam/Destiny/Doom) trinkets link.

Weapons additionally infer exact-name cross-subtype siblings when the displayed name is specific
enough and at least one obtain price type overlaps. This covers same-named
sword/scythe/staff/dagger counterparts without merging them into one family.

For subtype-heavy datasets, alias/canonical checks must be scoped to the subtype when slugs can
validly repeat across subtypes. A family alias should never point at another canonical entry in the
same subtype; scraper cleanup should drop that alias rather than deleting the canonical entry. Alias
lists should be unique and should not include the family's own canonical slug; same-thread families
often generate repeated slug candidates and must dedupe them before writing JSON.

## Expandable Attack / Skill Cards

Expanded attack content should use one consistent padded content shell (`p-4 sm:p-5`) with vertical
spacing between blocks. Avoid mixing per-child top/bottom margins for effect text, stats tables,
notes, and attack images; this keeps guest attacks, pet attacks, trinket skills, and weapon specials
visually aligned.

When attack/skill/special images are hidden behind an expandable image toggle, keep the label
category-specific and count-aware: guests and pets use `Attack Image` / `Attack Images (x)`, trinket
abilities use `Ability Image` / `Ability Images (x)`, and weapon specials use `Effect Image` /
`Effect Images (x)`. Preserve forum hotlink captions when present (`Normal`, `Magic 1`, `1.1`, etc.)
and filter out calculation/table-value links such as `+x`, `-x`, `x`, `y`, and `x - y`; those are not
animation images.

Weapon special effect images are optional. Some weapon specials only have the special button/icon and
text effect details, with no separate hotlinked appearance/effect image. Missing `specialImageUrls`
must not be treated as a scraper or validation failure unless the forum clearly provides a relevant
appearance/effect image link.

**Attack effect vs Other Information:** Attack effect bullet points that are part of the effect
description (e.g. "Performs one of the following attacks: • X • Y") stay inline in the `effect` field
and are NOT split into "Other Information". Only content under an explicit
`<b><u>Other information</u></b>` heading is separated into `attack.notes`. This applies to both
guest attacks and trinket skills (shared via `GuestAttacks.tsx`).

Accessory Other Information should preserve nested forum bullet indentation. If nested bullets appear
flattened in JSON, treat it as a parser/stale-data issue and prefer a targeted scraper fix using
indentation-preserving forum text parsing plus a narrow rescrape/compare, rather than manually
editing broad JSON output.

## Filter Pills Pattern (applies to all content sections)

### Universal Filter Hierarchy

Filter pills below dataset/segment selectors are tri-state by default: neutral → include → exclude →
neutral. Included filters use that level's active colour; excluded filters use the shared muted red
treatment and a leading minus icon. URL params keep includes in the existing keys (`access`,
`category`, `element`) and put exclusions in parallel keys (`excludeAccess`, `excludeCategory`,
`excludeElement`). Keep clear-filter controls visible whenever either include or exclude filters are
active, and echo exclusions in result-count text as "excluding ...".

Dataset selectors are not tri-state filters. Accessory and weapon subtype selectors must remain
single-select (`type=...`) so the page lazy-loads only one subtype/shard group at a time. Do not
allow combined accessory or weapon subtype browsing unless the data-loading strategy has been
explicitly redesigned for it.

Filter visibility should be data-driven at the shared UI level. Show access, category, element, and
trait filter pills only when the currently loaded dataset, subtype, or active segment contains at
least one matching entry. When switching subtypes or segments within the same top-level category
page, preserve hidden/unavailable filter params in the URL but apply only filters that are available
in the current loaded dataset; this lets a filter such as `Armor Customization` survive a temporary
switch to a subtype where it has no effect. Top-level category navigation should not carry filter
params across pages. Dataset/segment selectors remain visible and category-specific validity rules
still apply, e.g. guest-only browsing hides pet-only purchase filters, and Housing omits
`DA Required` as a filter because every Housing entry is DA-required. Use the shared
filter-visibility helpers (`src/utils/filterVisibility.ts`) rather than hardcoding this per page.

Element and trait filters must match the full item family, including variant-specific elements and
traits. Do not rely solely on a family-level summary field when filtering, searching, or deciding
whether a filter pill is available; derive from variants as a fallback so entries like Linus still
match `SHR` even when only later variants have that trait.

**Level 1 (Highest): Access filters** — Universal across all pages

- Styling: `bg-gold-bright text-bg-base` when active, `text-xs px-3 py-1.5` sizing
- Options: `All`, `Free` (if applicable), `DA Required` (if applicable), `DC` (if applicable)
- Badges: Mutually exclusive (single-select)
- Pets: Multi-select with AND logic (can be both DA Required AND Free/DC/DM)
- Page-specific subset based on content type

**Level 2: Category filters** — Page-specific content categories

- Styling: `bg-orange-500/80 text-white` when active, `text-[11px] px-2.5 py-1` sizing (unless
  explicitly overridden)
- Mutually exclusive within level (badges) or multi-select (pets)
- Examples: Badges (Quests, Classes, Challenges, Seasonal, Other, Retired), Pets (Temp, Rare,
  Seasonal, etc.)

**Level 3: Subcategory/Element filters** (if applicable)

- Styling: `bg-gold/20 text-gold border-gold/50` when active, `text-[10px] px-1.5-2 py-0.5` sizing
- Nested under active Level 2 category (badges) or independent multi-select (pets)
- Examples: Badges (Book 1 & 2, Book 3, Side Quests), Pets (ICE, FIR, SHR element/trait codes)

**Visual Hierarchy**: Each filter level is visually distinct through size — L1 (largest), L2
(medium), L3 (smallest).

### Badges Page

- **Level 1**: All, DA Required
- **Level 2**: All, Quests, Classes, Challenges, Seasonal, Other, Retired (mutually exclusive)
  - Note: Retired is a special category — selecting it shows only retired badges; other L2
    categories exclude retired badges by default
- **Level 3**: Subcategories (e.g., "Book 3", "Side Quests") — only appear when a L2 category is
  selected

URL query params supported by `/badges`:

- `access` — `all` (default) or `da` for DA Required
- `category` — filter by category ID (e.g. `combat`, `seasonal`) or `retired` for retired badges
- `sub` — filter by subcategory (e.g. `Book+3`, `Arena+Challenges`)
- `q` — text search

By default, retired badges are hidden from all categories. They only appear when `category=retired`
is set.

### Pets/Guests Page

- **Segment Toggle** (top): Pets, Guests (both active by default, multi-select)
- **Level 1**: Multiple Versions, DA Required, Merge Required, Free, DC, DM (multi-select with AND
  logic)
  - **Guest-only mode**: Only "Multiple Versions" and "DA Required" shown (guests are never
    purchased)
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
- `access` — comma-separated: `da`, `free`, `merge`, `dc`, `dm` (e.g., `da,free` for DA Required AND
  Free)
- `category` — comma-separated: `temp`, `rare`, `seasonal`, `special-offer`, `retired`
- `element` — comma-separated element/trait codes (e.g. `ICE,FIR,SHR`)
- `q` — text search

### Accessories Page

- **Subtype selector**: query-param-driven subtype switcher on
  `/accessories?type=artifact|belt|bracer|cape-wing|helm|necklace|ring|trinket`
- **Level 1**: `Multiple Versions`, `DA Required`, `Merge Required`, `Free`, `DC`, `DM`
- **Level 2**: `Cosmetic` when the loaded subtype dataset contains cosmetic entries; then `Temp`,
  `Rare`, `Seasonal`, `Special Offer`, `Retired` where present
- **Level 3**: Element filters
- **Detail pages**: shared accessory detail layout with family switching, obtain cards, and trinket
  skill rendering when linked ability posts exist

### Weapons Page

- **Level 1**: `Multiple Versions`, `DA Required`, `Merge Required`, `Free`, `DC`, `DM`, `Default`
- **Level 2**: `Armor Customization`, `Special`, `Cosmetic`, `Temp`, `Rare`, `Seasonal`,
  `Special Offer`, `Retired`
- **Level 3**: Element filters

### Housing Page

- **Subtype segment**: single-select so only one subtype dataset lazy-loads at a time
- **Level 1**: `Multiple Versions`, `DC`
- **Level 2**: data-driven `Effect`, `Rare`, `Seasonal`, `Retired`
- Do not show `Free` unless a Housing subtype later proves to contain genuinely free entries
- `DA Required` is omitted as a filter because every Housing entry is DA content

## Detail Page Metadata

On detail pages, metadata is split into distinct types:

### Clickable filter pills (structured metadata — link to list page with filter applied)

- **Category/Element pill** → links to `/[section]?category=X` or `/pets?element=ICE`
- **DA Required pill** → links to `/[section]?access=da`
- **DC pill** → links to `/[section]?access=dc` (shows DC logo on Pets/Weapons, not on Badges)
- **Retired pill** (Badges) → links to `/badges?category=retired`
- Style: Level 1 filters use gold styling, Level 2 use orange/custom colours, cursor pointer, hover
  opacity

**Access/status pill colour rule:** DA/DC/DM metadata pills must use the shared access pill tones
from `src/utils/accessPillStyles.ts` wherever they appear as item metadata, detail header tags, or
obtain-method tags. Filter-state pills are the exception: include/exclude filter styling may differ
because it communicates filter state rather than item metadata.

### Non-clickable tags (raw search keywords for the search index, not a filter)

- Displayed in a "Tags" section with a label making the distinction clear
- Style: muted grey pill, no hover state, `cursor-default`
- Tags are for search relevance only, not navigation

### Element and trait pill scoping

Element/trait pills on detail pages are scoped to the **selected variant**: elements come from the
active variant's element, traits from the active variant's own `traits`, falling back to the family
union only when a variant does not carry its own. The card gallery shows the additive family-level
union. Example: base Linus shows `[ICE]`; Prince/King/Emperor Linus show `[ICE] [SHR]`.

### Variant label conventions

- `variantName: 'Normal'` (and the forum's `(Resource)` label) → displays as `(Base)`
- `variantName: 'DC'` → displays as `(DC)`
- For "(All Versions)" families where the same labels repeat across levels, prefix each label with
  its level in parentheses to distinguish level from variant name: `(10)`, `(10) (DC)`, `(20)`,
  `(20) (DC)`, …
- `(DA)` is **not** appended in that multi-level access-split case — the level already disambiguates.
  The `(DA)` marker is reserved for the genuine two-variant DA-vs-DC case (single level, one DA and
  one DC variant, no other variants).

## Stats Tables and Selectors

Stats tables and selectors should avoid redundant variant columns. A one-row family never needs a
Variant column. If all variant labels are only access labels like `(Base)` / `(Base) (DC)` and the
levels are unique, treat the selector/table as level-driven instead of variant-driven; same-level
access branches can still show variant labels where needed.

Collapse a stats table to a single row only for a multi-level progression whose stats never change.
Same-level access branches (e.g. `|` Base / DC) must each keep their own row so DA/DC access stays
visible.

## Future Sections

When implementing future sections (Quests, Locations, Monsters, NPCs, Stackable Items), follow the
same pattern:

- Level 1: Access filters (All, Free if applicable, DA Required if applicable, DC if applicable)
- Level 2: Content-specific categories (mutually exclusive within level)
- Level 3: Subcategories nested under L2 (if applicable)
- Detail pages: Structured metadata → clickable pills; raw keywords → non-clickable tags section
