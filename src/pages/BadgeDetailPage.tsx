import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Shield } from 'lucide-react'
import { useBadgeBySlug, useBadgesByCategory } from '../hooks/useBadges'
import BadgeCard from '../components/badges/BadgeCard'

export default function BadgeDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const badge = useBadgeBySlug(slug ?? '')
  const relatedBadges = useBadgesByCategory(badge?.category ?? '', badge?.slug, badge?.subcategory)

  if (!badge) {
    return (
      <main className="px-4 py-8 max-w-3xl mx-auto text-center">
        <p className="text-text-secondary text-lg mb-4">Badge not found.</p>
        <Link
          to="/badges"
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
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm mb-6 transition-colors duration-150 min-h-[44px] -ml-1 px-1"
        aria-label="Go back to badge list"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Badges
      </button>

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
              to="/badges?da=true"
              className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 transition-colors hover:bg-orange-500/30"
              title="Browse all DA Required badges"
            >
              DA Required
            </Link>
          )}
          {/* Retired — clickable filter like DA Required */}
          {badge.retired && (
            <Link
              to="/badges?retired=true"
              className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-bg-overlay text-text-secondary border border-border-default transition-colors hover:border-border-hover hover:text-text-primary"
              title="Browse all retired badges"
            >
              Retired
            </Link>
          )}
        </div>

        <div className="flex items-start gap-4 mb-3">
          {/* Badge image — show placeholder if no image */}
          {badge.imageVariants ? (
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-lg bg-bg-elevated border border-border-default flex flex-col items-center justify-center gap-1 text-center p-2">
                <span className="text-gold text-xs font-bold">32</span>
                <span className="text-text-muted text-[10px] leading-tight">variants</span>
              </div>
            </div>
          ) : badge.imageUrl ? (
            <img
              src={badge.imageUrl}
              alt={`${badge.name} badge icon`}
              className="w-20 h-20 rounded-lg object-contain flex-shrink-0 bg-bg-elevated border border-border-default p-1.5 shadow-subtle img-fade"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg flex-shrink-0 bg-bg-elevated border border-border-default flex items-center justify-center shadow-subtle">
              <Shield className="w-8 h-8 text-border-hover" aria-hidden="true" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">{badge.name}</h1>
            <p className="text-text-secondary leading-relaxed text-sm italic">{badge.description}</p>
          </div>
        </div>
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
          <ul className="space-y-2">
            {badge.notes.split(' • ').filter((n) => n.trim().length > 0).map((note, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary leading-relaxed">
                <span className="text-text-muted mt-0.5 flex-shrink-0">•</span>
                <span>{note.trim()}</span>
              </li>
            ))}
          </ul>
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
                <BadgeCard badge={related} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
