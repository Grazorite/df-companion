export type BadgeCategory =
  | 'quest-completion'
  | 'exploration'
  | 'combat'
  | 'collection'
  | 'seasonal'
  | 'secret'
  | 'community'
  | 'misc'

export interface ForumLink {
  url: string
  title: string
  isPrimary: boolean
}

export interface ObtainStep {
  order: number
  instruction: string
  forumReference?: string
}

export interface Badge {
  id: string
  name: string
  slug: string
  description: string // Flavour text (e.g. "The journey begins, anew.")
  category: BadgeCategory
  howToObtain: ObtainStep[]
  requirements: string // Short requirement summary (e.g. "Completion of A Hero is Thawed")
  daRequired: boolean // Whether a Dragon Amulet is needed
  forumLinks: ForumLink[]
  wikiLink?: string
  tags: string[]
  imageUrl?: string // Badge art (local path or URL)
  notes?: string // Additional information / trivia
}

export interface CategoryMeta {
  id: BadgeCategory
  displayName: string
  description: string
  icon: string
}

export interface ContentSection {
  id: string
  label: string
  icon: string
  path: string
  isAvailable: boolean
}

export interface BadgeFilters {
  category?: BadgeCategory
  query?: string
}
