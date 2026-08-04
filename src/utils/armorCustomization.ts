export interface ArmorCustomizationInfo {
  modifies: string
  appearance: string
}

function normalizeArmorCustomizationValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeModifiesValue(value: string): string {
  return normalizeArmorCustomizationValue(value)
    .replace(/\s+class(?:es)?\b\.?$/i, '')
    .trim()
}

export function parseArmorCustomization(text?: string): ArmorCustomizationInfo | undefined {
  if (!text) return undefined

  const normalized = normalizeArmorCustomizationValue(text)
  const formerAppearanceMatch = normalized.match(
    /modify\s+the\s+appearance\s+of\s+(?:the\s+)?(.+?)\s+class(?:es)?[\s\S]*?unlock(?:s|ing|ed)?\s+(?:the\s+)?(.+?)\s+Armor Customization options\b/i
  )
  if (formerAppearanceMatch) {
    return {
      modifies: normalizeModifiesValue(formerAppearanceMatch[1]),
      appearance: normalizeArmorCustomizationValue(formerAppearanceMatch[2]),
    }
  }

  const patterns = [
    /unlock(?:s|ing)?\s+(?:the\s+)?(.+?)\s+Armor Customization options for\s+(?:the\s+)?(.+?)\s+class(?:es)?\b/i,
    /unlock(?:s|ing)?\s+(?:the\s+)?(.+?)\s+Armor Customization options for\s+(?:the\s+)?([^.;!]+?)(?:[.;!]|$)/i,
    /(?:Customization Catalyst,\s*)?unlock(?:s|ing)?\s+(?:the\s+)?(.+?)\s+customization for\s+(?:the\s+)?(.+?)\s+class(?:es)?\b/i,
    /(?:Customization Catalyst,\s*)?unlock(?:s|ing)?\s+(?:the\s+)?(.+?)\s+customization for\s+(?:the\s+)?([^.;!]+?)(?:[.;!]|$)/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match) continue

    return {
      appearance: normalizeArmorCustomizationValue(match[1]),
      modifies: normalizeModifiesValue(match[2]),
    }
  }

  return undefined
}
