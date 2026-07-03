# BabyWeaver "Other Information" Notes Truncation Issue

**Status**: DEFERRED

**Date**: July 3, 2026

## Problem Description

BabyWeaver's "Other Information" notes are being truncated during scraping:

**Expected** (from forum):
- Level III: `Pet's name is erroneously called 'Baby Weaver III' instead of 'BabyWeaver III'.` (81 chars)
- Level VI: `Pet's name is erroneously called 'BabyWeaverVI' instead of 'BabyWeaver VI'.` (similar length)

**Actual** (in pets.json):
- Truncated at: `Pet's name is erroneously called '` (36 chars)

**Forum thread**: https://forums2.battleon.com/f/tm.asp?m=18663749

## Root Cause Analysis

### Investigation Steps Taken

1. ✅ **Verified forum HTML is correct** - Used `grep` to confirm full text exists in raw HTML with proper `<li>` tags
2. ✅ **Tested `stripHtml` function in isolation** - Works correctly, outputs full 81 characters
3. ✅ **Tested line splitting** - Works correctly
4. ✅ **Added timestamp removal regex** - Added `<font color='#eeeeee'>` tag removal, works in isolation
5. ✅ **Identified truncation point** - The raw `line` variable in notes processing is already 36 chars, meaning truncation happens before `stripHtml` or during section boundary extraction

### Root Cause

**Section boundary logic cuts off "Other Information" content**

For multi-variant items (BabyWeaver I-VI), the scraper splits the forum HTML into sections by searching for level headings ("BabyWeaver I", "BabyWeaver III", etc.). The section boundaries are determined at lines 788-810 in `scripts/scrape-pets.ts`.

**The Problem**: "Other Information" sections appear AFTER each level's stats but BEFORE the next level heading. When we use `nextSection.startIndex` as the end boundary, we cut off exactly where the next heading begins, excluding the "Other Information" content.

Debug output confirms:
```
=== SECTION BOUNDARY DEBUG [BabyWeaver III] ===
Has "Other information": true
Has "erroneously called": true
Other information snippet: Other information</u></b> <br> <li>Pet's name is erroneously called '
```

The `<li>` tag content is incomplete in the extracted section HTML.

## Attempted Fixes

### Attempt 1: Extend section boundaries to include "Other information"
**File**: `scripts/scrape-pets.ts` lines 788-810

**Approach**: Modified section boundary logic to search for "Other information" sections between level headings and extend the end boundary to include them.

**Code**:
```typescript
const searchSpace = html.slice(section.startIndex, nextSection.startIndex)
const otherInfoStart = searchSpace.search(/Other information/i)

if (otherInfoStart >= 0) {
  const afterOtherInfo = searchSpace.slice(otherInfoStart)
  const contentMatch = afterOtherInfo.match(/Other information[\s\S]*?(?:<br>\s*<br>|$)/i)
  
  if (contentMatch) {
    endIndex = section.startIndex + otherInfoStart + contentMatch[0].length
  }
}
```

**Result**: Section HTML now includes "Other information" heading, but `<li>` content is still truncated. The regex pattern ends too early or the HTML structure is more complex than expected.

## Why This Is Hard

1. **Unpredictable HTML structure**: Forum posts use inconsistent HTML patterns - `<br>` tags, nested `<li>` elements, inline `<font>` tags with timestamps
2. **Section boundary detection**: Roman numeral patterns with spacing variations ("BabyWeaver III" vs "BabyWeaverVI") make it hard to reliably find section boundaries
3. **Content interleaving**: "Other information" sections appear between level sections, not within them
4. **Regex limitations**: Using regex to parse HTML is fragile; need to match opening `<li>` through closing `</li>` while accounting for nested tags

## Possible Solutions (Not Yet Implemented)

### Option 1: Use a proper HTML parser
Replace regex-based section splitting with a DOM parser (e.g., `cheerio` or `jsdom`):
- Parse the full HTML into a DOM tree
- Find all level headings as anchor points
- Extract content between headings including all child nodes
- Would be more robust but adds dependency

### Option 2: Adjust regex to capture full `<li>` elements
Pattern: `/<li>.*?<\/li>/gis` to match complete list items
- Risk: May capture too much content if `</li>` tags are missing

### Option 3: Post-process shared notes
- Parse "Other information" sections at the thread level (after all sections) as `sharedNotes`
- Apply notes to specific levels based on content matching (e.g., "III" in text → BabyWeaver III)
- Requires additional logic to map notes to levels

### Option 4: Manual data curation
- For the small number of affected items (primarily BabyWeaver), manually add notes to `pets.json`
- Quick fix but doesn't solve the systemic issue

## Impact Assessment

**Severity**: Low
- Only affects a small number of multi-variant items with level-specific "Other information" notes
- Most pets don't have level-specific notes; they use shared notes at the thread level
- BabyWeaver appears to be one of the few affected items

**User Experience**:
- Notes are truncated but not completely missing
- Users can still click through to forum thread for full information

## Recommendation

**DEFER** this issue for now. Reasons:
1. Low impact - affects a small subset of items
2. High complexity - requires significant refactoring of section boundary logic or HTML parser integration
3. Workaround available - users can view full notes on forum
4. Other priorities - multi-variant detection, other content sections (Weapons, Accessories, etc.)

Revisit if:
- We discover this affects many more items than just BabyWeaver
- Users report confusion from truncated notes
- We refactor the scraper to use a proper HTML parser

## Debug Logging Added (To Be Removed)

**File**: `scripts/scrape-pets.ts`

1. Lines 809-823: Section boundary debug for BabyWeaver III/VI
2. Lines 1169-1175: HTML cleaning debug in `parsePetThread`
3. Lines 1440-1448: Notes parsing debug

**Cleanup command**:
Remove all debug logging blocks containing `BabyWeaver` checks before next release.

## Files Modified

- `scripts/scrape-pets.ts` - Section boundary logic + debug logging (lines 788-825, 1169-1175, 1440-1448)

## Related Issues

- Multi-variant detection (Sprint 5) - Section boundary logic is shared with this feature
- DA/DC detection fix (completed) - Fixed similar issue where tags were detected in wrong context
