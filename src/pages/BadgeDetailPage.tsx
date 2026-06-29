import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useBadgeBySlug, useBadgesByCategory } from '../hooks/useBadges'
import BadgeCard from '../components/badges/BadgeCard'

export default function BadgeDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const badge = useBadgeBySlug(slug ?? '')
  const relatedBadges = useBadgesByCategory(badge?.category ?? '', badge?.slug)

  if (!badge) {
    return (
      <main className="px-4 py-8 max-w-3xl mx-auto text-center">
        <p className="text-slate-400 text-lg mb-4">Badge not found.</p>
        <Link
          to="/badges"
          className="text-amber-400 underline underline-offset-2 text-sm hover:text-amber-300"
        >
          ← Back to Badges
        </Link>
      </main>
    )
  }

  const CATEGORY_COLORS: Record<string, string> = {
    'quest-completion': 'bg-blue-500/20 text-blue-400',
    combat: 'bg-red-500/20 text-red-400',
    collection: 'bg-purple-500/20 text-purple-400',
    seasonal: 'bg-cyan-500/20 text-cyan-400',
    misc: 'bg-slate-500/20 text-slate-400',
  }

  return (
    <main className="px-4 py-6 max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors min-h-[44px] -ml-1 px-1"
        aria-label="Go back to badge list"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Badges
      </button>

      {/* Badge header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span
            className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full capitalize ${CATEGORY_COLORS[badge.category] ?? CATEGORY_COLORS.misc}`}
          >
            {badge.category.replace(/-/g, ' ')}
          </span>
          {badge.daRequired && (
            <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400">
              DA Required
            </span>
          )}
          {badge.retired && (
            <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-slate-500/20 text-slate-400">
              Retired
            </span>
          )}
        </div>
        <div className="flex items-start gap-4 mb-3">
          {/* Badge image */}
          {badge.imageUrl && !badge.imageVariants && (
            <img
              src={badge.imageUrl}
              alt={`${badge.name} badge icon`}
              className="w-20 h-20 rounded-lg object-contain flex-shrink-0 bg-slate-800 p-1"
            />
          )}
          {badge.imageVariants && (
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-lg bg-slate-800 border border-slate-600 flex flex-col items-center justify-center gap-1 text-center p-2">
                <span className="text-amber-400 text-xs font-bold">32</span>
                <span className="text-slate-400 text-[10px] leading-tight">variants</span>
              </div>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">{badge.name}</h1>
            <p className="text-slate-300 leading-relaxed text-sm italic">{badge.description}</p>
          </div>
        </div>
      </div>

      {/* How to obtain — no step number since all badges have exactly one requirement */}
      <section aria-labelledby="how-to-obtain-heading" className="bg-slate-800 rounded-xl p-5 mb-5">
        <h2
          id="how-to-obtain-heading"
          className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3"
        >
          How to Obtain
        </h2>
        <p className="text-slate-300 text-sm leading-relaxed">
          {badge.howToObtain[0]?.instruction ?? 'See forum link for details.'}
        </p>
      </section>

      {/* Other information */}
      {badge.notes && (
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Other Information
          </h2>
          <ul className="space-y-2">
            {badge.notes.split(' • ').filter((n) => n.trim().length > 0).map((note, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
                <span className="text-slate-500 mt-0.5 flex-shrink-0">•</span>
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
          className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3"
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
              className={`flex items-center justify-between rounded-xl p-4 min-h-[56px] transition-colors ${
                link.isPrimary
                  ? 'bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-800 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              <div className="min-w-0">
                {link.isPrimary && (
                  <span className="text-amber-400 text-xs font-medium block mb-0.5">
                    Primary Source
                  </span>
                )}
                <span className="text-white text-sm font-medium truncate block">{link.title}</span>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0 ml-3" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      {/* Tags */}
      {badge.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-8" aria-label="Tags">
          {badge.tags.map((tag) => (
            <span key={tag} className="bg-slate-700 text-slate-400 text-xs px-2.5 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Related badges */}
      {relatedBadges.length > 0 && (
        <section aria-labelledby="related-heading">
          <h2
            id="related-heading"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3"
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
