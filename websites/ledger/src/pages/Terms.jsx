import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16 sm:py-24">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary lift-on-hover mb-10">
          <ArrowLeft className="h-4 w-4" /> Back to Ledger
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
            <BookOpen className="h-5 w-5 text-white" strokeWidth={2.4} />
          </span>
          <span className="font-display font-bold tracking-tight text-lg">Ledger</span>
        </div>

        <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight mb-4">Terms</h1>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-12">Last updated: July 2026</p>

        <div className="space-y-8 text-muted leading-relaxed">
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">What this is</h2>
            <p>Ledger is a personal project, not a commercial product or service. It's a single-user system built for one person's own daily use — there's no account system, no service level agreement, and no support obligation.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">No warranty</h2>
            <p>The linked apps are provided as-is, maintained on a personal basis, and may change or be taken offline at any time without notice.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
