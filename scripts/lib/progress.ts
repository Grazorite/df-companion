import * as fs from 'node:fs'

export function loadProgressEntries<T extends { slug: string }>(filePath: string): Map<string, T> {
  if (!fs.existsSync(filePath)) return new Map()

  const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T[]
  return new Map(existing.map((entry) => [entry.slug, entry]))
}

export function saveProgressEntries<T>(filePath: string, entries: T[]): void {
  const tempPath = `${filePath}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(entries, null, 2) + '\n', 'utf-8')
  fs.renameSync(tempPath, filePath)
}
