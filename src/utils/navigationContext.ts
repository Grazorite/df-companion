interface LocationLike {
  pathname: string
  search: string
}

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
