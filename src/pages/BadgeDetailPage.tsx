import { useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Shield } from 'lucide-react'
import { useBadgeBySlug, useBadgesByCategory } from '../hooks/useBadges'
import BadgeCard from '../components/badges/BadgeCard'
import NotesList from '../components/shared/NotesList'

export default function BadgeDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const badge = useBadgeBySlug(slug ?? '')
  const relatedBadges = useBadgesByCategory(badge?.category ?? '', badge?.slug, badge?.subcategory)

  // The URL to return to when pressing "Back to Badges"
  // - If we arrived from the badge list (or via a related badge), the `from` param tracks the original list URL
  // - Falls back to /badges if no `from` is present
  const searchParams = new URLSearchParams(location.search)
  const backUrl = searchParams.get('from') ?? '/badges'

  // When navigating to a related badge, we REPLACE the current history entry
  // so clicking back always goes to the badge list, not the previous badge.
  // We also carry the `from` param forward so it persists through the chain.
  function relatedBadgeUrl(relatedSlug: string) {
    const params = new URLSearchParams()
    params.set('from', backUrl)
    return `/badges/${relatedSlug}?${params.toString()}`
  }

  if (!badge) {
    return (
      <main className="px-4 py-8 max-w-3xl mx-auto text-center">
        <p className="text-text-secondary text-lg mb-4">Badge not found.</p>
        <Link
          to={backUrl}
          className="text-gold underline underline-offset-2 text-sm hover:text-gold-bright transition-colors"
        >
          ← Back to Badges
        </Link>
      </main>
    )
  }

  const CATEGORY_COLORS: Record<string, string> = {
    'quest-completion': 'bg-blue-500/20 text-blue-400',
    combat: 'bg-red-600/20 text-red-400',
    collection: 'bg-purple-500/20 text-purple-400',
    seasonal: 'bg-cyan-500/20 text-cyan-400',
    misc: 'bg-bg-overlay text-text-muted',
  }

  return (
    <main className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      {/* Back button — always returns to the badge list, not the previous badge */}
      <Link
        to={backUrl}
        className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors duration-150 min-h-[44px] -ml-1 px-1"
        aria-label="Back to badge list"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Badges
      </Link>

      {/* Badge header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {/* Category pill — clickable, links to badge list filtered by category */}
          <Link
            to={`/badges?category=${badge.category}`}
            className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full capitalize transition-colors hover:opacity-80 ${CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.misc}`}
            title={`Browse all ${badge.category.replace(/-/g, ' ')} badges`}
          >
            {badge.category.replace(/-/g, ' ')}
          </Link>
          {/* DA Required pill — clickable, links to DA Required filter */}
          {badge.daRequired && (
            <Link
              to="/badges?access=da"
              className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 transition-colors hover:bg-orange-500/30"
              title="Browse all DA Required badges"
            >
              DA Required
            </Link>
          )}
          {/* Retired — clickable filter */}
          {badge.retired && (
            <Link
              to="/badges?category=retired"
              className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-bg-overlay text-text-secondary border border-border-default transition-colors hover:border-border-hover hover:text-text-primary"
              title="Browse all retired badges"
            >
              Retired
            </Link>
          )}
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-2">{badge.name}</h1>
        <p className="text-text-secondary leading-relaxed text-sm italic">{badge.description}</p>
      </div>

      {/* Badge image */}
      <div className="mb-6">
        {badge.imageVariants ? (
          <div className="w-full max-w-xs mx-auto aspect-square rounded-xl bg-bg-elevated border border-border-default flex flex-col items-center justify-center gap-2 text-center p-6 shadow-medium">
            <span className="text-gold text-2xl font-bold">32</span>
            <span className="text-text-muted text-sm leading-tight">variants</span>
          </div>
        ) : badge.imageUrl ? (
          <img
            src={badge.imageUrl}
            alt={`${badge.name} badge icon`}
            loading="lazy"
            className="max-w-xs w-full mx-auto rounded-xl object-contain bg-bg-elevated border border-border-default p-6 shadow-medium img-fade"
          />
        ) : (
          <div className="w-full max-w-xs mx-auto aspect-square bg-bg-elevated border border-border-default rounded-xl flex items-center justify-center shadow-medium">
            <Shield className="w-16 h-16 text-border-hover" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* How to obtain — gold accent left border */}
      <section
        aria-labelledby="how-to-obtain-heading"
        className="bg-bg-surface border-l-4 border-gold rounded-lg p-5 mb-5"
      >
        <h2
          id="how-to-obtain-heading"
          className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
        >
          How to Obtain
        </h2>
        <p className="text-text-primary text-sm leading-relaxed">
          {badge.howToObtain[0]?.instruction ?? 'See forum link for details.'}
        </p>
      </section>

      {/* Other information */}
      {badge.notes && (
        <section className="bg-bg-surface/60 border border-border-default rounded-lg p-4 mb-5">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Other Information
          </h2>
          <NotesList notes={badge.notes} />
        </section>
      )}

      {/* Forum sources */}
      <section aria-labelledby="sources-heading" className="mb-5">
        <h2
          id="sources-heading"
          className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
        >
          Forum Source{badge.forumLinks.length > 1 ? 's' : ''}
        </h2>
        <div className="space-y-2">
          {badge.forumLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between rounded-lg p-4 min-h-[56px] transition-all duration-150 ${
                link.isPrimary
                  ? 'bg-gold/10 border-l-4 border-gold hover:bg-gold/15'
                  : 'bg-bg-surface border border-border-default hover:bg-bg-elevated hover:border-border-hover'
              }`}
            >
              <div className="min-w-0">
                {link.isPrimary && (
                  <span className="text-gold text-xs font-medium block mb-0.5">
                    Primary Source
                  </span>
                )}
                <span className="text-text-primary text-sm font-medium truncate block">{link.title}</span>
              </div>
              <ExternalLink className="w-4 h-4 text-text-muted flex-shrink-0 ml-3" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      {/* Tags — internal search keywords, not clickable filters */}
      {badge.tags.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5" aria-label="Search tags">
            {badge.tags.map((tag) => (
              <span key={tag} className="bg-bg-overlay text-text-muted text-xs px-2.5 py-1 rounded-full border border-border-subtle">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related badges */}
      {relatedBadges.length > 0 && (
        <section aria-labelledby="related-heading" className="border-t border-border-default pt-6">
          <h2
            id="related-heading"
            className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3"
          >
            Related Badges
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Related badges">
            {relatedBadges.map((related) => (
              <li key={related.id}>
                <BadgeCard badge={related} toUrl={relatedBadgeUrl(related.slug)} replace />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
