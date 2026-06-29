export type BadgeCategory =
  | 'quest-completion'
  | 'combat'
  | 'collection'
  | 'seasonal'
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
  subcategory?: string  // Forum subcategory (e.g. "Book 3", "Side Quests")
  howToObtain: ObtainStep[]
  requirements: string // Short requirement summary (e.g. "Completion of A Hero is Thawed")
  daRequired: boolean  // Whether a Dragon Amulet is needed
  retired: boolean     // Whether the badge is no longer obtainable
  forumLinks: ForumLink[]
  wikiLink?: string
  tags: string[]
  imageUrl?: string    // Badge art URL (DF-Pedia GitHub, or forum-hosted fallback)
  forumImageUrl?: string // Raw image URL scraped from the forum post (used as fallback)
  imageVariants?: string[] // For badges with multiple visual variants (e.g. Tog Nightmare)
  notes?: string       // Additional information / trivia (bullet-separated with " • ")
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
  subcategory?: string
  query?: string
  daRequired?: boolean
}
