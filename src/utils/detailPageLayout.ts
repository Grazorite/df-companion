export const DETAIL_PAGE_CONTAINER_CLASS = 'px-4 sm:px-6 py-6 max-w-5xl mx-auto'
export const DETAIL_PAGE_TOP_CONTAINER_CLASS = 'px-4 sm:px-6 pt-6 max-w-5xl mx-auto'

export function detailPageClassName(...classes: Array<string | undefined | false>) {
  return [DETAIL_PAGE_CONTAINER_CLASS, ...classes].filter(Boolean).join(' ')
}
