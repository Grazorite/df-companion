#!/usr/bin/env python3
"""
Add pet images from DF-Pedia GitHub to pets.json

This script adds imageUrl fields to pets that don't have images by checking
the DF-Pedia GitHub repository for matching filenames.

Expected filename format: PetName.png (no spaces, alphanumeric only)
Example: "Emperor Linus" → "EmperorLinus.png"

Usage:
    python3 scripts/add_pet_images.py
"""

import json
import re
from pathlib import Path

PETS_JSON = Path(__file__).parent.parent / 'src' / 'data' / 'pets.json'
GITHUB_BASE = 'https://github.com/DF-Pedia/DF-Pedia/raw/master/pets_guests'


def name_to_filename(name: str) -> str:
    """Convert pet name to expected DF-Pedia filename."""
    # Remove level range suffixes like (I-VI) or (All Versions)
    name = re.sub(r'\s*\([IVX]+-[IVX]+\)\s*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\(All Versions\)\s*$', '', name, flags=re.IGNORECASE)
    
    # Remove all non-alphanumeric chars except spaces, then remove spaces
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', name)
    clean = clean.replace(' ', '')
    return f"{clean}.png"


def main():
    print('🖼️  Adding DF-Pedia images to pets.json')
    print('─' * 50)
    
    with open(PETS_JSON, 'r', encoding='utf-8') as f:
        pets = json.load(f)
    
    added = 0
    updated = 0
    skipped = 0
    
    for pet in pets:
        # Check if this is an ItemFamily (multi-variant)
        is_family = 'levelVariants' in pet and 'familyName' in pet
        
        if is_family:
            # ItemFamily: check shared.imageUrl
            if 'shared' not in pet or not isinstance(pet['shared'], dict):
                print(f"  ⚠️  ItemFamily '{pet.get('familyName', 'unknown')}' has no shared object")
                skipped += 1
                continue
            
            family_name = pet['familyName']
            filename = name_to_filename(family_name)
            github_url = f"{GITHUB_BASE}/{filename}"
            
            # Only add if no imageUrl exists in shared
            if 'imageUrl' not in pet['shared'] or not pet['shared']['imageUrl']:
                pet['shared']['imageUrl'] = github_url
                added += 1
            # Update if current imageUrl is the same GitHub pattern
            elif pet['shared']['imageUrl'].startswith(GITHUB_BASE):
                pet['shared']['imageUrl'] = github_url
                updated += 1
        else:
            # Regular Pet: check top-level imageUrl
            filename = name_to_filename(pet['name'])
            github_url = f"{GITHUB_BASE}/{filename}"
            
            # Only add if no imageUrl exists
            if 'imageUrl' not in pet or not pet['imageUrl']:
                pet['imageUrl'] = github_url
                added += 1
            # Update if current imageUrl is the same GitHub pattern (to refresh)
            elif pet['imageUrl'].startswith(GITHUB_BASE):
                pet['imageUrl'] = github_url
                updated += 1
    
    # Write back
    with open(PETS_JSON, 'w', encoding='utf-8') as f:
        json.dump(pets, f, indent=2, ensure_ascii=False)
        f.write('\n')
    
    print(f'✅ Added {added} new image URLs')
    print(f'🔄 Updated {updated} existing DF-Pedia URLs')
    if skipped > 0:
        print(f'⚠️  Skipped {skipped} entries (malformed ItemFamily)')
    print(f'📁 Total pets: {len(pets)}')
    print(f'\n💡 Note: Not all images exist on GitHub — broken images will show fallback UI')


if __name__ == '__main__':
    main()
