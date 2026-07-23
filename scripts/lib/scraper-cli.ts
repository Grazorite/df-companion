export interface LetterFilterArgs {
  start?: string
  letter?: string
  letters?: string[]
}

export function getArg(name: string): string | undefined {
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split('=')[1]
}

export function getLetterFilterArgs(): LetterFilterArgs {
  const start = getArg('start')?.toUpperCase()
  const letter = getArg('letter')?.toUpperCase()
  const letters = getArg('letters')
    ?.toUpperCase()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    ...(start ? { start } : {}),
    ...(letter ? { letter } : {}),
    ...(letters && letters.length > 0 ? { letters } : {}),
  }
}

export function getLimitArg(): number | undefined {
  const raw = getArg('limit')
  if (!raw) return undefined

  const limit = Number.parseInt(raw, 10)
  return Number.isFinite(limit) && limit > 0 ? limit : undefined
}

export function getConcurrencyArg(defaultValue = 2): number {
  const raw = getArg('concurrency')
  if (!raw) return defaultValue

  const concurrency = Number.parseInt(raw, 10)
  if (!Number.isFinite(concurrency) || concurrency < 1) return defaultValue
  return Math.min(concurrency, 4)
}

export function applyLetterFilter<T extends { letter: string }>(
  entries: T[],
  filter: LetterFilterArgs
): { entries: T[]; message?: string } {
  if (filter.letters && filter.letters.length > 0) {
    const selected = entries.filter((entry) => filter.letters?.includes(entry.letter))
    return {
      entries: selected,
      message: `Filtered to letters ${filter.letters.join(', ')}: ${selected.length} entries`,
    }
  }

  if (filter.letter) {
    const selected = entries.filter((entry) => entry.letter === filter.letter)
    return {
      entries: selected,
      message: `Filtered to letter ${filter.letter}: ${selected.length} entries`,
    }
  }

  if (filter.start) {
    let pastStart = false
    const selected = entries.filter((entry) => {
      if (entry.letter === filter.start) pastStart = true
      return pastStart
    })
    return {
      entries: selected,
      message: `Resuming from ${filter.start}: ${selected.length} entries remaining`,
    }
  }

  return { entries }
}

export function applyLimit<T>(entries: T[], limit?: number): T[] {
  return limit ? entries.slice(0, limit) : entries
}
