import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
}

export default function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
}: SearchBarProps) {
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        className="w-full bg-bg-surface border border-border-default rounded-lg pl-9 pr-9 py-2.5 text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-gold transition-colors duration-150"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 transition-colors duration-150"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
