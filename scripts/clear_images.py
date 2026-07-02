#!/usr/bin/env python3
"""
Clear image URLs from pets.json to force re-scraping

USAGE:
  python3 scripts/clear_images.py [--pets|--guests|--all]
"""

import json
import os
import sys

PETS_JSON = os.path.join(os.path.dirname(__file__), '../src/data/pets.json')

def clear_images(entry_type=None):
    """
    Remove imageUrl from entries
    
    Args:
        entry_type: 'pet', 'guest', or None (all)
    """
    with open(PETS_JSON, 'r') as f:
        pets = json.load(f)
    
    cleared = 0
    for pet in pets:
        # Skip if filtering by type
        if entry_type and pet.get('type') != entry_type:
            continue
        
        # Remove imageUrl if present
        if 'imageUrl' in pet:
            del pet['imageUrl']
            cleared += 1
    
    # Write back
    with open(PETS_JSON, 'w') as f:
        json.dump(pets, f, indent=2)
        f.write('\n')
    
    return cleared, len(pets)

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else '--all'
    
    if mode == '--pets':
        cleared, total = clear_images('pet')
        print(f'✅ Cleared {cleared} pet image URLs')
    elif mode == '--guests':
        cleared, total = clear_images('guest')
        print(f'✅ Cleared {cleared} guest image URLs')
    else:
        cleared, total = clear_images(None)
        print(f'✅ Cleared {cleared} image URLs from all {total} entries')
    
    print(f'📁 Updated {PETS_JSON}')
