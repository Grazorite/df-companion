interface LocationLike {
  pathname: string
  search: string
}

const BROWSE_LIST_PATHS = new Set([
  '/accessories',
  '/badges',
  '/classes',
  '/housing',
  '/pets',
  '/weapons',
])

const DETAIL_ROUTE_ROOTS = new Set([
  'accessories',
  'badges',
  'classes',
  'guests',
  'housing',
  'pets',
  'weapons',
])

export function currentListUrl(location: LocationLike): string {
  return `${location.pathname}${location.search}`
}

export function detailUrlWithFrom(targetUrl: string, fromUrl: string): string {
  const [path, query = ''] = targetUrl.split('?')
  const params = new URLSearchParams(query)
  params.set('from', fromUrl)
  const queryString = params.toString()
  return queryString ? `${path}?${queryString}` : path
}

export function backUrlFromSearch(search: string, fallback: string): string {
  return new URLSearchParams(search).get('from') ?? fallback
}

export function isBrowseListPath(pathname: string): boolean {
  return BROWSE_LIST_PATHS.has(pathname)
}

export function isDetailRoutePath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 2 && DETAIL_ROUTE_ROOTS.has(segments[0])
}
