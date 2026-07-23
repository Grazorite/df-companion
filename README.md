# DF Companion

A DragonFable companion app for browsing badges, pets, guests, and accessories. The app is built with React, TypeScript, Vite, and Tailwind CSS.

## Commands

```sh
npm run dev
npm run build
npm run validate
npm run lint
npm run typecheck:scripts
```

## Data Validation

The production build runs the badge, pet/guest, and accessory validators plus a TypeScript check for scraper files before compiling:

```sh
node scripts/validate-badges.mjs
node scripts/validate-pets.mjs
node scripts/validate-accessories.mjs
npm run typecheck:scripts
```

Run `npm run validate` when changing files in `src/data` or `scripts`. This catches scraper-only TypeScript issues that the app build does not otherwise see.

## Scraping

Scrapers read `FORUM_COOKIE` from the environment first, then from `.env`. Pets, guests, badges, and accessories share forum fetch, retry, cookie, text-cleanup, and small-run CLI helpers. Pets, guests, and accessories also share forum thread post extraction so multi-variant source links can point to direct `fb.asp?m=...` reply posts.

```sh
npm run scrape:badges
npm run scrape:pets
npm run scrape:guests
npm run scrape:accessories
```

Detail-page scraping uses controlled concurrency. The default is `--concurrency=2`, entry starts remain spaced by each scraper's existing delay, and values are capped at 4. Use `--concurrency=1` when debugging or when you want the old fully sequential behavior.

For small smoke tests, use `--limit=N` with the existing filters:

```sh
npm run scrape:badges -- --limit=2
npm run scrape:pets -- --letter=A --limit=2
npm run scrape:guests -- --letter=A --limit=2
npm run scrape:accessories -- --subtypes=trinket --letters=A --limit=2
npm run scrape:pets -- --letter=A --limit=2 --concurrency=1
```

Use `.env.example` as the template. The real `.env` is ignored because it contains session cookies.

Scraper guidelines:

- Scraper intermediates may be loose, but final shared types should be strict at the boundary. For example, convert optional prices to `N/A` before building an `ObtainVariant`.
- Keep shared scraper behavior in `scripts/lib/*`, and shared item-family behavior in `src/utils/variantHelpers.ts` when pets, guests, and accessories should agree.
- Prefer subtype strategy modules under `scripts/lib/accessories/` for accessory-specific behavior.
- Progress files such as `src/data/pets-progress.json`, `src/data/guests-progress.json`, and their temporary atomic-write files are local scratch files and should remain untracked.
- Scrapers must automatically regenerate any lightweight manifest/count files for the datasets they write. Do not make manifest refresh a manual post-scrape step.
- Badge re-scrapes preserve curated image and subcategory fields from the existing `src/data/badges.json`, so no separate image/subcategory post-processing step is required.

Image enrichment for active sections happens inside the TypeScript scrapers.
