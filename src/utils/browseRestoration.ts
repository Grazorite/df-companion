export interface BrowseRestoration {
  cardHref: string
  renderedCount: number
  scrollY: number
}

const browseRestorations = new Map<string, BrowseRestoration>()

export function saveBrowseRestoration(listUrl: string, state: BrowseRestoration): void {
  browseRestorations.set(listUrl, state)
}

export function getBrowseRestoration(listUrl: string): BrowseRestoration | undefined {
  return browseRestorations.get(listUrl)
}
