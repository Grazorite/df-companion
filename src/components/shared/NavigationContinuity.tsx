import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getBrowseRestoration } from '../../utils/browseRestoration'
import { currentListUrl, isBrowseListPath, isDetailRoutePath } from '../../utils/navigationContext'

const CONTENT_WAIT_TIMEOUT_MS = 10_000

function waitForContent(
  findTarget: () => HTMLElement | null,
  onReady: (target: HTMLElement) => void
) {
  const target = findTarget()
  if (target) {
    onReady(target)
    return () => undefined
  }

  const observer = new MutationObserver(() => {
    const nextTarget = findTarget()
    if (!nextTarget) return
    observer.disconnect()
    window.clearTimeout(timeout)
    onReady(nextTarget)
  })
  observer.observe(document.getElementById('root') ?? document.body, {
    childList: true,
    subtree: true,
  })
  const timeout = window.setTimeout(() => observer.disconnect(), CONTENT_WAIT_TIMEOUT_MS)

  return () => {
    observer.disconnect()
    window.clearTimeout(timeout)
  }
}

function findCardByHref(cardHref: string): HTMLAnchorElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLAnchorElement>('main a.group[href]')).find(
      (card) => card.getAttribute('href') === cardHref
    ) ?? null
  )
}

export default function NavigationContinuity() {
  const { key, pathname, search } = useLocation()
  const lastLocation = useRef<{ pathname: string; search: string } | null>(null)
  const transition = useRef<{
    key: string
    previous: { pathname: string; search: string } | null
  } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const previousSetting = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previousSetting
    }
  }, [])

  useEffect(() => {
    let previous = transition.current?.previous ?? null
    if (transition.current?.key !== key) {
      previous = lastLocation.current
      transition.current = { key, previous }
      lastLocation.current = { pathname, search }
    }

    if (previous?.pathname === pathname) return

    const listUrl = currentListUrl({ pathname, search })
    const restoration = isBrowseListPath(pathname) ? getBrowseRestoration(listUrl) : undefined

    if (restoration && previous && isDetailRoutePath(previous.pathname)) {
      return waitForContent(
        () => findCardByHref(restoration.cardHref),
        (card) => {
          window.scrollTo({ top: restoration.scrollY, left: 0, behavior: 'auto' })
          card.focus({ preventScroll: true })
          setAnnouncement(document.querySelector('main h1')?.textContent?.trim() ?? 'Results')
        }
      )
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    return waitForContent(
      () => document.querySelector<HTMLElement>('main h1'),
      (heading) => {
        heading.tabIndex = -1
        heading.focus({ preventScroll: true })
        setAnnouncement(heading.textContent?.trim() ?? 'Page loaded')
      }
    )
  }, [key, pathname, search])

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  )
}
