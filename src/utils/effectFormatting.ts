export function extractRateFromEffect(effect?: string): { effectText?: string; rate?: string } {
  if (!effect) return {}

  const rateMatches = [...effect.matchAll(/(?:\[|\()Rate:\s*([^\])]+)(?:\]|\))/gi)]
  const rate = rateMatches.at(-1)?.[1]?.trim()
  if (!rate) return { effectText: effect }

  const effectText = effect
    .replace(/\s*(?:\[|\()Rate:\s*[^\])]+(?:\]|\))/gi, '')
    .split('\n')
    .map((line) => {
      const leadingWhitespace = line.match(/^\s*/)?.[0] ?? ''
      const body = line.slice(leadingWhitespace.length)
      return `${leadingWhitespace}${body
        .replace(/[^\S\n]{2,}/g, ' ')
        .replace(/[^\S\n]+([;,.!?])/g, '$1')}`.trimEnd()
    })
    .join('\n')
    .trim()

  return { effectText, rate }
}
