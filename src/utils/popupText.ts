export interface PopupGroup {
  label: string
  messages: string[]
}

export interface PopupSegment {
  mainText: string
  popupGroups: PopupGroup[]
}

function findBalancedClose(text: string, start: number, open: string, close: string): number {
  let depth = 0
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (char === open) depth += 1
    if (char !== close) continue
    depth -= 1
    if (depth === 0) return index
  }
  return -1
}

function splitPopupMessages(value: string, label: string): string[] {
  const normalized = value.trim()
  if (!normalized) return []
  if (/Pop[- ]?ups/i.test(label)) {
    return normalized
      .split(/\s+\/\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return [normalized]
}

function normalizeMainText(text: string): string {
  return text
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
}

export function splitPopupText(text: string): PopupSegment {
  const markerPattern = /(?:Message\s+)?Pop[- ]?ups?\s*:/i
  const popupGroups: PopupGroup[] = []
  let remaining = text
  let mainText = ''

  while (remaining.length > 0) {
    const marker = remaining.match(markerPattern)
    if (!marker || marker.index === undefined) {
      mainText += remaining
      break
    }

    const markerStart = marker.index
    const markerEnd = markerStart + marker[0].length
    const openerIndex =
      markerStart > 0 && ['(', '['].includes(remaining[markerStart - 1])
        ? markerStart - 1
        : markerStart
    const opener = remaining[openerIndex]
    const hasWrapper = opener === '(' || opener === '['
    const closer = opener === '(' ? ')' : opener === '[' ? ']' : ''
    const popupStart = markerEnd
    const popupEnd = hasWrapper
      ? findBalancedClose(remaining, openerIndex, opener, closer)
      : remaining.length

    if (popupEnd < 0) {
      mainText += remaining
      break
    }

    mainText += remaining.slice(0, openerIndex)
    const rawPopup = remaining.slice(popupStart, popupEnd)
    const messages = splitPopupMessages(rawPopup, marker[0])
    if (messages.length > 0) {
      popupGroups.push({
        label: marker[0].trim(),
        messages,
      })
    }
    remaining = remaining.slice(popupEnd + (hasWrapper ? 1 : 0))
  }

  return {
    mainText: normalizeMainText(mainText),
    popupGroups,
  }
}
