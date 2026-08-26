# Category Playbooks

> Static reference. Extracted from the pre-refactor monolithic `AGENTS.md`.
> Per-category consolidation rules, split exceptions, and special cases for Badges, Pets/Guests,
> Accessories, Weapons, and Housing.

---

## Badges

### Adding a New Badge (manual curation)

1. Find badge info on the DragonFable forums
2. Add entry to `src/data/badges.json`:

```json
{
  "id": "unique-slug-here",
  "name": "Badge Display Name",
  "slug": "unique-slug-here",
  "description": "Flavour text / italic description from the forum post",
  "category": "quest-completion",
  "subcategory": "Side Quests",
  "requirements": "Completion of Quest Name",
  "daRequired": false,
  "retired": false,
  "howToObtain": [{ "order": 1, "instruction": "Completion of Quest Name" }],
  "forumLinks": [
    {
      "url": "https://forums2.battleon.com/f/tm.asp?m=XXXXX",
      "title": "DF Encyclopedia: Badge Name",
      "isPrimary": true
    }
  ],
  "imageUrl": "https://raw.githubusercontent.com/DF-Pedia/DF-Pedia/master/badges/BadgeName.png",
  "tags": ["subcategory-tag"],
  "notes": "Optional bullet 1. • Optional bullet 2."
}
```

1. Commit and push → site auto-deploys

### Badge Scraper Behaviour

The scraper:

1. Fetches the **A-Z Badges master post** (`tm.asp?m=22304590&mpage=1`) which lists all 161 active
   badges alphabetically with forum links, plus the retired section
2. Parses each badge link and detects `retired: true` for anything that only appears in the retired
   section
3. Fetches **each individual badge thread** (161 requests at 0.8s intervals ≈ ~4 minutes total) to
   get: description, DA status, requirements, category, notes
4. Maps badges to subcategories using the forum's "Badges Sorted by Category" post groupings
5. Applies category overrides: seasonal badges labelled "Other Badges" by the forum are re-mapped by
   name pattern (Mogloween, Frostval, HHD, etc.)
6. Writes complete `badges.json` sorted alphabetically

After scraping, run `python3 scripts/add_images.py` to add badge image URLs from DF-Pedia GitHub, and
`python3 scripts/add_subcategories.py` to re-apply subcategory mappings.

### Cross-Category Award Links

Items in other categories can explicitly award badges through notes such as
`Own this armor to obtain the Time Walker badge`. These produce bidirectional `Also See` links:
item detail pages resolve the badge from `badges.json`, and badge detail pages use
`src/data/badge-relations.json` to link back to the awarding item. Regenerate that lightweight index
with `npm run generate:badge-relations` after scrapes that change item notes/descriptions. Keep this
phrase-based rather than fuzzy; do not infer badge links from casual prose like "badge of honor".

---

## Pets & Guests

### Mixed Variant Group Splits

Pets usually keep same-thread or linked variants together, including normal/DC access branches and
level progressions. Split a pet family only when one family mixes a named progression group with a
distinct named sibling item that is clearer as its own entry. Current targeted split set:
Baron/BraveSirRobin/Deatharrows/Josh/LFAL/Prius `(Kitten, Cat)` pets are separate from their
`Fierce ... Cat` pets, `Goldfish` is separate from `Goldfish Knight`, `Steam Tog` is separate from
`PowerTog`, and `Extra Fluffy Tog Extreme` is separate from `Extra Fluffy Tog I-III`; split siblings
receive mutual `Also See` links.

### DA/DC Detection

- `daRequired`: Automatically detected if forum post contains `<img src="...tags/DA.png">`
- `dcRequired`: Automatically detected if forum post contains `<img src="...tags/DC.png">`
- `dmRequired`: Automatically detected if forum post contains `<img src="...tags/DM.png">`
- Both flags are set at scrape time by checking for image tags in the raw HTML
- An entry can be both DA and DC/DM
- For multi-variant families, DA/DC are detected per-title-block: a DA tag before the base title
  block does NOT bleed onto the DC variant unless the DC block also has its own DA tag
- Access-flag-repair preserves explicitly-scraped `daRequired=true` values and will not clear them.
  Narrow item-specific repairs may override this only where the forum pattern is known; Goldfish
  Knight levels IV-VII are `Normal` DA-only plus `DC` DC-only.
- Accessories and Weapons follow the same per-title-block rule. Roman numeral families often
  alternate DA-only and DC-only variants in one thread; when a post has mixed DC and non-DC obtain
  methods, method-block tags/price/required-items are authoritative and whole-post DA/DC tag images
  must not be applied to every variant.

### Multi-Variant Access Branches

When a pet thread has both a free/base variant and a DC variant, the scraper splits them into
separate level variants using `buildLevelAccessVariants`:

- `variantName: 'Normal'` → displays as `(Base)` in the UI
- `variantName: 'DC'` → displays as `(DC)` in the UI
- Forum label `(Resource)` is mapped to `Normal` (same as base tier)
- For "(All Versions)" families where the same labels repeat across levels, the UI prefixes with the
  level in parentheses: `(10)`, `(10) (DC)`, `(20)`, `(20) (DC)`, etc.

### Category Detection (Level 2 filters)

- `isTemp`: Detected via `<img src="...tags/Temp.png">`
- `isRare`: Detected via `<img src="...tags/Rare.jpg">`
- `isSeasonal`: Detected via `<img src="...tags/Seasonal.jpg">`
- `isSpecialOffer`: Detected via `<img src="...tags/SpecialOffer.png">`
- `isWar`: Detected via `<img src="...tags/WarLoot.jpg">` for pets and guests; this tag image is
  never a main item image candidate.
- `retired`: Detected via `<img src="...tags/Retired.png">`
- An entry can have multiple L2 categories (e.g., both Seasonal AND Rare)

Accessories and weapons use the same `isWar` flag when `tags/WarLoot.jpg` appears in a detail post.
Badges and Housing do not currently use WarLoot category detection.

### Type Detection (Pet vs Guest)

- **Primary source**: A-Z Pets & Guests master page sections — pets and guests are scraped from their
  dedicated sections
- **Fallback/reference**: Chronology is still fetched for release dates and historical cross-checks

### Family Elements and Traits (Additive)

Family-level `elements` and `traits` are the UNION across all variants. Example: Linus's base form is
`[ICE]` while Prince/King/Emperor Linus are `[ICE][SHR]`, so the family exposes both. Per-variant
`traits` are stored on each `LevelVariant` to scope element/trait pills on detail pages to the
selected variant. The card gallery shows the family-level union.

`Pirate Monkey` is the pets reference itemfamily for the shared variant-label policy. Its current
variant labels are intentionally correct and should be preserved when changing pet family parsing:
named/base branches, same-level access branches, and access-only branches should all follow the shared
`formatVariantNameWithAccess` grammar documented in `ui_patterns.md`.

### Attack Images

Pet attack image links should be retained when the forum hotlinks attack labels (for example Goldfish
Knight's `Attack Type 1` / `Attack Type 2`). Combined attack labels such as `Attack Type 1 / 1.1`
should inherit images from matching sublabels, and sparse family variants should inherit attack images
from siblings with the same attack name and description. Attack image URL parsing must allow
apostrophes inside quoted DF-Pedia URLs, such as `Ostara'sDracobunny-AttackType1.0.png`. Detail pages
must keep attack images hidden by default behind an explicit image toggle, after the attack
description, rate strip, and any attack-specific notes. Multi-image attacks should display each image
with its sub-attack caption when the label count matches the image count, such as `Attack Type 1` and
`Attack Type 1.1`. Pet attack rates in `(Rate: X)` / `[Rate: X]` text use the same shared metric-strip
display as weapon specials, with the rate removed from the prose. Use the shared expandable image list
when extending this pattern to guest appearances, trinket skills, and weapon specials.

### `<Dragon>` Pet Skills (special case)

`<Dragon>` pet skills are a targeted scraper special case. Only the current
`Pet Dragon Skills (2019-Present)` block is parsed; retired 2015-2019 and 2007-2015 skill sections are
ignored and must not mark the pet retired. Dragon skill cooldowns are stored on the attack and
rendered through the same metric strip as rates. The Noxious Fumes images are stage-specific and use
the explicit `Dragon-Stun-{Baby|Toddler|Kid}1.0/1.1.png` DF-Pedia URLs when the forum's combined
appearance label cannot be split into normal hotlinks.

### Guest Workflow

1. `npm run scrape:guests` — scrapes forum data (descriptions, attacks, DA/DC/DM/categories, source
   URLs from direct reply posts, release dates from Chronology)
2. `npm run images:guests` — adds DF-Pedia GitHub image URLs for guests (auto-uses Python venv)
   - Searches for images BEFORE "Appearance" section
   - Skips button/attack images (anything with "Button", "Attack.png" in URL)
   - Not all guests have images on forum — broken images show fallback UI

Guest portrait matching allows `pic`/`Petpic` suffixes (e.g. `Princesspic.png`). Attack-appearance
hyperlinks in the image fallback branch are NOT harvested as character alternative images.

### Local A/C guest CharPage capture

- Guest entries tagged `A/C` can sometimes link only to old DragonFable character pages that render
  through Flash/Ruffle instead of exposing a normal image URL.
- Normal guest scrapes still collect all standard forum data and ordinary image URLs, but they do not
  open Ruffle/Playwright for CharPage screenshots. If a generated CharPage PNG already exists, the
  scraper reuses it quickly; otherwise the entry remains missing an image.
- Add `--capture-charpages` together with `--name`/`--names` to explicitly run the slow local-only
  capture for named missing-image `A/C` guests when a DragonFable character-page link is present in
  the forum post.
- Captured PNGs are written to `public/generated/guests/charpages/{guest-slug}.png` and the scraper
  stores the public path in `guests.json`.
- This is not production runtime logic; the live app only serves the captured static image.
- One-time local setup after installing dependencies: `npx playwright install chromium`.
- Recommended local refresh command: `npm run scrape:guests -- --fresh --concurrency=1`.
- Recommended targeted capture command:
  `npm run scrape:guests -- --names="Cranix|Dain Lorilann|Elgert|Mennace|Xor Vrailin II" --fresh --concurrency=1 --capture-charpages`.
- If Ruffle changes or the CDN is unavailable, set `RUFFLE_SCRIPT_URL` to a local/self-hosted Ruffle
  script URL before running the scraper.

### `<Dragon>` guest special case

- `<Dragon>` guest is sourced from `https://forums2.battleon.com/f/tm.asp?m=16130782`, but the current
  A-Z guest list does not expose a canonical `guest-dragon` row. The guest scraper injects a synthetic
  `guest-dragon` stub so full and targeted guest scrapes keep this as its own guest itemfamily.
- Variant posts: `16130782` = Toddler, `22231249` = Kid, `22231251` = Dragon of Doom. Skill posts:
  `22231250` = current Toddler/Kid skills, `22231252` = Dragon of Doom skills. Shared notes come from
  the thread's final Other Information post.
- Guest attack appearance parsing supports multiple appearance images per skill through
  `appearanceUrls`, displayed behind the existing collapsed attack panels.

### Multi-Variant Detection (Sprint 5)

Sprint 5 adds support for multi-variant pets (like Goldfish Knight I-VII). See
`.kiro/specs/multi-variant-items/SPRINT5_GUIDE.md` for detailed implementation instructions.
Status: IN PROGRESS. Current scraper outputs single-variant Pet objects; multi-variant detection will
output ItemFamily objects for pets with multiple levels/obtain methods.

---

## Accessories

### Consolidation Defaults

Accessory consolidation defaults to keeping same-thread or explicitly connected level/access variants
together as one item family. Split related accessories into separate entries only when they are
meaningfully different items and the forum relationship should be represented as `Also See` instead of
a selector. Example: Necromancer Cape and Necromancer Cloak are separate entries with mutual Also See
links, while same-name level/DC branches normally remain one family with clear variant labels.

### Helm Split Exceptions

Some helm families are intentionally split even when they are same-thread or explicitly linked,
because mixing Roman/numeric progressions with named sibling items makes the selector harder to read.
These are handled as hardcoded accessory post-processing exceptions and linked back together through
`Also See`: Baron Cat Mask / Fierce Baron Cat Mask, Dravir Warhelm / Radiant Dravir Warhelm, Greedy
Greedling Helm / Super Greedy Greedling Helm, Royal Doom / Retroclear Royal Doom, and Tyrant Hood /
Magical Tyrant Hood.

Before promoting that split rule broadly, audit all family-capable datasets for mixed progression
labels (Roman/numeric levels plus named siblings) and spot check candidates with the user. Do not
auto-split broad candidates without review, because some mixed labels are intentional progression
names. Separately, Shocking Hair is a cross-post helm family that consolidates Shocking Hair,
Shockingly Good/Nice/Swiped/Amazing/Fantastic/Awesome Hair; Electric Hair stays standalone and links
through `Also See`.

### Trinket Skill Effect Types

Accessory scraper runs for trinkets and ability-bearing artifacts should enrich parsed trinket skills
with `trinketSkillEffectTypes` from the forum effect index (`A-Z Trinket Skills`). Render these as
`Effect Type(s): ...` on detail pages only, below the description/release-date area. This applies to
artifact entries that behave like trinkets (for example Dragon's Bulwark-style entries) as well as the
trinket subtype itself.

Linked trinket-skill posts may contain one rich shared skill block plus thinner requirement-specific
blocks for multiple trinkets using the same ability. Example: `Beacon of Hope (Trinket Skill)` serves
both `Beacon of Hope` and `Pillar of Light`; the Pillar-specific block carries the correct
requirement, while the Beacon block carries the complete mechanics and media. When multiple parsed
skill blocks share the same skill name, keep the requirement-specific match for the current trinket
but inherit missing effect text, mana/cooldown/type/element, button image, appearance image(s), and
notes from the richest sibling block.

### Multi-post families and supplemental posts

For multi-post accessory families, trailing posts that contain no item data (e.g. a shared
"Other information" + credits post) are checked for supplemental notes and armor customization, which
are applied as shared family data.

### Armor Customization parsing

Parse `armorCustomization` from the `notes` ("Other information") section first, then fall back to the
description, then the full normalized text. Feeding a concatenated blob of all three causes regex
over-matching and produces a long garbage `appearance` string. Correct results look like
`{ appearance: 'Mortis', modifies: 'DoomKnight' }`, not the whole sentence.

### DA scoping on DC variants

Section-level DA is only applied to non-DC obtain methods. When a post has a DA-tagged base variant
and a non-DA DC variant (e.g. Carved Dragon Scale II-V, Navigator's Hat II-VI), the DA tag must not
stamp the DC method. DC methods keep their own per-block detection, and a genuinely DA-required DC
variant (e.g. Plushie Artix, where the forum places DA before both title blocks) is preserved.

---

## Weapons

### Multi-Variant Consolidation

Weapon families follow the same base/DC split pattern as Pets and Accessories:

- **Base + DC access branches** (e.g. Abyssal Elf Scepter): kept as separate same-level variants
  (`I` / `I (DC)`), each with its own obtain method. The DC variant gets `dcRequired: true`.
- **Multiple non-DC methods** at the same level (e.g. 13th Staff level 13: Undead Slayer Store for
  Gold + The Stakeout for free): consolidated into ONE variant with multiple `obtainVariants`
  (rendered as Method 1/2). Notes are scoped per-level.
- **Single-level threads with base + DC** (e.g. `|` weapon): become a family with `(Base)` and `(DC)`
  variant labels.
- **Default weapons** are identified by source/forum titles containing a parenthetical default marker
  such as `(Rogue Default)` or `(Shadow Rogue Default)`. They get `isDefault: true`, a `default` tag,
  and must not be consolidated with other default weapons even when names/descriptions are similar.
  Example: `Dagger (Rogue Default)` and `Shadowdagger (Shadow Rogue Default)` stay separate. The
  current hardcoded exception is `Longsword (ArchKnight Default)`, which may consolidate the closely
  related bare `Longsword` posts into one family.

The scraper detects families structurally (multiple title blocks across posts) — no name-based gate
like `(I-VIII)` or `(All Versions)` is required.

Explicitly linked `Minor`/`Major` weapon pairs may consolidate under the shared base name only when
removing the rank prefix leaves the exact same normalized title. Example: `Minor Sunsabre` +
`Major Sunsabre` become the `Sunsabre` family with `Minor`/`Major` variants. Do not apply this to
loose single-word suffix matches where the base titles differ, such as `Minor Bronze Blade` /
`Major Bronzed Blade`.

### Mixed Variant Group Splits (weapon families)

Some weapon threads mix fundamentally different variant groups inside one forum family. In those
cases, split the data into separate item families and connect them through `Also See` rather than
showing one selector with Roman/level variants mixed with named variants. Current targeted split sets
include:

- Batwing Blade/Broom/Hatchet progression variants split from their `Dark` variants.
- Wavecrest, High Tide, and Deluge Roman/base progressions split from named variants such as `Missed`,
  `Lost`, `Stray`, and `Wayward`.
- Sea's Blessing/Favor/Bounty split into `'09`, `'10`, and modern progressions.
- Amaterasu/Tsukuyomi progressions split from `Omikami`/`no-Mikoto`; Threadcutter/Time's Harvest split
  `Alpha` from Roman progressions; The Massive Axe splits `XL` from `I-IV`.
- Fidelitas/Decus/Ferocitas split into three sibling families each: the `Fourth of July Rares` `I-V`
  progression, the named `Rufus`/`Albus`/`Azureus`/`Aurus` family, and the `Fourth of July Weapons`
  `I-VIII` progression. Keep these as hardcoded split exceptions because the two Roman groups reuse
  the same source titles and differ by obtain era.

Weapon targeted refreshes support `--fresh`; use it when the selected family should replace existing
local entries and aliases instead of merging into them. The fresh matcher intentionally preserves
explicit named parenthetical siblings, so refreshing `Wavecrest (I-V)` does not delete
`Wavecrest (Missed, Lost, Stray, Wayward)`.

Weapon specials can be refreshed without a full weapon scrape by using the current JSON as the target
list: `npm run scrape:weapons -- --special-only --fresh --concurrency=1`. This collects every source
post for existing special-bearing entries/families before scraping, so cross-post families such as the
Destiny weapons stay intact. For a narrower pass, `--missing-special-images-only` may be combined with
`--special-only` to skip entries that already have `specialImageUrls`.

### Special Classification Exceptions

- **CorDemi Codex** (`Basic CorDemiCodex`, `Advanced CorDemi Codex`, `Master CorDemi Codex`) is
  canonicalized under `sword-axe-mace` only. Although the weapon can switch into sword, dagger, and
  staff forms, the key form acts as a Sword and damage type is locked to Melee. Staff/dagger scraper
  runs must skip CorDemi stubs rather than duplicating the family into those subtype datasets.

### Deleted index links

Weapon index navigation links such as `(A-G)` and `(A-J)` are ignored before scraping; they are not
item entries. Deleted/moved posts return HTTP 500 and are skipped gracefully.

---

## Housing

Housing follows the Accessories/Weapons subtype-page template with a single-select subtype segment so
only one subtype dataset lazy-loads at a time. Current subtypes are Houses, Backgrounds, Floors, Rugs,
Shrubs, Stuff, and Wall Items. All Housing entries are Dragon Amulet content by default; show this as
a subtle gallery-level note and a detail-page access pill rather than forcing a redundant filter.

Housing filters are category-wide for now: Level 1 shows `Multiple Versions` and `DC`; Level 2 shows
data-driven `Effect`, `Rare`, `Seasonal`, and `Retired`. Do not show `Free` unless a Housing subtype
later proves to contain genuinely free entries.

The Housing scraper (`npm run scrape:housing -- --subtype=house`, with optional `--limit` for samples,
`--names` for scoped refreshes, and `--fresh` for replacing the selected subtype file) parses A-Z
listing entries and enriches detail posts with description, main/alternative images, obtain methods,
price/sellback, rarity, capacity, furnishing slot counts, effect text, Housing effect type, explicit
Also See links, and Other Information. Housing effect types come from the forum's
`House Items Sorted by Effects` post (`fb.asp?m=21302559`). Only the bold/underlined section heading
is used as the compact type, such as `Effect Type: Heal`; the larger `Effect` card still renders the
item-specific effect text scraped from the item's own post. A Housing item may have item-specific
effect text without an `effectType`; do not infer one from the effect prose. Ignore one-letter A-Z
anchors in the sorted effects post, since those are navigation headings rather than effect types. Normal
full subtype runs are additive by slug and merge into the existing subtype JSON; `--limit` runs stay
dry-run unless `--fresh` is explicitly passed. Scoped `--names` refreshes replace only matching
names/aliases before adding refreshed entries, so they are safe for narrow repair passes. This
additive-by-default, fresh-by-selected-scope model should be the default scraper design for current
and future categories, adapted to each category's safe merge scope. Same-thread multi-post house
entries such as `Gothic Style` / `Gothic Style II` become item families with
variant-specific images and details; variant labels should use the shared compact form, e.g. `(Base)`
and `II`, while source links retain full forum titles. Other Information belongs on the variant whose
post contains it; only standalone trailing posts with no item title are shared across variants.
Printable forum pages may return 500 for some duplicate listing links; fall back to the direct forum
post before keeping a listing-only entry.

Housing furnishings from Rugs onward may have `Effect:` text. Render the effect in its own detail card
below the image section. Use the label `Effect` for the filter pill, compact effect-type metadata
line, and detail card heading; do not repeat it as a card-gallery/status pill because it is Level 2
filter metadata. Effect quote blocks must preserve forum quote structure instead of flattening into
comma-separated prose. Keep Also See below Sources using the shared related-card treatment. Housing
can infer Also See across subtypes through the shared related-item hook when names and obtain methods
are close, but must not consolidate entries across different housing subtypes. Within the same
Housing subtype only, exact Left/Right pairs may consolidate into a single family when their
normalized names match: `X Left` / `X Right`, `Left X` / `Right X`, middle-token pairs, `X L` /
`X R`, and `Lefthand X` / `Righthand X`. The family name drops the side token and variants retain
the forum side label (`Left`, `Right`, `L`, `R`, `Lefthand`, `Righthand`). If one forum thread
contains different item types (for example
`Inn at the Edge of Time Portal (Indoors)` as Stuff and `(Outside)` as Shrub), split them into
separate subtype entries and link via Also See. Known forum listing/detail classification mismatches
should be kept as scoped Housing overrides; current overrides place `Light Bowl` and
`Mysterious Candle` under Wall Items.

Housing scraper writes must update `src/data/housing-manifest.json` automatically. Use `--limit` for
small parser samples before running a full subtype scrape.

---

## Classes / Abilities

Classes / Abilities follows the subtype-page template used by Accessories, Weapons, and Housing. The
top-level subtype segment is single-select: `Classes` and `Consumables`, in that order. The home-page
and subtype-page descriptions are sourced from the forum wording: "All the different stats /
abilities for the different classes in DragonFable. Pirates, Paladins, Chickencow Lords, and more!"

The Classes subtype has an extra multi-select sub-subtype filter level before normal access filters:
`Armors`, `Regular`, and `Miscellaneous`. `Miscellaneous` can additionally expose a data-driven
`Special Character` filter when Alexander/Archknight-style special-character tags are present. The
next levels are the shared access filters (`Multiple Versions`, `DA Required`, `Merge Required`,
`DC`) and the shared category filters (`Temp`, `Rare`, `Seasonal`, `Special Offer`, `Retired`).

`Armors` are obtainable inventory items, not the playable class encyclopedia pages themselves. An
armor entry should parse and display `Equips Class: <class>` from the forum detail page, with the
forum link preserved when present. Example: `Chaosweaver Armor` equips the `Chaosweaver` class, while
`Aspenvale Academy Uniform` equips `Student`. Do not consolidate armor items with their corresponding
Regular/Miscellaneous class pages. Armors do not require main images, but they still use the shared
detail order: description, compact `Equips Class:` line, variant selector when needed, rarity, How to
Obtain, Other Information, Sources, then Also See. `Dimensional Transphaser` is a special case only in
content, not parser shape: its equipped class link text is literally `|`, and that must remain a
valid display/search value.

The Consumables subtype uses shared access filters, then shared category filters, then a separate
data-driven kind filter row: `Dust`, `Food`, and `Rune`. Consumables are Temp by default except
`Health Potion` and `Mana Potion`; show this as a subtle page-level note, similar to Housing's Dragon
Amulet note, but do not show a Temp pill on current Consumable gallery cards or detail headers.
Normal Consumables do not require main images. Health Potion and Mana Potion are supplemental
non-A-Z entries with potion skill/effect display data, including button and Appearance images. Their
button images are deterministic DF-Pedia assets (`Skill-HP.png` and `Skill-MP.png`) because the
forum posts expose a generic inline image before the actual skill button.

Consumable detail pages should reuse the shared item-family/detail order: selector when needed, image
when present, level/rarity metrics, How to Obtain cards, Dialogue when present, Other Information,
Sources, then Also See.
Optional Consumable `Dialogue` snippets are parsed from text between `Level:` and `Effect:` /
`Effects:` and render in their own card before Other Information. Preserve prompt/context lines as
normal note bullets and render dialogue text in quote boxes; strip repeated item-title prompt labels
and `OK` button lines. Do not emit a generic inner `Dialogue` bullet when the card title already
provides that label. The `Effect` card is item-specific effect text, follows Housing's effect-card
treatment. Family-level effect text should be stored and rendered as shared unless variants have
distinct explicit effects. Consumable effect types come from
the sorted effects page (`fb.asp?m=22304644`); only bold/underlined section headings such as `STR`,
`DEX`, `Boost`, `All Resist`, and `Utility` are stored as the compact `Effect Type:` label. Ignore
page-structure headings like `Contents`, `Legend`, and A-Z navigation headings, and leave
`effectType` unset for consumables not listed under an effect heading. Only Health Potion and Mana
Potion render their effect in the shared attack-style accordion so their skill image and Appearance
image can stay with the effect; all other Consumables use the plain `Effect` card even if scraped data
contains image metadata. Do not duplicate the potion description inside that accordion; the top-level
description already carries it. Hotlinked `Appearance` labels are media captions and should not be
retained as Other Information. How to Obtain cards should suppress the
price/sellback grid when all methods are `N/A` or empty, but must still show real prices when present
such as `Instant Pierogi`. Consumables are always level `1`; omit level from Consumable detail pages
and show only the standalone `Rarity` chip before How to Obtain. Consumables also should not show an
`Effect` pill on gallery cards because effects are expected for the subtype.

The starter scraper is `npm run scrape:classes -- --subtype=consumable --fresh`. It reads the
Consumables A-Z listing (`fb.asp?m=22304639`), appends the supplemental Health Potion (`m=4159197`)
and Mana Potion (`m=4159198`) entries under H/M, and follows linked detail posts. It is additive by
default, `--limit` is a dry-run unless paired with `--fresh`, and successful writes update
`src/data/class-consumables.json` plus `src/data/class-abilities-manifest.json`. The Classes subtype
parser is intentionally not implemented yet. The Consumables listing includes non-entry anchors
`Alphabetical Consumables Listing` and `Consumables Sorted by Effects`; scrapers must skip them. The
A-Z listing prefixes `[D]`, `[F]`, and `[R]` drive the L3 `Dust`, `Food`, and `Rune` kind filters,
with individual post `Item Type: Dust/Food/Rune` as the fallback verification source. Effects may be
labelled `Effect:` or `Effects:` and must be parsed from the item detail block. Seasonal detection
comes from listing tag images/labels, listing text such as `Seasonal`, and detail-post tag images
such as `http://media.artix.com/encyc/df/tags/Seasonal.jpg`. Normalize tag filenames, `alt`, and
`title` text before matching `seasonal`, holiday, Frostval, Mogloween, Hero's Heart, and
Friday-the-13th tags.

Consumable listing pages can link both the base and `+` entry for the same two-variant family, e.g.
`Fried Zard Legs` and `Fried Zard Legs+`. Scraper output should dedupe by slug and prefer the
non-`+` display family while retaining both `(Base)` and `+` variants inside that family. Same-name
same-level variants that differ by Defender's Medal requirements should label the medal variant with
`(DM)`; pure Defender's Medal `Required Items` entries are DM methods, not Merge Required methods. If
both methods are in one forum post, trailing Other Information belongs at the shared family level.
Consumables use the shared related-items hook for explicit/reverse `Also See` plus conservative
same-subtype inferred links from matching obtain fingerprints and near-identical names.

The initial Classes subtype scraper path implements the `Armors` sub-subtype from
`fb.asp?m=22303582`. Use `--subtype=class --class-subcategory=armor` for that dataset. `--letters=`
is supported for user-run letter batches, `--url=` / `--urls=` supports targeted post refreshes, and
`--limit` remains a parser dry run unless paired with `--fresh`. Armor listing parsing must anchor to
the actual Armors post body (`Physical armors that can be stored...`) and stop before the Regular
Classes section; do not scrape Regular or Miscellaneous class detail pages when
`--class-subcategory=armor` is selected. Direct URL armor scrapes should prefer the forum page title
for display-family construction so parenthetical-family posts such as
`Gnomish Personal Steamtank (Vr 1.0, Mk II)` retain that family name while variants render as
`Vr 1.0` and `Mk II`. `DoomKnight Armor` and `DoomKnight Variant One` are a known armor exception:
fold them into one `DoomKnight (Armor, Variant One)` family with `Armor` and `Variant One` variants
while keeping their original source titles. Shadow armor pairs fold the modern and Ancient entries
into one base display family: `Shadow Mage/Rogue/Warrior Armor` with `(Base)` and `Ancient` variants.
Reforged time-class armors fold into their base family with `(Base)` and `Reforged` variants, e.g.
`Chronocorruptor` + `Reforged Chronocorruptor` display as `Chronocorruptor`; `Chronomancer Armor` +
`Reforged Chronomancer` display as `Chronomancer Armor`. `Epoch` remains standalone unless a Reforged
armor counterpart appears. ChickenCow armor posts are mixed-access single-post families: `ChickenCow
Armor` renders its scraped level and level-plus-DC label (`1` and `1 (DC)` in the current source)
because the same level entry repeats; `Evolved ChickenCow Armor` renders `(DA)`, `(DA, DC)`, and `(DC)` because access alone distinguishes the variants;
`Ascended ChickenCow Armor` renders `(DA)` and `(DC)`. For those posts, method-level
price/required-item semantics override page-level DA/DC tag bleed. `Epoch` price parsing also repairs
the forum strikethrough artifact that can drop the closing `)` from `(Standard)`. Consolidated armor
families may claim legacy/source slugs as aliases; if a stale or duplicate primary entry has a slug
already claimed by another entry's `aliasSlugs`, drop the stale primary during scraper normalization.
Regular and Miscellaneous class-page parsing are intentionally still pending. Status tags come from
forum tag images when present; the Classes A-Z listings also use text parentheticals such as
`S-Offer`, which should be treated as the row-level fallback for `Special Offer`.
