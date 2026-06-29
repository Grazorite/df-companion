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

  if (!visible) return null

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-12 h-12 rounded-full bg-bg-elevated border border-border-hover text-text-secondary hover:text-gold hover:border-gold shadow-medium transition-all duration-150 flex items-center justify-center"
    >
      <ArrowUp className="w-5 h-5" aria-hidden="true" />
    </button>
  )
}
