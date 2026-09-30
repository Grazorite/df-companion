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
- **Access/status pills**: card-gallery access pills use compact labels (`DA`, `DC`, `DM`, `Free`).
  Do not show text pills for `Multiple Versions` or `Merge Required` on cards; use level/range chips
  or detail-page/obtain-method metadata instead. Do not show Level 2 status filters such as `Rare`,
  `Seasonal`, `Special Offer`, `Temp`, `Retired`, or weapon `Default` on cards or detail-page headers; keep those
  available in filters and source/obtain/detail prose where relevant.
- **Family description preview**: family cards preview the first variant's description via
  `getFamilyCardDescription`. Variant-specific detail pages still render the selected variant's
  description first, falling back to shared description only when the selected variant has none.
- Examples: `BadgeCard.tsx`, `PetCard.tsx`
- **Progressive rendering:** gallery filtering and result counts always operate on the complete
  loaded subtype/dataset, but `ProgressiveCardGrid` mounts a bounded result window: 48 cards below
  `sm`, 72 cards at `sm` and above. `Show more results` appends another responsive batch and enables
  observer-driven continuation for users who keep scrolling. Changing the browse URL resets the
  window. Keep the explicit button as the accessible fallback; do not replace this with mandatory
  virtualization or an inaccessible infinite list.
- **Search responsiveness:** list search uses the immediate input value for the field, a deferred
  value for result computation, and the existing 300ms debounce only for `q` URL synchronization.
  Do not make visible results wait for the URL debounce.
- Cards that navigate to detail pages should carry the current browse URL with the shared
  navigation-context helper. Detail pages should read that `from` context for their top back link,
  so filters/search/subtype state are preserved when returning to the category list. Related/Also
  See cards should preserve the same original `from` context when chaining between detail pages.
- **Navigation continuity:** `ProgressiveCardGrid` records the originating card, mounted batch depth,
  and scroll position when a card is activated. `NavigationContinuity` restores that state only when
  returning from a detail route to the exact browse URL, then focuses the originating card. A new
  pathname scrolls to the top, focuses its eventual `h1`, and announces the heading; query-only
  filter changes preserve scroll and focus. Keep this state in memory rather than adding private UI
  state to public URLs.
- **Route loading shape:** route-level Suspense uses `DetailPageSkeleton` for recognized detail
  routes and a gallery skeleton for list/landing routes. Category detail hooks should also use the
  shared detail skeleton so lazy-module and lazy-data loading do not change page geometry.
- **Dataset state contract:** category loaders must not convert request failures into empty arrays at
  the public hook boundary. Use `useDatasetResource` so loading, failure, retry, valid empty data, and
  loaded results remain distinct. Gallery lists render those states through
  `DatasetStateBoundary`; detail pages show the shared retry state before their not-found state.
  Cached loader promises must reset after rejection so Retry performs a real request.
- **Result announcements:** visible result counts update with deferred filtering before the 300ms URL
  debounce, but assistive announcements use `ResultsStatus` and settle for 400ms. Do not attach the
  live region directly to text that changes on every keystroke.
- **Page accessibility:** successful routes expose one `main` and one `h1`; list cards use `h2` below
  that page heading. `NavigationContinuity` derives `document.title` from the eventual `h1` and keeps
  query-only updates from replaying route behavior. Interactive controls use `focus-visible` rings,
  and disclosure widgets use the shared Radix Collapsible wrapper rather than hand-rolled state.
- Card-gallery search should index the detail-page text users naturally expect: base and variant
  descriptions, notes/Other Information, obtain locations, release dates where present, housing
  effects and furnishing-slot text, trinket effect types, attacks, and weapon special text. Keep
  matching word-prefix based through `getSearchWords` so apostrophes and punctuation remain
  search-friendly.
- **Detail header filter links**: top-of-detail access/version pills should link back to that
  category's card gallery with the matching filter applied and the current subtype preserved. For
  example, clicking `DA Required` on a belt should navigate to
  `/accessories?type=belt&access=da`; clicking `Multiple Versions` on a staff should preserve
  `type=staff-wand` and set `access=multi`.

### Obtain Cards (Detail Pages)

All "How to Obtain" sections must follow this unified pattern:

- **Styling**: `bg-bg-surface border-l-4 border-gold rounded-lg p-5`
- **Heading**: INSIDE the card, not above it
  - Style: `text-xs font-semibold text-text-muted uppercase tracking-wider mb-3`
  - Text: "How to Obtain" (singular), append "(Method 1)", "(Method 2)" if multiple methods
- **Content-specific fields**:
  - **Badges/Guests**: Location/instruction only
  - **Pets**: Location + divider + price/required items/sellback fields
  - Across all categories, suppress the price/sellback grid when both values are `N/A`, `None`,
    empty, or zero-value currency strings such as `0 Gold`, `0 DC`, or `0 Defender's Medals`. Keep
    Required Items / Requires visible, and still show whichever of price or sellback is meaningful
    when only one exists.
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

### Detail page width

All category detail pages use `src/components/shared/DetailPageLayout.tsx` for the outer page
container, backed by reusable class constants in `src/utils/detailPageLayout.ts`. The shared
container is `max-w-5xl` with the standard detail-page horizontal padding and vertical rhythm.
Loading, not-found, and breadcrumb-only states should use the same shared layout classes so pages do
not resize when data finishes loading or when moving between categories.

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
Ordinal words such as `First`, `Second`, and `Third` are ignored during related-name scoring, so
same-obtain sibling sets like `First Golden Ring` through `Fifth Golden Ring` can infer links without
hardcoded `alsoSee` data.

Weapons additionally infer exact-name cross-subtype siblings when the displayed name is specific
enough and at least one obtain price type overlaps. This covers same-named
sword/scythe/staff/dagger counterparts without merging them into one family. Weapon related-name
matching uses the shared `0.55` threshold with a shared obtain fingerprint, so compact sibling sets
such as `Kaaros Garada` / `Kaaros Xera` / `Kaaros Alleri` can link without a hardcoded Also See list.

Explicit badge-award notes create cross-category inline links, not cross-category `Also See` cards.
When item text says `Own this item/armor/weapon ... to obtain ... badge(s)`, link the badge name
inside that note to the Badge detail page. On the Badge detail page, link the awarding item name
inside the obtain instruction or notes back to the item detail page. Same-category `Also See` remains
card-based. Cross-category matching is deliberately phrase-based, not fuzzy, so flavour text such as
"badge of honor" is ignored. Regenerate `src/data/badge-relations.json` with
`npm run generate:badge-relations` after scrapes that change item notes/descriptions or source
aliases.

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

The attack accordion (`GuestAttacks.tsx`) and the expandable image toggle (`ExpandableImageList.tsx`)
are built on the shared Radix Collapsible primitive (see `Shared interactive primitives` below), so
the header is a real button with keyboard operation, `aria-controls` / `aria-expanded`, and an
animated open/close. Keep the chevron rotation scoped with a named group
(`group/attack`, `group/img`) so nested collapsibles do not toggle each other's icons.

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
editing broad JSON output. The shared renderer also treats any leading whitespace as a nested level
so older one-space-indented note rows do not display as top-level bullets.

## Shared interactive primitives (Radix / shadcn)

Interactive widgets that need real keyboard operation, focus management, and ARIA wiring are built on
headless primitives rather than hand-rolled `useState` toggles. The approach mirrors shadcn/ui but is
deliberately **not** installed via `shadcn init`: there is no `components.json`, no shadcn token
layer, and no `clsx` / `cva` / `tailwind-merge`. Instead thin wrappers live in
`src/components/shared/ui/` and are styled with the existing `@theme` design tokens.

- `ui/collapsible.tsx` — wrappers over `@radix-ui/react-collapsible`. Consumed by `CollapsibleSection`
  (detail-page "Stats by Level"), the `GuestAttacks` attack accordion, and `ExpandableImageList`.
  Open/close animates via the `--animate-collapsible-down` / `--animate-collapsible-up` tokens and
  keyframes in `src/index.css`, which read Radix's `--radix-collapsible-content-height`.
- `ui/command.tsx` — wrappers over `cmdk` for the global search palette (see below). `cmdk` supplies
  the accessible listbox semantics and, through its bundled Radix Dialog, the modal focus trap.
- `ui/dialog.tsx` — wrappers over `@radix-ui/react-dialog`. Consumed by the mobile navigation More
  panel and `MobileFilterPanel`; Radix owns Escape/outside dismissal, focus trapping, and focus return.
- `ui/toggle-group.tsx` — wrappers over `@radix-ui/react-toggle-group`. Consumed by `SegmentToggle`
  (subtype/segment pickers). Radix adds group semantics and roving-tabindex keyboard navigation
  (arrow keys move between segments; the group is a single tab stop). `SegmentToggle` uses
  `type="multiple"` so its one genuinely multi-select consumer (Pets/Guests) works; single-select
  subtype pages still enforce one active segment in their own handler. Note that `type="multiple"`
  makes the Radix root `role="toolbar"` with `aria-pressed` items (single would be
  `radiogroup`/`radio`).
- `ui/tooltip.tsx` — wrappers over `@radix-ui/react-tooltip`. Consumed by `AccessPills` (the
  detail-page DA/DC/DM pills) to spell out those abbreviations accessibly (keyboard focus,
  Escape-to-dismiss, `aria-describedby`) instead of a non-accessible `title`. Scope
  `TooltipProvider` close to the usage (`AccessPills` renders its own provider) rather than at the app
  root, so `@radix-ui/react-tooltip` stays in the lazy detail-page chunks, not the main bundle.
  `AccessPills` is detail-only (cards use their own inline pills), so the instance count stays small —
  do not wrap per-card gallery pills in tooltips.

**Tri-state controls stay custom.** `TriStateFilterPill` cycles neutral → include → exclude and is
**not** built on a Radix primitive: Radix `Toggle`/`ToggleGroup` are binary and Radix has no
tri-state primitive (a `Checkbox` `indeterminate` would announce "mixed", which misrepresents
"excluded"). It remains a semantic `<button>` with `aria-pressed` plus a descriptive `aria-label` /
`title` announcing the next action, and a shared focus-visible ring. Do not convert it to a binary
primitive — that would add a dependency and worsen the semantics.

When adding a new interactive primitive, prefer this pattern: add the specific Radix/headless package
(pinned, exact version), write a thin token-styled wrapper in `ui/`, and keep the public component API
stable so existing consumers are drop-in. Do not run `shadcn init` or add `components.json` — it would
collide with the hand-built Tailwind v4 `@theme` tokens.

## Global Search (Command palette)

A global palette (`src/components/shared/CommandPalette.tsx`) provides cross-section search. It opens
with `Cmd/Ctrl+K`, the desktop sidebar `Search…` button, or the mobile `More` panel search action
(all via `openCommandPalette()` in `src/utils/commandPalette.ts`, which dispatches a window event the
palette listens for). It is mounted once in `Layout` so it stays available across route changes.

- **Compact index (build-time):** the `*-manifest.json` files carry only counts, so they cannot power
  search. The palette instead loads one compact, build-time-generated `src/data/search-index.json`
  (via `useGlobalSearch(enabled)`) on first open — **not** the full section datasets. Full datasets
  load only when the user navigates to a result's detail page. The index is cached at module scope,
  so reopening is instant.
- **Generation + drift safety:** `scripts/generate-search-index.ts` (`npm run generate:search-index`)
  reads the raw `src/data/*.json`, applies the exact same normalization the runtime loaders apply
  (via the shared fetch-free `src/utils/dataNormalization.ts` — `normalizeLoadedFamily`,
  `normalizeHousingEntries`, `dedupeClassAbilityEntries`, etc.), then calls the same
  `buildSearchIndex` (`src/utils/searchIndex.ts`) the app uses, emitting compact records via
  `toCompactIndex`. Because the generator and runtime share that normalization, the index reflects
  post-normalization entries (e.g. Housing family merges, Class dedupe) rather than raw file counts —
  do **not** regenerate it from raw JSON counts. Regenerate after any scrape that changes entry names,
  slugs, subtypes, or class dedupe.
- **Validation (build gate):** `scripts/validate-search-index.mjs` runs in `npm run validate` and
  fails the build if the committed index (a) drifts from a fresh regeneration (byte compare against
  the generator's `--check` output), (b) contains a route whose slug does not resolve to a real
  canonical/alias entry, or (c) exceeds the 1.5 MiB decoded budget. Current index: ~7,076 records,
  ~897 KiB (~105 KiB gzipped).
- **Compact record shape:** each record stores only `label`, `section`, `url`, and optional
  `sublabel`; `rehydrateSearchIndex` recomputes the tokenized `words` and the `id` at load so the JSON
  stays small. `rawName` is stored only when article-normalization diverges from the label (rare).
- **Matching:** reuse `getSearchWords` for the same word-prefix behavior as in-page search; match the
  entry's display name (article-normalized via `displayTitle`), results capped and grouped by section.
  `cmdk` runs with `shouldFilter={false}` because filtering/ranking is done in `searchHits`.
- **Hit → route:** build links the same way the per-section card builders do — `/badges/:slug` (no
  `type`), `/pets|guests/:slug` split by entry `type` (slug is already `pet-`/`guest-` prefixed), and
  `/<section>/:slug?type=<subtype>` for accessories, weapons, housing, and classes.
- **Failure handling:** if the index fetch fails, `useGlobalSearch` exposes `error` + `retry()` and the
  palette shows a distinct Retry control (not the loading/empty state); a failed fetch is not cached,
  so retry starts fresh.

## Filter Pills Pattern (applies to all content sections)

### Universal Filter Hierarchy

Filter pills below dataset/segment selectors are tri-state by default: neutral → include → exclude →
neutral. Included filters use that level's active colour; excluded filters use the shared muted red
treatment and a leading minus icon. URL params keep includes in the existing keys (`access`,
`category`, `element`) and put exclusions in parallel keys (`excludeAccess`, `excludeCategory`,
`excludeElement`). Keep clear-filter controls visible whenever either include or exclude filters are
active, and echo exclusions in result-count text as "excluding ...".

Dataset selectors are not tri-state filters. Accessory, weapon, Housing, and Classes / Abilities
subtype selectors must remain single-select (`type=...`) so the page lazy-loads only one
subtype/shard group at a time. Do not allow combined subtype browsing unless the data-loading strategy
has been explicitly redesigned for it. On mobile, subtype selectors should wrap like filter pills
rather than clipping off the viewport.

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
List pages should not run a catch-all URL canonicalization effect after filter toggles. Toggle and
clear handlers already write their own query params, and an extra `setSearchParams` pass can leave
React Router showing stale card grids during the transition. Keep effects scoped to debounced search
text (`q`) only unless a page has a specific one-way sync need.

Mobile navigation should keep the bottom bar to a small primary set plus a `More` tab. As more
sections ship, add them to the More panel rather than squeezing every category into the fixed bottom
bar; the panel should include available categories and disabled coming-soon entries. Keep it on the
shared Dialog primitive so Escape, outside interaction, explicit close, route navigation, focus
entry, and focus return remain consistent.

On mobile browse pages, keep subtype selection and search visible, then place access/category/
element/trait controls in `MobileFilterPanel`. Its active count is derived from public URL params,
and Clear all removes only secondary filters while preserving `q` and `type`. Desktop retains the
inline filter hierarchy. Visible mobile segment and tri-state controls must be at least 44px high;
the filter sheet must scroll internally and leave the fixed bottom navigation unobscured.

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

The same retired-default rule applies to every gallery: retired entries are excluded from normal
counts, category browsing, and text search unless the Retired filter is explicitly selected.

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
- **Level 2**: Multi-select categories — Temp, Rare, Seasonal, Special Offer, War, Retired (OR
  logic)
  - Works like badges: when Retired selected, only show retired; otherwise exclude retired
  - No label text (pills displayed directly, consistent with Badges page)
- **Level 3**: Element/Trait filters (multi-select pills, OR logic, custom colours)
  - No label text (pills displayed directly, consistent with Badges page)
- **Legend**: Expandable reference for element codes (below filters)

URL query params supported by `/pets`:

- `type` — `pet`, `guest`, or comma-separated `pet,guest` (default: both)
- `access` — comma-separated: `da`, `free`, `merge`, `dc`, `dm` (e.g., `da,free` for DA Required AND
  Free)
- `category` — comma-separated: `temp`, `rare`, `seasonal`, `special-offer`, `war`, `retired`
- `element` — comma-separated element/trait codes (e.g. `ICE,FIR,SHR`)
- `q` — text search

### Accessories Page

- **Subtype selector**: query-param-driven subtype switcher on
  `/accessories?type=artifact|belt|bracer|cape-wing|helm|necklace|ring|trinket`
- **Level 1**: `Multiple Versions`, `DA Required`, `Merge Required`, `Free`, `DC`, `DM`
- **Level 2**: `Cosmetic` when the loaded subtype dataset contains cosmetic entries; then `Temp`,
  `Rare`, `Seasonal`, `Special Offer`, `War`, `Retired` where present
- **Level 3**: Element filters
- **Detail pages**: shared accessory detail layout with family switching, obtain cards, and trinket
  skill rendering when linked ability posts exist

### Weapons Page

- **Level 1**: `Multiple Versions`, `DA Required`, `Merge Required`, `Free`, `DC`, `DM`, `Default`
- **Level 2**: `Armor Customization`, `Special`, `Cosmetic`, `Temp`, `Rare`, `Seasonal`,
  `Special Offer`, `War`, `Retired`
- **Level 3**: Element filters

### Housing Page

- **Subtype segment**: single-select so only one subtype dataset lazy-loads at a time
- **Level 1**: `Multiple Versions`, `DC`
- **Level 2**: data-driven `Effect`, `Rare`, `Seasonal`, `Retired`
- Do not show `Free` unless a Housing subtype later proves to contain genuinely free entries
- `DA Required` is omitted as a filter because every Housing entry is DA content
- Housing entries with sorted effect metadata render a compact `Effect Type: <type>` line below the
  description, matching the trinket `Effect Type(s):` typography and placement.
- Housing effect cards use the same typography and panel spacing as other detail cards. Effects with
  forum quote blocks should render quotes as quote blocks, not inline comma-separated text.

### Classes / Abilities Page

- **Subtype segment**: single-select `Classes` / `Consumables`
- **Classes filter rows**: sub-subtype row, then access filters, then category filters
- Class sub-subtype filters (`Armors`, `Regular`, `Miscellaneous`) use the `segment`-sized
  tri-state pill treatment so their height and spacing match the top-level `Classes` /
  `Consumables` selector while still supporting include/exclude states.
- The page header always shows the shared Classes / Abilities description. When one or more Classes
  sub-subtype filters are included, append their short descriptions below it as smaller muted lines.
- Armor detail pages display Level, Rarity, and Equips Class in the shared `MetricStrip` panel style.
  Equips Class is plain text, even when the forum exposes a class link.
- Regular and Miscellaneous class detail pages follow the guest detail layout, not the Armor layout:
  header tags/name/description/release date, variant selector when needed, main/alt image selector,
  guest-style stats, Rarity, obtain card, Default Weapon, optional attack-set selector, optional
  Class Mechanics, guest-style Attacks, Other Information, Sources, then Also See. They do not render
  the generic `Effect` card; class skill effects belong inside the attack accordions. Attack
  requirements render in the same compact position as guest attack requirements.
- When Regular/Miscellaneous classes have artifact-modified attacks, render a selector immediately
  before the attack area. `Base` shows the normal class attacks; each artifact option shows only that
  artifact's attack set so pages such as DragonLord do not render every modified skill at once.
- Class Mechanics is the home for widget-style class or artifact mechanics: a mechanics image plus
  explanatory bullets/pop-ups. Mechanics images auto-display, centered with their caption underneath;
  they do not use the hidden/expandable attack-image control. If a class has artifact attack sets,
  mechanics are treated as correlated with the selected set: `Base` shows base/shared mechanics,
  while artifact options show only mechanics parsed for that artifact. When the selected attack set
  is artifact-backed, render one compact `Artifact: <name>` inline link above the Class Mechanics /
  Attacks area; do not also render a duplicate mechanics block title when it matches the selected
  artifact name.
- Cross-category class artifact relations should render inline text links, not cross-category Also
  See cards. Class pages link artifact names to Accessories; artifact pages link mentioned class
  names back to Classes / Abilities, including the Accessory artifact `Modifies` metric strip.
  Appearance-only modifier relationships still count; the link does not require the class to expose
  an artifact-specific attack set.
- Class `Default Weapon` text links to the matching weapon detail route when
  `class-default-weapon-relations.json` has a source-URL match. Weapon detail pages render the
  reverse relation by hotlinking the class name inline in the default weapon's How to Obtain text.
  Unmatched default weapons remain plain text.
- Regular/Miscellaneous class image selectors should reflect forum captions rather than generated
  `Main` / `Alternative Image` text. Use nearby forum labels such as `Modern Version`,
  `Retro Version`, `Original`, and `Reforged`; combine group labels with linked `Male` / `Female`
  captions when the forum writes `Original Appearance: Male / Female`. Paired duplicate image
  captions may infer `(Male)` / `(Female)` when the forum exposes two appearance images under one
  caption. If a page mixes true class portraits with linked weapon/skill appearance images, prefer
  the image URL family that matches the class name for the portrait selector.
- Appearance-caption lines consumed for attack image captions, such as
  `Original / Retro: Appearance` or `DragonKeeper: Appearance 1 / 1.1`, should not also render as
  attack notes or global Other Information.
- Multiple inline `(Pop-up: ...)` snippets in one attack/skill effect should render as one shared
  `Pop-ups:` quote block through `PopupText`.
- Guest-style stat category cards use a two-column grid when multiple non-empty categories render.
  If filtering leaves only one visible stat category, that card should span the full detail width.
- **Consumables filter rows**: access filters, then category filters (`Temp` remains data-driven
  because Health/Mana Potion are non-Temp), then Dust/Food/Rune kind filters styled like compact
  Level 3 filters. Dust/Food/Rune pills should keep their kind colour in the neutral state and add
  the selected gold ring only when included.
- Every filter row has its own inline `Clear filters` control that only clears that row's include and
  exclude params.
- Current Consumables do not show Temp or Effect pills on gallery cards because all current
  Consumables are Temp and expected to have effects. Gallery cards should show Dust/Food/Rune kind
  pills when present.
- Consumable detail pages keep `Also See` below `Sources`, using explicit/reverse forum refs plus the
  shared inferred related-items matcher within the Consumables subtype.
- Health Potion and Mana Potion render their effect in the shared attack-style accordion so the skill
  button image and Appearance image are grouped with the effect instead of shown as a generic main
  image section. Every other Consumable renders the original plain `Effect` card.
- Consumables with sorted effect metadata render `Effect Type: <type>` below the description, using
  the same typography and placement as Housing `Effect Type:` and trinket `Effect Type(s):`.
- Consumables with parsed dialogue render a separate `Dialogue` card after How to Obtain and before
  Other Information. Use the shared notes/quote-box styling: prompt/context lines as normal note rows,
  dialogue text in the quote panel.

## Detail Page Metadata

On detail pages, metadata is split into distinct types:

### Clickable filter pills (structured metadata — link to list page with filter applied)

- **Category/Element pill** → links to `/[section]?category=X` or `/pets?element=ICE`
- **DA Required pill** → links to `/[section]?access=da`
- **DC pill** → links to `/[section]?access=dc` (shows DC logo on Pets/Weapons, not on Badges)
- **Retired pill** (Badges) → links to `/badges?category=retired`
- Style: Level 1 filters use gold styling, Level 2 use orange/custom colours, cursor pointer, hover
  opacity
- Detail-page headers show access/method metadata (`DA Required`, `DC`, `DM`, `Multiple Versions`,
  `Merge Required`) and type pills only. Level 2 availability/status tags (`Rare`, `Seasonal`,
  `Special Offer`, `Temp`, `War`, `Retired`) remain list filters and should not be repeated as
  header pills.

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
- Explicit access-suffixed variant names such as `1 (DA)`, `1 (DA, DC)`, `1 (DC)`, or
  `(Base) (DC)` must render exactly as stored when the scraper intentionally stores them. Do not strip
  the parentheses or re-append access suffixes in the UI formatter.
- `variantName: 'DC'` → displays as `(DC)`
- Use `(Base)` / `(DC)` for a simple two-variant base/DC-only family. Use `(Base)` /
  `(Base) (DC)` only when the base entry is one member of a larger named, numbered, or Roman pattern
  that also has sibling variants.
- When duplicate stored labels differ only by access flags, the UI appends the current row's full
  access signature for disambiguation. Examples: `Cunning (DA)` / `Cunning (DC)`, `Bubbly (DA)` /
  `Bubbly (DA, DC)`, and `I (DA)` / `I (DA, DC)`.
- If every row in that duplicate-label group is DA-required, omit `DA` from the visible suffix and
  show only the remaining differentiator. Example: `Bubbly` / `Bubbly (DC)`, not `Bubbly (DA)` /
  `Bubbly (DA, DC)`.
- Scrapers should build stored variant labels with the shared `formatVariantNameWithAccess` helper
  whenever a natural label is combined with access flags. The shared grammar is:
  - no natural label + clear access distinction → `(DA)`, `(DA, DC)`, `(DC)`, `(DM)`
  - exact duplicate level entries + access distinction → use the level label, e.g. `20`, `20 (DC)`
    or `I`, `I (DC)`
  - base sibling among named variants → `(Base)`, `(Base) (DC)`, `Variant`, `Variant (DC)`
  - Roman numeral labels stay uppercase: `I`, `I (DC)`, `II`, `II (DC)`
- For "(All Versions)" families where the same labels repeat across levels, prefix each label with
  its level in parentheses to distinguish level from variant name: `(10)`, `(10) (DC)`, `(20)`,
  `(20) (DC)`, …
- `(DA)` is **not** appended in the multi-level access-only case where the level already
  disambiguates repeated unnamed rows. It is appended when duplicate named/Roman labels need an
  explicit access distinction.
- `Pirate Monkey` is the reference spot-check for mixed rules: it combines base/named variants,
  level/access duplicate labels, and access-only labels, and its current stored variant names are
  considered correct.

## Stats Tables and Selectors

Stats tables and selectors should avoid redundant variant columns. A one-row family never needs a
Variant column. If all variant labels are only access labels like `(Base)` / `(Base) (DC)` and the
levels are unique, treat the selector/table as level-driven instead of variant-driven; same-level
access branches can still show variant labels where needed.
The same level-driven display applies when every row in an itemfamily has the exact same stored
variant label and unique levels, even if that label is not access-only. Example: `Soulforged Ring
(Red/Blue/Green)` stores repeated color labels per family, but should render `Select Level` and hide
the Variant column.

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
