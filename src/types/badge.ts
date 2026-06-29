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
  description: string
  category: BadgeCategory
  howToObtain: ObtainStep[]
  forumLinks: ForumLink[]
  wikiLink?: string
  tags: string[]
  imageUrl?: string
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
