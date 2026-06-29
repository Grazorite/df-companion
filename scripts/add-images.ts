/**
 * Adds imageUrl to each badge in badges.json by mapping badge names
 * to their filenames in the DF-Pedia GitHub repository.
 *
 * Also cleans up notes: strips edit timestamps and normalises bullet formatting.
 *
 * Run: npx tsx scripts/add-images.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const BADGES_PATH = path.resolve(import.meta.dirname, '../src/data/badges.json')
const DF_PEDIA_BASE = 'https://github.com/DF-Pedia/DF-Pedia/raw/master/badges'

// Map of badge name → exact filename in DF-Pedia repo (without base URL)
// Derived from the GitHub directory listing.
// Prefer .png over .jpg where both exist (png are higher quality).
const IMAGE_MAP: Record<string, string> = {
  '#1 Threat: Bears':          '#1-Threat-Bears.jpg',
  '+1 Pyronomicon':            '1-Pyronomicon.png',
  '48 Weeks Later':            '48WeeksLater.jpg',
  'A Hero is Thawed':          'AHeroisThawed.png',
  "A'maze'n":                  'A-maze-n.png',
  'A.A.R.G.H. Mastery':        'AARGHMastery.png',
  'Adept':                     'Adept.png',
  'Amityvale Defender':        'AmityvaleDefender.png',
  'An Uneasy Alliance':        'AnUneasyAlliance.png',
  'Arachnalchemy Mastery':     'ArachnalchemyMastery.png',
  "Arr' Captain's Orders":     "Arr'Captain'sOrders.png",
  "Asander's Freedom":         'AsandersFreedom.png',
  'Ascended ChickenCow':       'AscendedChickenCow.png',
  'Ascension':                 'Ascension.png',
  'Asynchronized':             'Asynchronized.png',
  'Avatar Ender':              'AvatarEnder.png',
  'Baby Dragon':               'BabyDragon.png',
  'Bachelor PAR-TAY!':         'BachelorPAR-TAY.png',
  'Bad Toys':                  'BadToys.jpg',
  'Base Armor':                'BaseArmor.png',
  'Battle Hewn Warmonger':     'BattleHewnWarmonger.png',
  'Blacksmith Mastery':        'BlacksmithMastery.png',
  'Blood & Roses':             'Blood&Roses.png',
  'Breaking Awe':              'BreakingAwe.png',
  'Burning Revenge':           'BurningRevenge.png',
  'Calamity':                  'Calamity.png',
  'CARNAX':                    'CARNAX.png',
  'Catastrophic Candy':        'CatastrophicCandy.jpg',
  'Chaos Slayer':              'ChaosSlayer.png',
  'ChaosWeaver':               'ChaosWeaver.png',
  'Cold as Ice':               'ColdasIce.png',
  'Confront Sek-Duat':         'ConfrontSek-Duat.png',
  'Convergence':               'Convergence.png',
  'Cookie Song!':              'CookieSong!.png',
  'Crystal Breaker':           'CrystalBreaker.png',
  'Cutest Legion EVER':        'CutestLegionEVER.jpg',
  'Death of a Knight':         'DeathofaKnight.png',
  'DeathKnight':               'DeathKnight.png',
  'DoomKnight':                'DoomKnight.jpg',
  'DoomWood Fishing':          'DoomWoodFishing.png',
  'Dracolich Fishing':         'DracolichFishing.png',
  'Dragon School':             'DragonSchool.png',
  'DragonLord':                'DragonLord.png',
  'DragonRider':               'DragonRider.png',
  'DragonSlayer':              'DragonSlayer.png',
  'Egg-cellent!':              'Egg-cellent.png',
  'EGG-STIR-MIN-ATE':          'EGG-STIR-MIN-ATE.jpg',
  'Elemental Chaos':           'ElementalChaos.png',
  'EnTropic!':                 'EnTropic.png',
  'enTropy':                   'enTropy.jpg',
  'Evolved ChickenCow':        'EvolvedChickenCow.png',
  'Evolved DragonLord':        'EvolvedDragonLord.png',
  'Evolved PumpkinLord':       'EvolvedPumpkinLord.png',
  'Face-Off!':                 'Face-Off.png',
  'Fallen General':            'FallenGeneral.jpg',
  'Fear Engine':               'FearEngine.png',
  'Fierce Warmonger':          'FierceWarmonger.png',
  'Final 13th!':               'Final13th.png',
  'Fire Fighter':              'FireFighter.png',
  'First Weaver':              'FirstWeaver.png',
  'Fishing Mastery':           'FishingMastery.png',
  'For SCIENCE!':              'ForSCIENCE.png',
  'Fresh Warmonger':           'FreshWarmonger.png',
  'Frost Moglin':              'FrostMoglin.png',
  'Frostvayle':                'Frostvayle.png',
  'Fungus Among Us':           'FungusAmongUs.png',
  'Gathering Shadows':         'GatheringShadows.png',
  'Golem Breaker':             'GolemBreaker.jpg',
  'Gourmet':                   'Gourmet.png',
  'GPS':                       'GPS.jpg',
  'Grrrberus!':                'Grrrberus.png',
  'Guardian':                  'Guardian.png',
  'Health Potion Mastery':     'HealthPotionMastery.png',
  'Heart of Darkness':         'HeartofDarkness.png',
  'Home Owner':                'HomeOwner.png',
  'HONK!':                     'HONK!.png',
  'Hope':                      'Hope.png',
  'Hopeless':                  'Hopeless.png',
  'Hugs for DoomKittens':      'HugsforDoomKittens.png',
  'Hydra Slayer':              'HydraSlayer.png',
  'I Spy':                     'ISpy.png',
  'Icebound Revenant':         'IceboundRevenant.png',
  'Icemaster':                 'Icemaster.jpg',
  'Idle Heroes':               'IdleHeroes.png',
  'Information on Sepulchure': 'InformationonSepulchure.png',
  'List Completion':           'ListCompletion.png',
  'Locksmith':                 'Locksmith.jpg',
  'Maleurous':                 'Maleurous.png',
  'Mana Potion Mastery':       'ManaPotionMastery.png',
  'Merry Togsmas!':            'MerryTogsmas.jpg',
  "Mogloween '07 Masks":       'Mogloween07Masks.png',
  "Mogloween '08 Masks":       'Mogloween08Masks.png',
  "Mogloween '09 Masks":       'Mogloween09Masks.jpg',
  "Mogloween '10 Masks":       'Mogloween10Masks.png',
  "Mogloween '11 Masks":       'Mogloween11Masks.png',
  "Mogloween '12 Masks":       'Mogloween12Masks.jpg',
  "Mogloween '13 Masks":       'Mogloween13Masks.png',
  "Mogloween '14 Masks":       'Mogloween14Masks.png',
  "Mogloween '15 Masks":       'Mogloween15Masks.png',
  'Mollo Destruction':         'MolloDestruction.png',
  'Monkee Business':           'MonkeeBusiness.jpg',
  'More Boxes!':               'MoreBoxes.png',
  'The Mystery is Afoot!':     'MysteryisAfoot-The.png',
  'Naughty List':              'NaughtyList.jpg',
  'Necromancer':               'Necromancer.png',
  'Nest Defended':             'NestDefended.png',
  'Ninja':                     'Ninja.png',
  'Nose for Trouble':          'NoseforTrouble.png',
  'Oaklore Navigation':        'OakloreNavigation.png',
  'Orb Extractor':             'OrbExtractor.png',
  'Paladin':                   'Paladin.png',
  "Party On, Olaf!":           'PartyOnOlaf.png',
  'Pet Training Mastery':      'PetTrainingMastery.png',
  'Pirate':                    'Pirate.png',
  'Primalized':                'Primalized.png',
  'Primordial Witness':        'PrimordialWitness.png',
  'PumpkinLord':               'PumpkinLord.png',
  'PvP Arena Fighter':         'PvPArenaFighter.png',
  'PvP Brawler':               'PvPBrawler.png',
  'PvP Grandmaster':           'PvPGrandmaster.png',
  'PvP Prize Fighter':         'PvPPrizeFighter.png',
  'Pyromancer':                'Pyromancer.png',
  'Quadforce':                 'Quadforce.png',
  'Quick Buy!':                'QuickBuy.png',
  'Ranger':                    'Ranger.png',
  'Resident: Sneevil':         'ResidentSneevil.jpg',
  'Sailor of the Seas':        'SailoroftheSeas.png',
  'Sands of Eternity':         'SandsofEternity.png',
  'Secrets of Bacon!':         'SecretsofBacon.png',
  'Shadow Hunter':             'ShadowHunter.png',
  'Shocking!':                 'Shocking!.png',
  'Siege of Haven':            'SiegeofHaven.png',
  'SoulWeaver':                'SoulWeaver.png',
  'Special Delivery':          'SpecialDelivery.png',
  "Star's Descendant":         "Star'sDescendant.png",
  'Starting Out':              'StartingOut.png',
  'Storm in the Night':        'StormintheNight.png',
  'Sugary Nightmare':          'SugaryNightmare.png',
  'Technomancer':              'Technomancer.png',
  'The ArchKnight':            'ArchKnight-The.png',
  'The Balance':               'TheBalance.png',
  'The End of Magic':          'TheEndofMagic.png',
  'The Magnum Opus':           'TheMagnumOpus.png',
  'The Priestess':             'ThePriestess.png',
  'Thorns':                    'Thorns.png',
  'Time Walker':               'TimeWalker.png',
  'Timetorn Veteran!':         'TimetornVeteran.png',
  'Tog Nightmare':             'TimetornVeteran.png', // reuse closest available
  'TogSlayer':                 'TogSlayer.png',
  'Tournament Champion':       'TournamentChampion.png',
  'Ultimate Destiny':          'UltimateDestiny.png',
  'Unreal Doom':               'UnrealDoom.png',
  'Void Magic':                'VoidMagicpic.jpg',
  'Walk Through Fire':         'WalkThroughFire.png',
  'Wanderer':                  'Wanderer.png',
  'Water You Doing?':          'WaterYouDoing.png',
  'Weave With Me!':            'WeaveWithMe.png',
  'Weave Without Me!':         'WeaveWithoutMe.png',
  'Wild Fighter':              'WildFighter.png',
  'Worthy':                    'Worthy.jpg',
  'Wrestling Champion!':       'WrestlingChampion.png',
  'X-val!':                    'X-val.jpg',
}

// Missing from DF-Pedia (no known image file):
// - Asynchronized → using Asynchronized.png (exists)
// - CARNAX → using CARNAX.png (exists)
// - Tog Nightmare → no dedicated image, using TimetornVeteran as placeholder

function cleanNotes(raw: string): string {
  // Strip edit timestamps like "DemonicDarkwraith -- 7/21/2024 22:43:05 >"
  // and "< Message edited by X -- date >"
  return raw
    .replace(/\s*•\s*<?\s*Message edited[^•>]*/gi, '')
    .replace(/[A-Za-z]+\s+--\s+\d+\/\d+\/\d+\s+\d+:\d+:\d+\s*>?/g, '')
    .replace(/\s+•\s*$/, '')
    .trim()
}

const badges = JSON.parse(fs.readFileSync(BADGES_PATH, 'utf-8'))

let imagesAdded = 0
let imagesMissing: string[] = []
let notesCleaned = 0

for (const badge of badges) {
  // Add image URL
  const filename = IMAGE_MAP[badge.name]
  if (filename) {
    badge.imageUrl = `${DF_PEDIA_BASE}/${encodeURIComponent(filename)}`
    imagesAdded++
  } else {
    imagesMissing.push(badge.name)
  }

  // Clean notes
  if (badge.notes) {
    const cleaned = cleanNotes(badge.notes)
    if (cleaned !== badge.notes) notesCleaned++
    badge.notes = cleaned || undefined
  }
}

fs.writeFileSync(BADGES_PATH, JSON.stringify(badges, null, 2) + '\n', 'utf-8')

console.log(`✅ Images added: ${imagesAdded}`)
console.log(`⚠️  Missing images: ${imagesMissing.length}`)
if (imagesMissing.length > 0) console.log('   ' + imagesMissing.join(', '))
console.log(`🧹 Notes cleaned: ${notesCleaned}`)
console.log('Done.')
