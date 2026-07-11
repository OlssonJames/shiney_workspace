import { Link } from 'react-router-dom'
import { ArrowLeft, HardHat } from 'lucide-react'

export default function PrivacyPolicy() {
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

        <h1 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight mb-4">Privacy Policy</h1>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-12">Last updated: July 2026</p>

        <div className="space-y-8 text-muted leading-relaxed">
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Information We Collect</h2>
            <p>When you request an estimate or contact us through this site, we collect the information you provide directly — name, email, phone number, project address, and any project details or images you share with us.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">How We Use Your Information</h2>
            <p>We use your information solely to respond to your inquiry, prepare estimates, schedule site visits, and deliver contracted work. We do not sell or share your data with third-party marketers.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Data Security</h2>
            <p>Project and contact information is stored securely and retained only as long as needed to service your project and meet our legal and licensing obligations.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal information at any time by contacting us at build@cityscapeconstruction.com.</p>
          </section>
          <section>
            <h2 className="font-display font-bold text-xl text-ink mb-2">Contact</h2>
            <p>Questions about this policy can be directed to CityScape Construction at build@cityscapeconstruction.com or +1 (555) 042-1873.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
