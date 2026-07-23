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
