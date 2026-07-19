# DF Companion

A DragonFable companion app for browsing badges, pets, guests, and accessories. The app is built with React, TypeScript, Vite, and Tailwind CSS.

## Commands

```sh
npm run dev
npm run build
npm run validate
npm run lint
```

## Data Validation

The production build runs the badge, pet/guest, and accessory validators before compiling:

```sh
node scripts/validate-badges.mjs
node scripts/validate-pets.mjs
node scripts/validate-accessories.mjs
```

Run `npm run validate` when changing files in `src/data`.

## Scraping

Scrapers read `FORUM_COOKIE` from `.env`. Pets, guests, and accessories share forum thread post extraction so multi-variant source links can point to direct `fb.asp?m=...` reply posts.

```sh
npm run scrape:badges
npm run scrape:pets
npm run scrape:guests
npm run scrape:accessories
```

Use `.env.example` as the template. The real `.env` is ignored because it contains session cookies.
