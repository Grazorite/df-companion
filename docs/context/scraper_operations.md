# Scraper Operations & Commands

> Static reference. Extracted from the pre-refactor monolithic `AGENTS.md`.
> Covers: all npm commands, scraping workflows, shared scraper architecture, dataset verification,
> Python environment.

## Prerequisites

```bash
# 1. Get your session cookie (see .env.example for instructions)
cp .env.example .env
# 2. Paste your cookie into .env (see instructions in the file)
# 3. Run a scraper
npm run scrape:badges
```

**Cookie expiry**: The forum cookie expires after some time. If the scraper fails, refresh the forum
page in your browser and re-copy the cookie.

## Who May Run a Scrape — hard rule

**AI agents must never run a broad scrape. Full and category-wide re-scrapes are always handed to the
user to run manually.** This is not a style preference; treat it as a hard constraint that overrides
any instinct to be helpful by just running it. Broad scrapes take a long time, hammer a third-party
forum, depend on a human-supplied session cookie that expires mid-run, and rewrite thousands of
dataset entries in ways that are tedious to unpick.

An agent may run a scrape **only** when it is narrowly scoped to verify a specific fix in the current
task. The bright line is the CLI scope flags:

| Agent may run directly | Always hand to the user |
| ------------------------ | ------------------------- |
| `--names="One Item"` (up to ~3 named entries) | any run with **no** scope flags (whole category) |
| `--url=` / `--urls=` for one or two forum posts | `--letters=` / `--letter=` |
| `--limit=N` parser dry-run samples | `--subtypes=` without a narrowing `--names=` |
| | `--fresh` at category or subtype scope |
| | `--special-only` |
| | any `npm run clear:*` followed by a re-scrape |

When handing over, give the user: the exact command, the prerequisites (valid cookie in `.env`), the
expected output files, and what to eyeball in the result. Then stop and wait. Do not estimate the
outcome and proceed as though the scrape had run.

Two corollaries. Never hand-edit dataset JSON as a substitute for a scrape you were not allowed to
run — a targeted re-scrape plus inspection is the only sanctioned way to change scraped data. And if a
scraper fix cannot be verified without a broad run, say so plainly, mark the work unverified, and put
the re-scrape on the AGENTS.md board rather than quietly running it.

## Clear Data Cache

```bash
npm run clear:pets      # Clear pets.json and pets-progress.json
npm run clear:guests    # Clear guests.json and guests-progress.json
npm run clear:all       # Clear both pets and guests
```

## Scraping Workflows

### Pet Scraping

```bash
npm run clear:pets                                  # Clear existing data
npm run scrape:pets                                 # Scrape all pets → pets.json (includes forum images)
npm run scrape:pets -- --letter=A                   # Scrape only letter A (for testing)
npm run scrape:pets -- --start=C                    # Resume from letter C onwards
npm run scrape:pets -- --letters=A,B                # Scrape multiple letters
npm run scrape:pets -- --names="Goldfish Knight"    # Refresh specific pet names
npm run scrape:pets -- --names="Goldfish Knight" --fresh  # Ignore matching cached entries
npm run images:pets                                 # Add DF-Pedia GitHub images to pets.json
npm run images:pets -- --letters=A,B                # Add images for specific letters only
```

Progress saved to `src/data/pets-progress.json` (gitignored).

### Guest Scraping

```bash
npm run clear:guests                                # Clear existing data
npm run scrape:guests                               # Scrape all guests → guests.json
npm run scrape:guests -- --letter=A                 # Scrape only letter A (for testing)
npm run scrape:guests -- --letters=A,B              # Scrape multiple letters
npm run scrape:guests -- --names=Aegis              # Refresh specific guest names
npm run scrape:guests -- --names=Aegis --fresh      # Ignore matching cached entries
npm run scrape:guests -- --fresh --concurrency=1    # Local full refresh; reuses generated CharPage PNGs without running Ruffle
npm run scrape:guests -- --names="Cranix|Dain Lorilann|Elgert|Mennace|Xor Vrailin II" --fresh --concurrency=1 --capture-charpages  # Slow local A/C CharPage capture
npm run images:guests                               # Extract guest images from forum to guests.json
npm run images:guests -- --force                    # Force refresh all guest images
```

### Badge Scraping

```bash
npm run scrape:badges
npm run scrape:badges -- --names="Arachnalchemy Mastery"  # Refresh specific badge names
```

### Accessory Scraping

```bash
npm run scrape:accessories                          # Scrape all accessory subtype datasets
npm run scrape:accessories -- --subtypes=trinket    # Scrape a single subtype
npm run scrape:accessories -- --subtypes=bracer,trinket --letters=A,B
npm run scrape:accessories -- --subtypes=cape-wing --names="Mantle of Shadows,Invisible Cape"
```

### Weapon Scraping

```bash
npm run scrape:weapons -- --subtypes=scythe --letters=A
npm run scrape:weapons -- '--letters=#' --concurrency=2
npm run scrape:weapons -- --subtypes=scythe --names="Abyssal Heart"
npm run scrape:weapons -- --subtypes=scythe --url='https://forums2.battleon.com/f/tm.asp?m=22357170'
npm run scrape:weapons -- --special-only --fresh --concurrency=1
npm run scrape:weapons -- --special-only --missing-special-images-only
```

### Housing Scraping

```bash
npm run scrape:housing -- --subtype=house           # Scrape one Housing subtype (additive by slug)
npm run scrape:housing -- --subtype=house --limit=5 # Dry-run parser sample
npm run scrape:housing -- --subtype=house --fresh   # Replace the selected subtype file
```

## Scraper Notes

- All scraper entry points support `--names="Name One,Name Two"` for scoped refreshes. Pets and guests
  also support `--fresh` to bypass cached progress for the selected names.
- Scoped name/letter runs preserve out-of-scope data instead of writing a tiny partial dataset.
- Weapons additionally support `--url=` / `--urls=` for direct forum-post refreshes when the master
  index is missing or misclassifying an item; pass exactly one `--subtypes=` value with direct URLs.
- Weapon index navigation links such as `(A-G)` and `(A-J)` are ignored before scraping; they are not
  item entries.
- Pet, guest, and accessory scrapers share forum thread post extraction so multi-variant source links
  can point to direct `fb.asp?m={messageId}` reply posts.
- Shared `Also See` parsing collects all `Also See:` / `Also See (...)` sections in a post, including
  later sections after `Other Information`, and dedupes the resolved refs.
- Family-capable partial refreshes must be family-safe: if a later batch scrapes a standalone entry
  whose slug is already owned by an existing family, keep the family in the merge pool and
  fold/canonicalize through post-processing instead of replacing the family shell. Shared guard helpers
  live in `scripts/lib/family-merge-guard.ts`; category-specific adapters still own variant
  construction.
- Helms and Capes & Wings are stored as A-L / M-Z JSON shards (`helms-a-l.json`, `helms-m-z.json`,
  `capes-wings-a-l.json`, `capes-wings-m-z.json`) to keep image-heavy lazy-loaded assets smaller while
  preserving one UI subtype.
- All scrapers extract images directly from forum posts during scraping.
- Main image and alternative images with captions are captured automatically.
- Images are extracted from the forum HTML (before "Appearance" section for guests to avoid skill
  buttons).
- Scrape execution is governed by the hard rule in **Who May Run a Scrape** above. Agents run only
  narrowly scoped verification scrapes; anything category-wide or broader is handed to the user with
  the exact command, prerequisites, and expected output files, while the agent stays on scraper logic,
  validation, and data review.
- Scrapers must automatically regenerate any lightweight manifest/count files for the datasets they
  write. Manifest refresh should not be a manual post-scrape step.
- Deleted/moved forum posts (HTTP 500 on `printable.asp`) are handled gracefully via
  `isPostUnavailableError` — the item is skipped with a warning and the run continues. This applies to
  all scrapers (weapons, accessories, badges, pets, guests, housing).
- All current and future scrapers should preserve forum note structure in generated note/Other
  Information fields. The shared `OtherInformationSection` / `NotesList` renderer already understands
  newline-delimited bullets with two-space nested indentation (`•`, `•`, etc.), forum quote blocks as
  a bare `quote:` line followed by indented quote lines, and popup text markers consumed by
  `PopupText`; scraper code should emit those structures instead of flattening nested forum
  `<ul>/<li>`, `<blockquote class="quote">`, or popup content into one plain list.

## Other Commands

```bash
npm run dev            # Start development server
npm run build          # Production build (validate + tsc -b + vite build)
npm run preview        # Preview production build locally
npm run lint           # Run Oxlint
npm run format         # Run Prettier
npm run scrape:badges  # Scrape forum badges (supports --names)
npm run scrape:pets    # Scrape forum pets (supports --letters, --names, --fresh)
npm run scrape:guests  # Scrape forum guests (supports --letters, --names, --fresh)
npm run scrape:accessories # Scrape accessories (supports --subtypes, --letters, and --names)
npm run scrape:weapons # Scrape weapons (supports --subtypes, --letters, --names, and --url/--urls)
npm run scrape:housing # Scrape housing (supports --subtype, --limit, --fresh)
npm run validate       # Run all dataset validators + cross-post-family verify + script typecheck
npm run verify         # Cross-post-family invariant checks (dup slugs, alias/AlsoSee integrity)
npm run typecheck:scripts # Typecheck scripts/ against tsconfig.scripts.json
npm run images:guests  # Extract guest character images from forum (auto-uses venv)
npm run setup:python   # Manually create the Python venv used by image scripts
```

## Dataset Verification

**`npm run verify`** runs `scripts/verify-datasets.mjs` over the family-capable datasets (accessories,
weapons, pets/guests) and is also part of `npm run validate` / `npm run build`. It separates:

- **Errors (fail the build):** duplicate canonical slugs; `Also See` / evolution refs that point at an
  alias slug instead of the canonical family slug; self-referential refs; refs with no local target
  and no URL.
- **Warnings (non-fatal):** an alias slug claimed by two families; an alias slug also emitted as a
  standalone entry. These indicate a scraper-side fix is needed and cannot be corrected safely by hand.

A family listing its own slug in `aliasSlugs` is an intentional same-thread convention and is ignored
by the verifier.

## Scraper Structure Guidelines

Scrapers should be treated as orchestration entry points, not long-term homes for every parsing rule.
Prefer this structure as existing scrapers are touched:

- `scripts/scrape-*.ts`: CLI arguments, fetch loop, progress/reporting, final dataset write
- `scripts/lib/printable-parser.ts`: shared forum fetch/content extraction helpers
- `scripts/lib/forum.ts`: shared HTTP fetch, retry logic, rate limiting, and `isPostUnavailableError`
  (deleted-post detection)
- `scripts/lib/obtain-formatting.ts`: shared obtain-card parsing and display formatting
- `scripts/lib/also-see.ts`: shared `Also See:` extraction from forum HTML
- `scripts/lib/access-flag-repair.ts`: shared DA/DC/DM and category flag repair logic
- `scripts/lib/family-merge-guard.ts`: shared family-safe scoped-refresh guards and family-aware
  same-slug dedupe
- `scripts/lib/tags.ts`: shared retired-tag detection helper
- `scripts/lib/cross-post-family.ts`: pet/guest cross-post family promotion only
- `scripts/lib/accessories/*`: accessory subtype strategies for image rules, family inspection,
  conservative cross-post promotion, and subtype-specific quirks
- `scripts/lib/data-manifests.ts`: manifest/count regeneration for each dataset
- `src/utils/imageLabels.ts`: shared image caption inference and main/alternative image switcher labels
  for item detail pages

Shared extraction should stop at neutral parsed facts. Category-specific behavior should stay
category-specific: pets/guests may promote safe `Also See` relationships into item families;
accessories may promote configured subtypes when the relationship has explicit `Also See` links plus
title/content evidence, while unresolved accessory `Also See` refs should not render as source-link
cards.

## Python Environment

- Image scripts automatically create and use a Python virtual environment (`.venv/`)
- First run will setup the venv and install `requests` library
- To manually setup: `npm run setup:python`
- Venv is gitignored and local to your machine
