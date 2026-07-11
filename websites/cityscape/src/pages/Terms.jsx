import { Link } from 'react-router-dom'
import { ArrowLeft, HardHat } from 'lucide-react'

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16 sm:py-24">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary lift-on-hover mb-10">
          <ArrowLeft className="h-4 w-4" /> Back to CityScape
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
            <HardHat className="h-5 w-5 text-white" strokeWidth={2.4} />
          </span>
          <span className="font-display font-bold tracking-tight text-lg">CityScape</span>
        </div>

        <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight mb-4">Terms of Service</h1>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-12">Last updated: July 2026</p>

        <div className="space-y-8 text-muted leading-relaxed">
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Estimates &amp; Quotes</h2>
            <p>Estimates provided through this site or in person are preliminary and subject to change following a full site assessment. Final pricing is confirmed in a signed contract before work begins.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Scheduling</h2>
            <p>Site visit and project timelines are estimates and may shift due to permitting, weather, material availability, or scope changes requested by the client.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Licensing &amp; Compliance</h2>
            <p>CityScape Construction is a licensed, bonded, and insured general contractor. All work is performed in accordance with applicable local building codes and permitting requirements.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Limitation of Liability</h2>
            <p>CityScape Construction is not liable for delays or damages arising from circumstances outside our reasonable control, including weather, third-party inspections, or supply chain disruptions.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Contact</h2>
            <p>Questions about these terms can be directed to CityScape Construction at build@cityscapeconstruction.com or +1 (555) 042-1873.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
