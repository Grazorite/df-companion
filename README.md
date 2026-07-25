# DF Companion

A DragonFable companion app for browsing badges, pets, guests, accessories, and weapons. The app is built with React, TypeScript, Vite, and Tailwind CSS.

## Commands

```sh
npm run dev
npm run build
npm run validate
npm run verify
npm run lint
npm run typecheck:scripts
```

## Data Validation

The production build runs the badge, pet/guest, accessory, and weapon validators plus a TypeScript check for scraper files before compiling:

```sh
node scripts/validate-badges.mjs
node scripts/validate-pets.mjs
node scripts/validate-accessories.mjs
node scripts/validate-weapons.mjs
npm run typecheck:scripts
```

Run `npm run validate` when changing files in `src/data` or `scripts`. This catches scraper-only TypeScript issues that the app build does not otherwise see.

`npm run validate` also runs `npm run verify` (`scripts/verify-datasets.mjs`), which checks cross-post-family invariants across the accessory, weapon, and pet/guest datasets. It fails the build on hard corruption (duplicate canonical slugs; `Also See`/evolution refs pointing at an alias slug instead of the canonical family slug; self-referential or dangling refs) and reports non-fatal warnings for scraper-side smells (an alias claimed by two families, or an alias also emitted as a standalone entry). A family listing its own slug in `aliasSlugs` is an intentional same-thread convention and is ignored.

## Scraping

Scrapers read `FORUM_COOKIE` from the environment first, then from `.env`. Pets, guests, badges, accessories, and weapons share forum fetch, retry, cookie, text-cleanup, controlled-concurrency, and small-run CLI helpers. Pets, guests, accessories, and weapons also share forum thread post extraction so multi-variant source links can point to direct `fb.asp?m=...` reply posts.

```sh
npm run scrape:badges
npm run scrape:pets
npm run scrape:guests
npm run scrape:accessories
npm run scrape:weapons
```

Detail-page scraping uses controlled concurrency. The default is `--concurrency=2`, entry starts remain spaced by each scraper's existing delay, and values are capped at 4. Use `--concurrency=1` when debugging or when you want the old fully sequential behavior.

For small smoke tests, use `--limit=N` with the existing filters:

```sh
npm run scrape:badges -- --limit=2
npm run scrape:pets -- --letter=A --limit=2
npm run scrape:guests -- --letter=A --limit=2
npm run scrape:accessories -- --subtypes=trinket --letters=A --limit=2
npm run scrape:weapons -- --subtypes=scythe --letters=A --limit=2
npm run scrape:pets -- --letter=A --limit=2 --concurrency=1
```

For number- or symbol-starting entries, use `#` in `--letters`:

```sh
npm run scrape:accessories -- --subtypes=cape-wing --letters=# --concurrency=2
npm run scrape:weapons -- --subtypes=scythe --letters=# --concurrency=2
```

Use `.env.example` as the template. The real `.env` is ignored because it contains session cookies.

Scraper guidelines:

- Scraper intermediates may be loose, but final shared types should be strict at the boundary. For example, convert optional prices to `N/A` before building an `ObtainVariant`.
- Keep shared scraper behavior in `scripts/lib/*`, and shared item-family behavior in `src/utils/variantHelpers.ts` when pets, guests, and accessories should agree.
- Prefer subtype strategy modules under `scripts/lib/accessories/` for accessory-specific behavior.
- Use shared note-cleaning helpers for forum `Other Information`: image captions should not become notes, and note lines should only be promoted to shared family notes when every variant has that line.
- Progress files such as `src/data/pets-progress.json`, `src/data/guests-progress.json`, and their temporary atomic-write files are local scratch files and should remain untracked.
- Scrapers must automatically regenerate any lightweight manifest/count files for the datasets they write. Do not make manifest refresh a manual post-scrape step.
- Badge re-scrapes preserve curated image and subcategory fields from the existing `src/data/badges.json`, so no separate image/subcategory post-processing step is required.
- Weapons are stored in split subtype shards: swords/axes/maces, staves/wands, and daggers use A-G / H-N / O-Z files; scythes use A-J / K-Z files.

Image enrichment for active sections happens inside the TypeScript scrapers.
