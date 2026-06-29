import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useBadgeBySlug } from '../hooks/useBadges'

export default function BadgeDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const badge = useBadgeBySlug(slug ?? '')

  if (!badge) {
    return (
      <main className="px-4 py-8 max-w-3xl mx-auto text-center">
        <p className="text-slate-400 text-lg mb-4">Badge not found.</p>
        <Link to="/badges" className="text-amber-400 underline underline-offset-2 text-sm">
          Back to Badges
        </Link>
      </main>
    )
  }

  return (
    <main className="px-4 py-6 max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-5 transition-colors min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Badges
      </button>

      {/* Badge header */}
      <div className="mb-6">
        <span className="inline-block bg-amber-500/20 text-amber-400 text-xs font-medium px-2.5 py-1 rounded-full mb-3 capitalize">
          {badge.category.replace(/-/g, ' ')}
        </span>
        <h1 className="text-2xl font-bold text-white mb-2">{badge.name}</h1>
        <p className="text-slate-300 leading-relaxed">{badge.description}</p>
      </div>

      {/* How to obtain */}
      <section className="bg-slate-800 rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          How to Obtain
        </h2>
        <ol className="space-y-3">
          {badge.howToObtain.map((step) => (
            <li key={step.order} className="flex gap-3">
              <span className="flex-shrink-0 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center mt-0.5">
                {step.order}
              </span>
              <p className="text-slate-300 text-sm leading-relaxed">{step.instruction}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Forum sources */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Source
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
              <div>
                {link.isPrimary && (
                  <span className="text-amber-400 text-xs font-medium block mb-0.5">
                    Primary Source
                  </span>
                )}
                <span className="text-white text-sm font-medium">{link.title}</span>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0 ml-3" />
            </a>
          ))}
        </div>
      </section>

      {/* Tags */}
      {badge.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badge.tags.map((tag) => (
            <span
              key={tag}
              className="bg-slate-700 text-slate-400 text-xs px-2.5 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </main>
  )
}
