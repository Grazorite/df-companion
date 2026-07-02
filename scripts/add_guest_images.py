#!/usr/bin/env python3
"""
Guest Image Scraper — Extract character images from forum posts

Guests have skill button images that should be excluded. This script:
1. Fetches each guest's forum page
2. Extracts character image (appears BEFORE "Appearance" section)
3. Skips skill buttons (contain "Button", "Attack.png" in URL)
4. Updates pets.json with imageUrl for guests only

USAGE:
  python3 scripts/add_guest_images.py

Requires: requests library (pip install requests)
"""

import json
import re
import os
import time
import sys

try:
    import requests
except ImportError:
    print("❌ Missing 'requests' library. Install with: pip install requests")
    sys.exit(1)

# ─── Config ───────────────────────────────────────────────────────────────────

PETS_JSON = os.path.join(os.path.dirname(__file__), '../src/data/pets.json')
DELAY_MS = 1000
FORUM_COOKIE = os.getenv('FORUM_COOKIE', '')

# ─── Load forum cookie from .env ──────────────────────────────────────────────

if not FORUM_COOKIE:
    env_path = os.path.join(os.path.dirname(__file__), '../.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                match = re.match(r'FORUM_COOKIE=["\'](.*?)["\']', line.strip())
                if match:
                    FORUM_COOKIE = match.group(1)
                    break

if not FORUM_COOKIE:
    print("⚠️  No FORUM_COOKIE found. Guest forum pages may not load correctly.")
    print("   Add FORUM_COOKIE to .env to scrape from protected forum threads.")

# ─── Helper functions ─────────────────────────────────────────────────────────

def fetch_page(url):
    """Fetch forum page with cookie auth"""
    headers = {
        'Cookie': FORUM_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
    }
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as e:
        print(f"   ❌ Error fetching {url}: {e}")
        return None

def extract_guest_image(html, guest_name):
    """
    Extract guest character image from forum post HTML.
    
    Strategy:
    - Only consider images BEFORE "Appearance" heading (skills come after)
    - Skip UI/tag/button images (Button, Attack.png, tags/, etc.)
    - Prefer images with imgur, DF-Pedia, or battleon.com/encyc domains
    - Try to match image filename with guest name (handles special characters)
    """
    # Find the "Appearance" heading position (skill buttons appear after this)
    appearance_match = re.search(r'<b>Appearance</b>', html, re.IGNORECASE)
    if appearance_match:
        # Only search for images BEFORE this point
        html_before_appearance = html[:appearance_match.start()]
    else:
        # No "Appearance" heading — use entire page but be cautious
        html_before_appearance = html
    
    # Extract all image tags before Appearance section
    img_tags = re.findall(r'<img[^>]+src=["\'](.*?)["\'][^>]*>', html_before_appearance, re.IGNORECASE)
    
    candidates = []
    for src in img_tags:
        # Skip UI/tag/button/attack images
        if any(skip in src.lower() for skip in [
            '/f/image/', 'forumheader', 'quantserve', 'artix.com/shared',
            'artixgamelaunch', '/tags/', 'clear.gif', 'blank.gif',
            'button', '-button', 'attack.png', 'attack.jpg'
        ]):
            continue
        
        # Prefer images from known good domains
        if any(domain in src.lower() for domain in [
            'imgur.com', 'i.imgur.com', 'battleon.com/encyc', 
            'artix.com/encyc', 'github.com', 'githubusercontent.com'
        ]):
            candidates.append(src)
        elif '/f/upfiles/' in src and len(src) > 60:
            # Forum uploads (long URLs are more likely to be content images)
            candidates.append(src)
    
    # Try to find best match based on guest name
    if candidates:
        # Normalize guest name for matching (remove special characters)
        normalized_name = re.sub(r'[^a-zA-Z0-9\s]', '', guest_name).lower()
        name_words = normalized_name.split()
        
        # Score each candidate by how many name words appear in URL
        scored = []
        for url in candidates:
            url_lower = url.lower()
            # Extract filename from URL
            filename = url_lower.split('/')[-1].replace('.png', '').replace('.jpg', '').replace('.jpeg', '')
            
            # Count matching words
            matches = sum(1 for word in name_words if len(word) > 2 and word in filename)
            scored.append((matches, url))
        
        # Sort by match count (descending), then by URL length (ascending for simpler names)
        scored.sort(key=lambda x: (-x[0], len(x[1])))
        
        if scored[0][0] > 0:  # At least one word matched
            return scored[0][1]
        else:
            # No name match, return first candidate
            return candidates[0]
    
    return None

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print('🖼️  Guest Image Scraper')
    print('─' * 50)
    
    # Load pets.json
    if not os.path.exists(PETS_JSON):
        print(f"❌ File not found: {PETS_JSON}")
        sys.exit(1)
    
    with open(PETS_JSON, 'r') as f:
        pets = json.load(f)
    
    # Filter to guests only
    guests = [p for p in pets if p.get('type') == 'guest']
    print(f"📊 Found {len(guests)} guests in pets.json")
    
    # Stats
    updated = 0
    skipped = 0
    errors = 0
    
    for i, guest in enumerate(guests):
        name = guest.get('name', 'Unknown')
        forum_url = guest.get('forumUrl')
        
        # Skip if already has image
        if guest.get('imageUrl'):
            print(f"[{i+1}/{len(guests)}] {name} — already has image, skipping")
            skipped += 1
            continue
        
        if not forum_url:
            print(f"[{i+1}/{len(guests)}] {name} — no forum URL, skipping")
            skipped += 1
            continue
        
        print(f"[{i+1}/{len(guests)}] {name}... ", end='', flush=True)
        
        # Fetch forum page
        html = fetch_page(forum_url)
        if not html:
            print("❌ fetch failed")
            errors += 1
            time.sleep(DELAY_MS / 1000)
            continue
        
        # Extract image
        image_url = extract_guest_image(html, name)
        if image_url:
            guest['imageUrl'] = image_url
            updated += 1
            print(f"✓ ({image_url[:60]}...)")
        else:
            print("⚠️  no image found")
            skipped += 1
        
        # Rate limit
        if i < len(guests) - 1:
            time.sleep(DELAY_MS / 1000)
    
    # Write updated pets.json
    with open(PETS_JSON, 'w') as f:
        json.dump(pets, f, indent=2)
        f.write('\n')
    
    print(f"\n✅ Done!")
    print(f"   Updated: {updated}")
    print(f"   Skipped: {skipped}")
    print(f"   Errors:  {errors}")
    print(f"\n📁 Updated pets.json written to {PETS_JSON}")

if __name__ == '__main__':
    main()
