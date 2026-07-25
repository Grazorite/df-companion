import * as fs from 'node:fs'
import * as path from 'node:path'

function readArrayCount(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown
  return Array.isArray(data) ? data.length : 0
}

export function writeBadgeManifest(dataDir: string): void {
  const total = readArrayCount(path.resolve(dataDir, 'badges.json'))
  fs.writeFileSync(
    path.resolve(dataDir, 'badges-manifest.json'),
    `${JSON.stringify({ total }, null, 2)}\n`,
    'utf-8'
  )
}

export function writePetsGuestsManifest(dataDir: string): void {
  const pet = readArrayCount(path.resolve(dataDir, 'pets.json'))
  const guest = readArrayCount(path.resolve(dataDir, 'guests.json'))

  fs.writeFileSync(
    path.resolve(dataDir, 'pets-guests-manifest.json'),
    `${JSON.stringify({ total: pet + guest, byType: { pet, guest } }, null, 2)}\n`,
    'utf-8'
  )
}

function readDataFilesBySubtype(
  dataDir: string,
  subtypeFiles: Array<[string, string[]]>
): { total: number; bySubtype: Record<string, number> } {
  const bySubtype: Record<string, number> = {}
  let total = 0

  for (const [subtype, files] of subtypeFiles) {
    const count = files.reduce((sum, file) => sum + readArrayCount(path.resolve(dataDir, file)), 0)
    bySubtype[subtype] = count
    total += count
  }

  return { total, bySubtype }
}

export function writeWeaponManifest(dataDir: string): void {
  const manifest = readDataFilesBySubtype(dataDir, [
    [
      'sword-axe-mace',
      [
        'weapons-swords-axes-maces-a-g.json',
        'weapons-swords-axes-maces-h-n.json',
        'weapons-swords-axes-maces-o-z.json',
      ],
    ],
    [
      'staff-wand',
      [
        'weapons-staves-wands-a-g.json',
        'weapons-staves-wands-h-n.json',
        'weapons-staves-wands-o-z.json',
      ],
    ],
    [
      'dagger',
      ['weapons-daggers-a-g.json', 'weapons-daggers-h-n.json', 'weapons-daggers-o-z.json'],
    ],
    ['scythe', ['weapons-scythes-a-j.json', 'weapons-scythes-k-z.json']],
  ])

  fs.writeFileSync(
    path.resolve(dataDir, 'weapon-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf-8'
  )
}
