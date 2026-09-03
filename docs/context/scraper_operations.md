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

| Agent may run directly                          | Always hand to the user                          |
| ----------------------------------------------- | ------------------------------------------------ |
| `--names="One Item"` (up to ~3 named entries)   | any run with **no** scope flags (whole category) |
| `--url=` / `--urls=` for one or two forum posts | `--letters=` / `--letter=`                       |
| `--limit=N` parser dry-run samples              | `--subtypes=` without a narrowing `--names=`     |
|                                                 | `--fresh` at category or subtype scope           |
|                                                 | `--special-only`                                 |
|                                                 | any `npm run clear:*` followed by a re-scrape    |

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
Progress files are resumable local caches only. They are not app data, should not be committed, and
can be deleted safely when starting a deliberately fresh scrape.

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
npm run scrape:accessories -- --subtypes=ring --urls="https://forums2.battleon.com/f/tm.asp?m=18525479" # Refresh off-list/stale post by URL
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
npm run scrape:housing -- --subtype=house --names="Villager Style" # Refresh specific housing names
npm run scrape:housing -- --subtype=house --fresh   # Replace the selected subtype file
```

Housing effect type metadata (`Effect Type: Heal`, `Effect Type: Utility`, etc.) is sourced from
the bold/underlined section headings at `https://forums2.battleon.com/f/fb.asp?m=21302559`. This is
only an add-on category label; the item-specific `effect` text still comes from the item's own detail
post. Some effect-bearing items are not listed under an effect-type section; leave `effectType`
unset for those rather than inferring it. The parser must ignore the sorted page's one-letter A-Z
navigation headings. Refresh only the effect-bearing furnishing subtypes to populate it:

```bash
npm run scrape:housing -- --subtype=rug
npm run scrape:housing -- --subtype=shrub
npm run scrape:housing -- --subtype=stuff
npm run scrape:housing -- --subtype=wall-item
```

### Classes / Abilities Scraping

```bash
npm run scrape:classes -- --subtype=class --class-subcategory=armor --letters=A,D --fresh
npm run scrape:classes -- --subtype=class --class-subcategory=armor --url="https://forums2.battleon.com/f/tm.asp?m=22389742"
npm run scrape:classes -- --subtype=class --class-subcategory=armor --limit=5 # Dry-run parser sample
npm run scrape:classes -- --subtype=class --class-subcategory=regular --limit=5 # Dry-run parser sample
npm run scrape:classes -- --subtype=class --class-subcategory=miscellaneous --limit=5 # Dry-run parser sample
npm run scrape:classes -- --subtype=consumable --fresh
npm run scrape:classes -- --subtype=consumable --limit=5 # Dry-run parser sample
npm run scrape:classes -- --subtype=consumable --names="Health Potion|Mana Potion"
npm run scrape:classes -- --subtype=consumable --names="Black Stardust (E: Boost)|Blue Stardust (Bonus)"
npm run generate:class-artifact-relations # Refresh class artifact ↔ Accessory artifact inline links
npm run generate:class-default-weapon-relations # Refresh class ↔ weapon default-weapon inline links
npm run generate:class-armor-relations # Refresh armor ↔ Regular class related links
```

The Classes / Abilities scraper currently implements Consumables plus all three Classes
sub-subtypes: `Armors`, `Regular`, and `Miscellaneous`. Class entries read the shared A-Z listing at
`https://forums2.battleon.com/f/tm.asp?m=22303573&mpage=1&key=&#22303582`, follow linked detail posts, and extract
family/variant names, description, DA/DC/tag metadata, `Equips Class` plus its forum link, level,
rarity, obtain methods, Other Information, source links, and Also See links. Armors do not require
main images and must not be merged with the class pages they equip. `--url=` / `--urls=` supports
targeted post refreshes; keep URLs quoted because forum URLs contain `?m=...`. The armor listing
scope should skip the table-of-contents links and stop before the Regular/Miscellaneous class
sections. Fresh class scrapes scoped with `--class-subcategory=armor|regular|miscellaneous` preserve
the other class sub-subtypes because each one writes to its own file:
`class-armors.json`, `class-regular.json`, or `class-miscellaneous.json`. Regular and Miscellaneous
class entries use subcategory-aware slugs to avoid collisions with Armors of the same display name and extract
guest-shaped stats, main/alt images, `Access Point` obtain methods, default weapon text/link,
attacks, status tags, and release dates from `https://forums2.battleon.com/f/tm.asp?m=22391532` when
listed. Some playable class posts are intentionally listed under both Regular and Miscellaneous; keep
the files split, and let the app loader dedupe by forum source while preserving both subcategory
memberships. Class stat parsing must accept both underlined stat sections and compact one-line
sections such as `Defenses: Melee: 5, ...`. Playable class pages must not use the Consumables
dialogue extractor. Class obtain methods should parse both `Requirements:` and
`Level/Quest/Items required:` labels, dropping redundant `Dragon Amulet` text after capture. The
Alexander/Archknight special-character filter is driven by the `AlexanderSaga.jpg` and
`Archknight.png` tag images. Page-level DA/DC/DM tags may mark the class entry as filterable, but
must not be copied onto every obtain method; method-level access is determined from that method's tag
block, price, required items, requirements, or D-Amulet/D-Coins/Defender's Medal text.
Class and Accessory scrapes also refresh `src/data/class-artifact-relations.json`, a lightweight
route index for class ↔ Accessory artifact inline links. It includes both class artifact attack-set
labels and artifact-side `Modifies` metadata, so artifacts that only change class appearance still
link back to their classes. Run `npm run generate:class-artifact-relations` manually after
hand-editing class or artifact JSON.
Class and Weapon scrapes also refresh `src/data/class-default-weapon-relations.json`, which converts
forum `Default Weapon` links into app routes in both directions when the matching weapon source URL
exists. Class scrapes refresh `src/data/class-armor-relations.json`, linking Armors to the Regular
class pages they equip; Miscellaneous classes are intentionally excluded from this armor relation
index.
Playable class detail fetches must isolate the linked reply's message body before parsing; forum
wrapper text such as `Logged in as: Guest`, breadcrumbs, `Printable Version`, or `Forum Login` is
invalid item content and should be rejected or filtered during normalization.
Record classes with important later-post data for case-by-case handling before running a full
Regular/Miscellaneous scrape.
After the first full Regular/Miscellaneous scrape, audit for skill blocks that remain in
`Other Information` by searching notes for `Requirements:`, `Mana Cost:`, `Cooldown:`,
`Damage Type:`, or `Element:`. Those rows indicate a class page whose skill separators or later
forum replies need targeted parser handling before the entry is considered complete.
The base class pattern parses the linked reply plus same-thread follow-up replies. The immediate
non-artifact follow-up is used for global images and page-level notes because forum threads such as
Mage/Rogue/Warrior store that material after the main skill post. Later replies are only structured
as alternate attack sets when they contain an explicit `Artifact:` heading, e.g. Cloak Scrap for the
base classes or DragonLord's artifact posts. Non-artifact follow-up replies that contain normal
playable skill blocks are additional variants instead of support posts; `Edd Disguise` is the
reference case, with `Complex Skills` and `Simple Skills` variants plus a final support reply for
shared images and notes.
Playable class image parsing should consume forum captions in document order, including labels near
plain `<img>` tags and grouped link labels such as `Original Appearance: Male / Female`. If notes
contain linked skill/weapon appearance images, prefer explicit class-gallery labels such as
`Armor Set Appearance`, then the image URL family matching the class name for the class portrait
selector. Do not reject raw GitHub-hosted art because `githubusercontent` contains the letters
`icon`; only actual `/icon/` or `/icons/` path segments are forum UI images. Appearance caption lines
consumed for attack image captions must be removed from attack notes and page-level Other
Information. Class attack requirements should follow the guest attack shape, with redundant
`Dragon Amulet` text stripped because DA status already appears in tags and obtain-method pills.
Class attack-image captions can come from long same-line prefixes before several hotlinks, including
SoulWeaver-style labels such as `Book 1 Aegis: Appearance 1 / 1.1` and
`Original / Color Custom / Soulforged / ... / Delta: Appearance 1 / 1.1`. Keep duplicate image URLs
when their captions differ. Artifact sections with no real skill fields should contribute notes only;
do not turn an artifact `Other information` block into a fake attack. They may still produce an
artifact attack-set option with zero attacks so the detail page can show artifact-specific
notes/mechanics only when that option is selected.
Some class pages use named parenthetical appearance labels instead of numbered labels, such as
`Appearance (Charging)`, `Appearance (Attacking)`, `Appearance (Kick)`, or the forum typo
`Apperance (Hit)`. Normalize these to short UI captions (`Charging`, `Attacking`, `Kick`, `Hit`) and
strip the display-only caption text from attack notes.
Class mechanics are parsed as their own structured blocks when the forum provides widget-image
captions such as `<Class>'s widget displaying ...`. For artifact sections, mechanics before the first
skill belong to that artifact attack set, while a final horizontal-rule-separated `Other information`
section after the last skill becomes artifact-set notes.
`ChronoZ` is a Regular-class single-post exception: ignore later same-thread posts because they
contain combo listings that are too specific for the app. Keep `CZ-Widget.gif` in the mechanics block
only; do not include it as a class-gallery `Main` image.

The weapon scraper has a small hardcoded cleanup for base-plus-parenthetical forum family titles
where the source family title names only one sibling variant. These normalize to a base display
family with `(Base)` and the parenthetical variant label while retaining source aliases; do not widen
this pass without checking `docs/context/category_playbooks.md`.

The Consumables path reads the A-Z
listing at `https://forums2.battleon.com/f/fb.asp?m=22304639`, appends supplemental Health Potion
(`m=4159197`) and Mana Potion (`m=4159198`) entries that are absent from the index, follows each
linked forum post, and extracts family/name, description, obtain methods, level, rarity, effect text,
dialogue snippets, Other Information, and source links. It skips the listing headings
`Alphabetical Consumables Listing` and `Consumables Sorted by Effects`. Dust/Food/Rune filters come
from the A-Z `[D]`, `[F]`, and
`[R]` prefixes, with individual post `Item Type` as a fallback. Seasonal/category tags come from listing tag images,
listing text such as `Seasonal`, and detail-post tag images such as `/tags/Seasonal.jpg`; normalize
tag filenames, `alt`, and `title` labels before matching seasonal holiday aliases. Consumable family
effects are shared by default unless variants have distinct explicit `Effect:` / `Effects:` lines.
Dialogue snippets between `Level:` and `Effect:` / `Effects:` are stored separately from description
and Other Information; strip repeated item-name prompt labels and `OK` button lines while keeping
prompt/context text and quote text.
Consumable effect type labels are sourced from the sorted effects page
`https://forums2.battleon.com/f/fb.asp?m=22304644`; only bold/underlined section headings such as
`STR`, `DEX`, `Boost`, `All Resist`, and `Utility` count. Ignore `Contents`, `Legend`, and A-Z
navigation headings, and do not infer an effect type for unlisted consumables. Health/Mana Potion
effect blocks also parse skill button and Appearance images into the shared
attack-style display shape. The potion button images use fixed DF-Pedia `Skill-HP.png` and
`Skill-MP.png` assets, and standalone `Appearance` hotlink labels are discarded from Other
Information. Consumables are Temp by default except Health Potion and Mana Potion; do not require main
images for ordinary Consumables. Base/`+` duplicate listing links are deduped by slug during write,
preserving both variants inside the non-`+` family.

All category scrapers should use the shared `computePriceType` / access-flag repair path for
obtain-method classification. Pure `Required Items: Defender's Medal` methods are DM methods, not
Merge Required methods; only non-medal required-item recipes should set `priceType: "merge"`.
For family-capable Accessories and Weapons, parse DA/DC/DM access from each variant title/obtain
block before applying any page-level tag fallback. If a post contains mixed DC and non-DC obtain
methods, do not apply whole-post DA/DC tag images to every method; alternating Roman numeral families
depend on keeping those method-level access flags distinct.
Variant descriptions are scoped the same way as access flags. A family `shared.description` is valid
only when all variants have identical description text. When expanding one post into multiple obtain
branches, including Pets/Guests and Accessories/Weapons, capture the prose immediately above each
branch's obtain block and keep it on that variant. Do not copy access-specific prose such as
`This item requires a Dragon Amulet.` onto a non-DA/DC branch. Missing descriptions may only fall back
to same-level siblings with the same DA/DC/DM access signature.

## Scraper Notes

- All scraper entry points support `--names="Name One,Name Two"` for scoped refreshes. Pets and guests
  also support `--fresh` to bypass cached progress for the selected names.
- Scoped name/letter runs preserve out-of-scope data instead of writing a tiny partial dataset. When
  a `--names` run does not find a requested name in a selected subtype, that missing name must not
  prune existing rows from that subtype. For cross-post families, targeted refreshes must keep
  unmatched sibling variants in the merge pool so post-processing can rebuild the family.
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
- L2 status tags (`Temp`, `Rare`, `Seasonal`, `Special Offer`, `War`, `Retired`, etc.) should be
  driven by forum tag images under `/tags/<TagName>.<ext>` whenever those images are present.
  Category A-Z listings sometimes use text-only parentheticals such as `(D-Coins/Rare/S-Offer)`
  instead of rendering tag images; in that case, the listing text is the fallback source for that row.
- All current and future scrapers should preserve forum note structure in generated note/Other
  Information fields. The shared `OtherInformationSection` / `NotesList` renderer already understands
  newline-delimited bullets with two-space nested indentation (`•`, `•`, etc.), indented non-bullet
  continuation lines such as `Stats:` / `Resists:` under a preceding "had the initial/following
  stats:" note, forum quote blocks as a bare `quote:` line followed by indented quote lines, and
  popup text markers consumed by `PopupText`; scraper code should emit those structures instead of
  flattening nested forum `<ul>/<li>`, indented stat continuations, `<blockquote class="quote">`, or
  popup content into one plain list.

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
npm run scrape:housing # Scrape housing (supports --subtype, --names, --limit, --fresh)
npm run generate:badge-relations # Refresh cross-category item ↔ badge inline links
npm run validate       # Run all dataset validators + cross-post-family verify + script typecheck
npm run verify         # Cross-post-family invariant checks (dup slugs, alias/AlsoSee integrity)
npm run typecheck:scripts # Typecheck scripts/ against tsconfig.scripts.json
npm run images:guests  # Extract guest character images from forum (auto-uses venv)
npm run setup:python   # Manually create the Python venv used by image scripts
```

## Visual Verification (Screenshots)

`scripts/screenshot.ts` lets any AI agent take a screenshot of the running dev server for visual QA.
Requires `npm run dev` to be running on `localhost:5173`.

```bash
npx tsx scripts/screenshot.ts '/housing?type=wall-item&category=effect'
npx tsx scripts/screenshot.ts '/pets/goldfish-knight' --width=1440 --height=900
npx tsx scripts/screenshot.ts '/classes' --full-page --name=classes-overview
```

**Options:** `--width=N` (default 1280), `--height=N` (default 720), `--full-page` (capture below
the fold), `--name=slug` (custom output filename).

**Output:** `.tmp/screenshots/<timestamp>-<slug>.png` — the path is printed to stdout. The `.tmp/`
directory is gitignored.

**Important:** always quote paths containing `?` or `&` to prevent shell expansion.

Agents should use this after UI changes to verify rendering before marking work done. The output PNG
can be viewed via `read_file` (Kiro returns base64 for images) or attached to the chat.

Run `npm run generate:badge-relations` after scrapes that change item descriptions, Other
Information, family source titles, or aliases. The generated `src/data/badge-relations.json` index
powers cross-category inline links for explicit award notes such as `Own this armor to obtain the
Time Walker badge` without forcing detail pages to lazy-load large category datasets.

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
- Pet, guest, accessory, and weapon scrapes treat `tags/WarLoot.jpg` as the `isWar` category flag.
  Image extractors must not treat forum `/tags/` assets as main item images. Badges and Housing do
  not currently use WarLoot detection.
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
