# Scraper Update Guide

## Overview

This guide explains what happens when you re-run the pet/guest scrapers and how the new changes will be applied.

## Changes Implemented

### 1. Type Detection (Pet vs Guest)
- **Primary source**: Chronology page with `[P]` and `[G]` markers
- **Fallback**: Content detection (detailed stats for guests)
- **Result**: All entries will be correctly tagged as `pet` or `guest`
- **Slug format**: `pet-king-linus`, `guest-artix` (type-prefixed)

### 2. Price Type Classification

#### Free
- **Criteria**: Price is explicitly "0 Gold" or "Free"
- **Example**: `{ price: "0 Gold", priceType: "free" }`

#### Merge Required
- **Criteria**: Price is "N/A" AND has `requiredItems` field with content
- **Example**: `{ price: "N/A", requiredItems: "1 Filament & 15 Scrap metal", priceType: "merge" }`

#### DC / DM
- **Criteria**: Price contains "Dragon Coins" or "Defender's Medal"
- **Detection**: Also checks for DC.png / DM.png image tags in forum post

#### Gold
- **Criteria**: Everything else (includes paid amounts and N/A without required items)

### 3. Category Detection (Level 2 Filters)

All detected via image tags in forum posts:

| Category | Image Tag | Field |
|----------|-----------|-------|
| Defender's Medals | `tags/DM.png` | `dmRequired: true` |
| Temporary | `tags/Temp.png` | `isTemp: true` |
| Rare | `tags/Rare.jpg` | `isRare: true` |
| Seasonal | `tags/Seasonal.jpg` | `isSeasonal: true` |
| Special Offer | `tags/SpecialOffer.png` | `isSpecialOffer: true` |
| Retired | `tags/Retired.png` | `retired: true` |

**Note**: An entry can have MULTIPLE Level 2 categories (e.g., both Seasonal AND Rare).

## Re-running the Scrapers

### Step 1: Scrape Pets & Guests (Updates everything except images)

```bash
npm run scrape:pets
```

**What this does:**
- ✅ Fetches Chronology page first (gets pet/guest types)
- ✅ Parses A-Z page with correct types
- ✅ Fetches each individual forum thread (~8 minutes)
- ✅ Detects ALL category tags (DA, DC, DM, Temp, Rare, Seasonal, Special Offer, Retired)
- ✅ Parses price types correctly (Free vs Merge Required)
- ✅ Updates release dates from Chronology
- ✅ Extracts initial forum images (may include skill buttons for guests)
- ✅ Writes to `src/data/pets.json`

**Progress tracking:**
- Progress saved to `src/data/pets-progress.json` after each entry
- Safe to interrupt and resume with `--start=C` or `--letter=B`

### Step 2: Add Pet Images from DF-Pedia GitHub

```bash
npm run images:pets
```

**What this does:**
- ✅ Automatically creates Python virtual environment if not present
- ✅ Installs required `requests` library
- ✅ Converts pet names to DF-Pedia GitHub URLs
- ✅ Updates `imageUrl` field for pets only
- ✅ Skips entries that already have forum images
- ✅ Not all pets have GitHub images — broken images show fallback UI

### Step 3: Add Guest Character Images from Forum

```bash
npm run images:guests
```

**What this does:**
- ✅ Automatically creates Python virtual environment if not present
- ✅ Installs required `requests` library
- ✅ Fetches forum pages for guests only
- ✅ Extracts character images BEFORE "Appearance" section
- ✅ Skips skill button images (Button, Attack.png in URL)
- ✅ Updates `imageUrl` field for guests
- ✅ Skips guests that already have images
- ✅ Not all guests have character images on forum

## What Gets Updated

### All Entries
- ✅ **Type** (`pet` vs `guest`) — from Chronology
- ✅ **Slug** — updated to match type prefix
- ✅ **DA/DC/DM flags** — detected from image tags
- ✅ **Category flags** (Temp, Rare, Seasonal, S-Offer, Retired)
- ✅ **Price types** — Free, Merge Required, DC, DM, Gold
- ✅ **Release dates** — from Chronology
- ✅ **Descriptions, attacks, evolutions** — from individual threads
- ✅ **Notes** — from "Other information" section and standalone "Note:" lines (stripped before display)
- ✅ **Tags** — for search indexing

### Pets Only
- ✅ **Images from DF-Pedia GitHub** — via `npm run images:pets`

### Guests Only
- ✅ **Character images from forum** — via `npm run images:guests`

## Filter Behavior After Update

### Level 1: Access Filters (Pets Page)
- **All** — Show everything (except retired)
- **DA Required** — Only items requiring DragonAmulet
- **Merge Required** — Only items with N/A price AND required items
- **Free** — Only items with explicit "0 Gold" or "Free" price
- **DC** — Only items purchasable with Dragon Coins
- **DM** — Only items purchasable with Defender's Medals

**Order**: All, DA Required, Merge Required, Free, DC, DM

**Guests Only Mode:**
- Merge Required, Free, DC, DM buttons are hidden
- Only "All" and "DA Required" remain visible
- Guests don't have currency-based acquisition methods

### Level 2: Category Filters
- **Temp, Rare, Seasonal, Special Offer** — Multi-select with OR logic
- **Retired** — When selected, ONLY show retired; otherwise exclude retired

### Level 3: Element/Trait Filters
- Multi-select pills with OR logic
- Custom colours per element/trait

## Data Integrity

### Before Re-running
Your current `pets.json` may have:
- ❌ Some entries incorrectly typed (e.g., King Linus as guest)
- ❌ Missing category flags (DM, Temp, Rare, etc.)
- ❌ Incorrect price type classification (Free vs Merge)
- ❌ Guest entries with skill button images instead of character images

### After Re-running
- ✅ All entries correctly typed as pet or guest
- ✅ All category flags properly detected
- ✅ Price types correctly classified
- ✅ Pets have GitHub images (where available)
- ✅ Guests have character images (where available, no skill buttons)

## Resuming Interrupted Scrapes

If the scraper crashes or times out:

```bash
# Resume from a specific letter
npm run scrape:pets -- --start=M

# Or scrape just one letter (for testing)
npm run scrape:pets -- --letter=A
```

Progress is saved to `pets-progress.json` after each entry, so you won't lose work.

## Expected Output

After running all three commands, you should see:

```
📊 Summary:
   Total stubs:   380
   In progress:   379
   Pets:          ~310
   Guests:        ~69
   With images:   ~379
   With dates:    ~345
```

**Note**: Not all entries have images or release dates. Missing data shows fallback UI or "Unknown" label.

## Troubleshooting

### "Cookie expired" error
Refresh the forum page in your browser and update `.env` with new `FORUM_COOKIE` value.

### "Missing 1 entry" message
The A-Z page includes navigation links that are filtered out. This is expected.

### Images not updating
- Pet images: Check if DF-Pedia GitHub has the image (not all pets have sprites)
- Guest images: Check if forum post has character image before "Appearance" section

### Type still incorrect after re-scrape
Check if entry exists in Chronology page with `[P]` or `[G]` marker. If not in Chronology, type detection falls back to content analysis.

## Questions?

See `AGENTS.md` for detailed documentation on:
- Filter architecture
- Data model
- Scraper implementation
- Development commands
