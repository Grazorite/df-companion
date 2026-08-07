export function buildFilterLink(base: string, key: string, value: string): string {
  const [path, query = ''] = base.split('?')
  const params = new URLSearchParams(query)
  params.set(key, value)
  const nextQuery = params.toString()
  return nextQuery ? `${path}?${nextQuery}` : path
}
