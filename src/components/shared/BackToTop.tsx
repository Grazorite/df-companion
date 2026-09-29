import { useState, useEffect, useCallback } from 'react'
import { ArrowUp } from 'lucide-react'

const SCROLL_THRESHOLD = 400

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  const handleScroll = useCallback(() => {
    setVisible(window.scrollY > SCROLL_THRESHOLD)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      data-motion="back-to-top"
      data-visible={visible}
      className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border-hover bg-bg-elevated text-text-secondary shadow-medium hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <ArrowUp className="w-5 h-5" aria-hidden="true" />
    </button>
  )
}
