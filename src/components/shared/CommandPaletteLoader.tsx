import { lazy, Suspense, useEffect, useState } from 'react'
import { COMMAND_PALETTE_OPEN_EVENT } from '../../utils/commandPalette'

// Lazy so the `cmdk` dependency and the palette UI stay out of the main bundle
// and only download the first time the palette is opened.
const CommandPalette = lazy(() => import('./CommandPalette'))

/**
 * Eager, dependency-light controller for the global Command palette. It owns
 * the open state and the Cmd/Ctrl+K + custom-event triggers, and only mounts
 * the heavier lazy palette once it has been opened at least once.
 */
export default function CommandPaletteLoader() {
  const [open, setOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setHasOpened(true)
        setOpen((value) => !value)
      }
    }
    function onOpen() {
      setHasOpened(true)
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen)
    }
  }, [])

  if (!hasOpened) return null

  return (
    <Suspense fallback={null}>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </Suspense>
  )
}
