# DF Companion

A DragonFable companion app for browsing badges, pets, and guests. The app is built with React, TypeScript, Vite, and Tailwind CSS.

## Commands

```sh
npm run dev
npm run build
npm run validate
npm run lint
```

## Data Validation

The production build runs the badge and pet validators before compiling:

```sh
node scripts/validate-badges.mjs
node scripts/validate-pets.mjs
```

Run `npm run validate` when changing files in `src/data`.

## Scraping

Badge and pet scrapers read `FORUM_COOKIE` from `.env`.

```sh
npm run scrape:badges
npm run scrape:pets
```

Use `.env.example` as the template. The real `.env` is ignored because it contains session cookies.
