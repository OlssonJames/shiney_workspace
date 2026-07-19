import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen } from 'lucide-react'

export default function PrivacyPolicy() {
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

        <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight mb-4">Privacy Policy</h1>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-12">Last updated: July 2026</p>

        <div className="space-y-8 text-muted leading-relaxed">
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">This is a personal system, not a hosted service</h2>
            <p>Ledger is a launcher page linking to three local-first apps — Habit Tracker, Session Notes, and Day Planner. This page itself collects nothing: there's no form, no analytics, no account.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Where your data actually lives</h2>
            <p>Each linked app stores its data only in your own browser's local storage, on your own device. Nothing is transmitted anywhere or shared between users, because there aren't any — these are single-user tools by design.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Your responsibility</h2>
            <p>Because everything lives locally, you're responsible for backing it up (each app has an Export/Import option) — clearing your browser's data will clear it too.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
