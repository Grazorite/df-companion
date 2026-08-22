# Project Structure & File Naming

> Static reference. Extracted from the pre-refactor monolithic `AGENTS.md`.
> Covers: Project Structure tree, File Naming conventions.

## Directory Tree

```text
dragonfable-companion/
├── public/
│   └── icons/              # Badge icons (static assets)
├── docs/
│   └── context/            # Static project reference docs (this directory)
├── scripts/
│   ├── scrape-badges.ts    # Scrapes all badge data from DF forums (run via npm run scrape:badges)
│   ├── scrape-pets.ts      # Scrapes pets data from DF forums
│   ├── scrape-guests.ts    # Scrapes guests data from DF forums
│   ├── scrape-accessories.ts # Scrapes accessory subtype data from DF forums
│   ├── scrape-weapons.ts   # Scrapes weapon subtype data from DF forums
│   ├── scrape-housing.ts   # Starter scraper for Housing A-Z subtype listings
│   ├── validate-badges.mjs # Build-time validation for badges dataset
│   ├── validate-pets.mjs   # Build-time validation for pets/guests datasets
│   ├── validate-accessories.mjs # Build-time validation for accessory subtype datasets
│   ├── validate-weapons.mjs # Build-time validation for weapon subtype datasets
│   ├── validate-housing.mjs # Build-time validation for housing subtype datasets
│   ├── verify-datasets.mjs # Cross-post-family invariant checks
│   ├── add_images.py       # Adds imageUrl from DF-Pedia GitHub to badges.json
│   ├── add_subcategories.py # Maps badges to subcategories from forum groupings
│   └── lib/                # Shared scraper libraries (see scraper_operations.md)
├── src/
│   ├── components/
│   │   ├── badges/         # BadgeCard, BadgeDetail, BadgeList
│   │   ├── pets/           # Pet/Guest cards, detail components
│   │   ├── accessories/    # Accessory cards, list, detail, stats table
│   │   ├── weapons/        # WeaponCard, WeaponDetail, WeaponList, WeaponStatsTable
│   │   ├── housing/        # Housing cards, list, detail components
│   │   ├── layout/         # Navigation, Layout
│   │   └── shared/         # SearchBar, LoadingSkeleton, ObtainSection, ElementPill,
│   │                       # ExpandableImageList, ItemImage, MetricStrip, NotesList,
│   │                       # TriStateFilterPill, LevelSelector, SourceLinksCard, etc.
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
│   │   ├── housing-houses.json # Housing subtype dataset
│   │   ├── housing-backgrounds.json # Housing subtype dataset
│   │   ├── housing-floors.json # Housing subtype dataset
│   │   ├── housing-rugs.json # Housing subtype dataset
│   │   ├── housing-shrubs.json # Housing subtype dataset
│   │   ├── housing-stuff.json # Housing subtype dataset
│   │   ├── housing-wall-items.json # Housing subtype dataset
│   │   ├── housing-manifest.json # Housing counts per subtype
│   │   ├── accessory-manifest.json # Accessory counts per subtype/shard
│   │   ├── badges-manifest.json # Badge counts
│   │   ├── pets-guests-manifest.json # Pet/guest counts
│   │   ├── elements.json   # Shared element and trait metadata
│   │   └── categories.json # 5 top-level category definitions
│   ├── hooks/
│   │   ├── useBadges.ts    # Badge data access, search, category/subcategory filtering
│   │   ├── usePets.ts      # Pet/guest data access and filtering
│   │   ├── useAccessories.ts # Accessory data access and filtering
│   │   ├── useWeapons.ts   # Weapon data access and filtering
│   │   ├── useHousing.ts   # Housing data access and filtering
│   │   ├── useRelatedItems.ts # Shared explicit/reverse/inferred Also See resolution
│   │   └── useDebounce.ts
│   ├── types/
│   │   ├── badge.ts        # Badge, ForumLink, ObtainStep, BadgeFilters, etc.
│   │   ├── pet.ts          # Pet, Guest, attacks, stats
│   │   ├── item.ts         # Shared item-family types (ItemFamily, LevelVariant, traits)
│   │   ├── accessory.ts    # Accessory subtype and family types
│   │   ├── weapon.ts       # Weapon, WeaponFamily, WeaponSpecial types
│   │   └── housing.ts      # Housing subtype and family types
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── BadgesPage.tsx       # Two-level filter: category → subcategory
│   │   ├── BadgeDetailPage.tsx  # Full badge info with image, notes, forum links
│   │   ├── PetsPage.tsx         # Combined pets/guests browse page
│   │   ├── PetDetailPage.tsx    # Pet detail page
│   │   ├── GuestDetailPage.tsx  # Guest detail page
│   │   ├── AccessoriesLandingPage.tsx # Accessory subtype landing page
│   │   ├── AccessoryListPage.tsx # Accessory subtype browse page
│   │   ├── AccessoryDetailPage.tsx # Accessory detail page
│   │   ├── WeaponListPage.tsx   # Weapon subtype browse page
│   │   ├── WeaponDetailPage.tsx # Weapon detail page
│   │   ├── HousingListPage.tsx  # Housing subtype browse page
│   │   ├── HousingDetailPage.tsx # Housing detail page
│   │   └── ComingSoonPage.tsx
│   ├── utils/
│   │   ├── search.ts       # Word-prefix search + category/subcategory filtering
│   │   ├── dataLoaders.ts  # Lazy JSON asset loaders with in-memory caching
│   │   ├── variantHelpers.ts # Shared item-family helpers
│   │   ├── relatedItems.ts # Inferred Also See matching (name scoring + obtain fingerprints)
│   │   ├── imageLabels.ts  # Image caption inference and main/alternative image switcher labels
│   │   ├── armorCustomization.ts # Armor customization appearance/modifies parser
│   │   ├── accessPillStyles.ts # Shared DA/DC/DM access pill tones
│   │   ├── filterVisibility.ts # Data-driven filter pill visibility helpers
│   │   ├── navigationContext.ts # Browse-URL `from` context for back links
│   │   ├── displayText.ts  # Title normalization, article-insensitive sorting
│   │   ├── effectFormatting.ts # Effect/metric strip text normalization
│   │   ├── notes.ts        # Shared/variant note resolution
│   │   └── itemMigration.ts # Legacy single-entry → ItemFamily migration
│   ├── App.tsx
│   └── main.tsx
├── .env.example            # Template for forum cookie (for scraper)
├── AGENTS.md               # Dynamic handover orchestrator (status, Kanban, handover log)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## File Naming

- Components: PascalCase (`BadgeCard.tsx`)
- Hooks: camelCase with `use` prefix (`useBadges.ts`)
- Utils: camelCase (`search.ts`)
- Data: kebab-case (`badges.json`)
