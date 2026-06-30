"""
Patches badges.json with proper subcategories from the A-Z Badges sorted list.
Data sourced from: https://forums2.battleon.com/f/tm.asp?m=22304590 (Badges Sorted by Category post)
"""
import json
from pathlib import Path

path = Path(__file__).resolve().parent.parent / 'src/data/badges.json'
badges = json.loads(path.read_text())

# Subcategory assignments from the forum's "Badges Sorted by Category" post
# Format: badge_name -> subcategory_label
SUBCATEGORY_MAP = {
    # ── Quests Badges ─────────────────────────────────────────────────────────
    # Early Days
    'Starting Out':          'Early Days',
    'The Priestess':         'Early Days',
    'More Boxes!':           'Early Days',
    'Hydra Slayer':          'Early Days',
    'Egg-cellent!':          'Early Days',
    'Baby Dragon':           'Early Days',
    'Dragon School':         'Early Days',
    'Hugs for DoomKittens':  'Early Days',
    '+1 Pyronomicon':        'Early Days',
    'Death of a Knight':     'Early Days',
    'Locksmith':             'Early Days',
    # Book 1 & 2
    'Walk Through Fire':     'Book 1 & 2',
    'Confront Sek-Duat':     'Book 1 & 2',
    "Arr' Captain's Orders": 'Book 1 & 2',
    'Orb Extractor':         'Book 1 & 2',
    'Cold as Ice':           'Book 1 & 2',
    'Shocking!':             'Book 1 & 2',
    'Burning Revenge':       'Book 1 & 2',
    'Water You Doing?':      'Book 1 & 2',
    'EnTropic!':             'Book 1 & 2',
    'Final 13th!':           'Book 1 & 2',
    'Fallen General':        'Book 1 & 2',
    'Avatar Ender':          'Book 1 & 2',
    'Crystal Breaker':       'Book 1 & 2',
    'Fire Fighter':          'Book 1 & 2',
    # Book 3
    'A Hero is Thawed':      'Book 3',
    'Sands of Eternity':     'Book 3',
    'Siege of Haven':        'Book 3',
    'Hopeless':              'Book 3',
    'Tournament Champion':   'Book 3',
    'Sailor of the Seas':    'Book 3',
    "Star's Descendant":     'Book 3',
    'An Uneasy Alliance':    'Book 3',
    'Storm in the Night':    'Book 3',
    'Fungus Among Us':       'Book 3',
    'Convergence':           'Book 3',
    'The End of Magic':      'Book 3',
    # Side Quests
    'Cutest Legion EVER':    'Side Quests',
    'Monkee Business':       'Side Quests',
    'Heart of Darkness':     'Side Quests',
    'Special Delivery':      'Side Quests',
    'The Mystery is Afoot!': 'Side Quests',
    'Nose for Trouble':      'Side Quests',
    'Quadforce':             'Side Quests',
    'Mollo Destruction':     'Side Quests',
    'Elemental Chaos':       'Side Quests',
    'Void Magic':            'Side Quests',
    'Secrets of Bacon!':     'Side Quests',
    'Amityvale Defender':    'Side Quests',
    "A'maze'n":              'Side Quests',
    'Wanderer':              'Side Quests',
    'For SCIENCE!':          'Side Quests',
    'Face-Off!':             'Side Quests',
    'Weave With Me!':        'Side Quests',
    'The ArchKnight':        'Side Quests',
    'Blood & Roses':         'Side Quests',
    'Weave Without Me!':     'Side Quests',
    'First Weaver':          'Side Quests',
    'Nest Defended':         'Side Quests',
    'Thorns':                'Side Quests',
    'Fear Engine':           'Side Quests',
    'Gathering Shadows':     'Side Quests',
    'Calamity':              'Side Quests',
    'Maleurous':             'Side Quests',
    # ── Classes Badges ────────────────────────────────────────────────────────
    # Trained
    'DragonRider':           'Trained Classes',
    'Primalized':            'Trained Classes',
    'DragonLord':            'Trained Classes',
    'Base Armor':            'Trained Classes',
    'Pirate':                'Trained Classes',
    'Ninja':                 'Trained Classes',
    'Ranger':                'Trained Classes',
    'DragonSlayer':          'Trained Classes',
    'Paladin':               'Trained Classes',
    'Necromancer':           'Trained Classes',
    'DeathKnight':           'Trained Classes',
    'Worthy':                'Trained Classes',
    'SoulWeaver':            'Trained Classes',
    'Technomancer':          'Trained Classes',
    'PumpkinLord':           'Trained Classes',
    'Evolved PumpkinLord':   'Trained Classes',
    'Frost Moglin':          'Trained Classes',
    'TogSlayer':             'Trained Classes',
    'Shadow Hunter':         'Trained Classes',
    # Specials
    'DoomKnight':            'Special Classes',
    'Guardian':              'Special Classes',
    'Evolved ChickenCow':    'Special Classes',
    'Adept':                 'Special Classes',
    'GPS':                   'Special Classes',
    'Pyromancer':            'Special Classes',
    'enTropy':               'Special Classes',
    'Ascended ChickenCow':   'Special Classes',
    'Time Walker':           'Special Classes',
    'Icebound Revenant':     'Special Classes',
    'ChaosWeaver':           'Special Classes',
    # ── Challenges Badges ─────────────────────────────────────────────────────
    # Arena Challenges
    'Timetorn Veteran!':     'Arena Challenges',
    'Primordial Witness':    'Arena Challenges',
    'The Magnum Opus':       'Arena Challenges',
    'Ultimate Destiny':      'Arena Challenges',
    'Tog Nightmare':         'Arena Challenges',
    'Ascension':             'Arena Challenges',
    'CARNAX':                'Arena Challenges',
    'Unreal Doom':           'Arena Challenges',
    'Hope':                  'Arena Challenges',
    'A.A.R.G.H. Mastery':   'Arena Challenges',
    'The Balance':           'Arena Challenges',
    'Chaos Slayer':          'Arena Challenges',
    'Asynchronized':         'Arena Challenges',
    'HONK!':                 'Arena Challenges',
    # Skills
    'Health Potion Mastery': 'Skills',
    'Mana Potion Mastery':   'Skills',
    'Arachnalchemy Mastery': 'Skills',
    'Pet Training Mastery':  'Skills',
    'Blacksmith Mastery':    'Skills',
    'Gourmet':               'Skills',
    'Fishing Mastery':       'Skills',
    'DoomWood Fishing':      'Skills',
    'Dracolich Fishing':     'Skills',
    # ── Other Badges ──────────────────────────────────────────────────────────
    # PvP
    'PvP Brawler':           'PvP',
    'PvP Arena Fighter':     'PvP',
    'PvP Prize Fighter':     'PvP',
    'PvP Grandmaster':       'PvP',
    # HHD (Hero's Heart Day)
    '#1 Threat: Bears':      "Hero's Heart Day",
    'Bachelor PAR-TAY!':     "Hero's Heart Day",
    'Wrestling Champion!':   "Hero's Heart Day",
    # Mogloween
    "Mogloween '07 Masks":   'Mogloween',
    "Mogloween '08 Masks":   'Mogloween',
    "Mogloween '09 Masks":   'Mogloween',
    "Mogloween '10 Masks":   'Mogloween',
    "Mogloween '11 Masks":   'Mogloween',
    "Mogloween '12 Masks":   'Mogloween',
    "Mogloween '13 Masks":   'Mogloween',
    "Mogloween '14 Masks":   'Mogloween',
    "Mogloween '15 Masks":   'Mogloween',
    'Catastrophic Candy':    'Mogloween',
    'Resident: Sneevil':     'Mogloween',
    '48 Weeks Later':        'Mogloween',
    'List Completion':       'Mogloween',
    # Frostval
    'Icemaster':             'Frostval',
    'X-val!':                'Frostval',
    'Naughty List':          'Frostval',
    'Golem Breaker':         'Frostval',
    'Bad Toys':              'Frostval',
    'Merry Togsmas!':        'Frostval',
    'Frostvayle':            'Frostval',
    'Sugary Nightmare':      'Frostval',
    # Misc other
    'Fresh Warmonger':       'Warmonger',
    'Fierce Warmonger':      'Warmonger',
    'Battle Hewn Warmonger': 'Warmonger',
    'Home Owner':            'Misc',
    'Cookie Song!':          'Misc',
    # Retired quest badges — retired=True flag, not a subcategory
    'Information on Sepulchure': 'Misc',
    'Party On, Olaf!':       'Misc',
    'Grrrberus!':            'Misc',
    'EGG-STIR-MIN-ATE':      'Misc',
    'Wild Fighter':          'Misc',
    "Asander's Freedom":     'Misc',
    'I Spy':                 'Misc',
    'Breaking Awe':          'Misc',
    'Idle Heroes':           'Misc',
    'Evolved DragonLord':    'Misc',
    'Quick Buy!':            'Misc',
}

updated = 0
unmatched = []
for b in badges:
    sub = SUBCATEGORY_MAP.get(b['name'])
    if sub:
        b['subcategory'] = sub
        updated += 1
    else:
        unmatched.append(b['name'])

path.write_text(json.dumps(badges, indent=2, ensure_ascii=False) + '\n')
print(f'Updated: {updated}  Unmatched: {len(unmatched)}')
if unmatched:
    print('Unmatched:', unmatched)
