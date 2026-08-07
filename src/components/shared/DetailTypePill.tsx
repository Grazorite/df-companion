import { normalizeDisplayText } from '../../utils/displayText'

interface DetailTypePillProps {
  label?: string
}

export default function DetailTypePill({ label }: DetailTypePillProps) {
  const text = label?.trim()
  if (!text) return null

  return (
    <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-bg-overlay text-text-muted capitalize ml-auto">
      {normalizeDisplayText(text)}
    </span>
  )
}
