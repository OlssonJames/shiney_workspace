import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  BookOpen,
  CheckCircle2,
  NotebookPen,
  CalendarClock,
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  ShieldCheck,
  Award,
  Clock,
  Briefcase,
  Dumbbell,
  Swords,
  Code2,
  Sprout,
  Smartphone,
  Flame,
} from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

/* ----------------------------------------------------------------
   Constants
---------------------------------------------------------------- */
const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'The System', href: '#system' },
  { label: 'The Six', href: '#areas' },
  { label: 'How it Works', href: '#process' },
  { label: 'Why Local', href: '#trust' },
]

// Adjust these if you serve the three apps from a different location —
// they assume this site and an `apps/` folder are both served from a
// common root two levels up (e.g. `npx serve` from the parent Desktop folder).
const APP_LINKS = {
  tracker: '../../apps/habit-tracker/index.html',
  notes: '../../apps/notes/index.html',
  planner: '../../apps/calendar/index.html',
}

const AREAS = [
  { id: 'sidehustle', label: 'Side Hustle', icon: Briefcase, color: '#6366F1', text: 'Daily checkbox, notes on what shipped, streak counted the moment you check it off.' },
  { id: 'gym', label: 'Gym', icon: Dumbbell, color: '#F97316', text: 'A simple checkbox and streak — no metrics to overthink, just consistency.' },
  { id: 'bjj', label: 'BJJ', icon: Swords, color: '#14B8A6', text: 'Technique, position, and rolls logged per session — searchable months later.' },
  { id: 'coding', label: 'Coding Practice', icon: Code2, color: '#8B5CF6', text: 'Project tags and what you learned, so a year of practice adds up to a real log.' },
  { id: 'growth', label: 'Personal Growth', icon: Sprout, color: '#EC4899', text: 'A quiet daily reflection field — wins, mindset, one line or ten.' },
  { id: 'screentime', label: 'Screen Time', icon: Smartphone, color: '#0EA5E9', text: 'A number or a checkbox, whichever keeps you honest, without guilt-tripping.' },
]

/* ----------------------------------------------------------------
   Navbar
---------------------------------------------------------------- */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <nav
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
          scrolled ? 'glass shadow-lg shadow-primary/10' : 'bg-transparent'
        } rounded-full px-4 sm:px-6 py-2.5 w-[calc(100%-2rem)] max-w-5xl`}
      >
        <div className="flex items-center justify-between gap-6">
          <a href="#home" className="flex items-center gap-2 group">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary">
              <BookOpen className="h-5 w-5 text-white" strokeWidth={2.4} />
              <span className="absolute inset-0 rounded-full ring-2 ring-primary/30 group-hover:ring-primary/50 transition" />
            </span>
            <span className={`font-display font-bold tracking-tight text-lg ${scrolled ? 'text-ink' : 'text-white'} transition-colors`}>
              Ledger
            </span>
          </a>

          <div className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium tracking-tight lift-on-hover ${
                  scrolled ? 'text-ink/70 hover:text-primary' : 'text-white/90 hover:text-white'
                } transition-colors`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <a
            href={APP_LINKS.tracker}
            target="_blank"
            rel="noopener"
            className="hidden lg:inline-flex magnetic-btn items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg shadow-primary/30"
          >
            Open Habit Tracker
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
          </a>

          <button
            onClick={() => setOpen(true)}
            className={`lg:hidden p-2 rounded-full ${scrolled ? 'text-ink' : 'text-white'}`}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </nav>

      <div className={`fixed inset-0 z-[60] transition-all duration-500 lg:hidden ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-deep/90 backdrop-blur-2xl" onClick={() => setOpen(false)} />
        <div className={`absolute top-0 left-0 right-0 bg-background rounded-b-5xl px-6 pt-8 pb-12 transition-transform duration-500 ${open ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex items-center justify-between mb-10">
            <span className="font-display font-bold text-xl text-ink">Ledger</span>
            <button onClick={() => setOpen(false)} className="p-2 rounded-full bg-divider/40">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="font-display text-3xl font-semibold text-ink py-3 border-b border-divider">
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={APP_LINKS.tracker}
            target="_blank"
            rel="noopener"
            onClick={() => setOpen(false)}
            className="mt-8 magnetic-btn flex items-center justify-center gap-2 bg-primary text-white px-6 py-4 rounded-full font-semibold w-full"
          >
            Open Habit Tracker
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </>
  )
}

/* ----------------------------------------------------------------
   Hero
---------------------------------------------------------------- */
function Hero() {
  const heroRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-line-1', { y: 40, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.3 })
      gsap.from('.hero-line-2', { y: 60, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.5 })
      gsap.from('.hero-cta, .hero-meta', { y: 24, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.8, stagger: 0.12 })
    }, heroRef)
    return () => ctx.revert()
  }, [])

  const dotColors = ['#6366F1', '#F97316', '#14B8A6', '#8B5CF6', '#EC4899', '#0EA5E9']

  return (
    <section id="home" ref={heroRef} className="relative min-h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1517971071642-34a2d3ecc9cd?auto=format&fit=crop&w=2400&q=80"
          alt="A dark desk setup at night, planning the day ahead"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-deep/85 via-deep/50 to-primary/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-deep via-deep/30 to-transparent" />
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {dotColors.map((c, i) => (
          <span
            key={c}
            className="absolute h-2 w-2 rounded-full animate-float"
            style={{
              background: c,
              top: `${20 + i * 9}%`,
              right: `${8 + (i % 3) * 6}%`,
              animationDelay: `${i * 0.6}s`,
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center text-center">
        <div className="px-6 sm:px-10 lg:px-16 max-w-4xl">
          <p className="hero-meta font-mono text-xs uppercase tracking-[0.25em] text-white/70 mb-6">
            Local-first personal system
          </p>
          <h1 className="font-display font-extrabold text-white leading-[0.95] tracking-tight">
            <span className="hero-line-1 block text-4xl sm:text-5xl md:text-6xl">One System.</span>
            <span className="hero-line-2 block font-serif italic font-medium text-primary-light text-6xl sm:text-7xl md:text-8xl lg:text-9xl mt-2" style={{ lineHeight: '0.92' }}>
              Six Areas. Every Day.
            </span>
          </h1>

          <p className="hero-meta mx-auto max-w-xl text-white/75 text-base sm:text-lg mt-8 leading-relaxed">
            Ledger connects three tools into one daily loop: plan the day, do the work, track what compounds.
            <span className="text-white"> No accounts, no cloud — just your data, on your machine.</span>
          </p>

          <div className="hero-cta mt-10 flex flex-wrap gap-3 justify-center">
            <a href={APP_LINKS.tracker} target="_blank" rel="noopener" className="magnetic-btn group inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-6 py-3.5 rounded-full shadow-2xl shadow-primary/40">
              <CheckCircle2 className="h-4 w-4" /> Habit Tracker
            </a>
            <a href={APP_LINKS.notes} target="_blank" rel="noopener" className="lift-on-hover inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md text-white border border-white/20 font-medium px-6 py-3.5 rounded-full">
              <NotebookPen className="h-4 w-4" /> Session Notes
            </a>
            <a href={APP_LINKS.planner} target="_blank" rel="noopener" className="lift-on-hover inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-md text-white border border-white/20 font-medium px-6 py-3.5 rounded-full">
              <CalendarClock className="h-4 w-4" /> Day Planner
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 right-6 sm:right-12 hidden md:flex flex-col items-center gap-2 text-white/50">
          <span className="font-mono uppercase text-[10px] tracking-[0.3em]">Scroll</span>
          <div className="h-8 w-px bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   Feature Card 1 — Habit Tracker: streak shuffler
---------------------------------------------------------------- */
function StreakShuffler() {
  const items = [
    { tag: 'BJJ', label: 'Rolled 4 rounds, drilled guard retention', streak: 12 },
    { tag: 'Coding', label: 'Shipped the yearly heatmap view', streak: 8 },
    { tag: 'Side Hustle', label: 'Posted in 2 communities, 4 replies', streak: 5 },
  ]
  const [stack, setStack] = useState(items)

  useEffect(() => {
    const interval = setInterval(() => {
      setStack((prev) => { const next = [...prev]; next.unshift(next.pop()); return next })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative h-44 w-full">
      {stack.map((item, i) => {
        const offset = i
        const total = stack.length
        return (
          <div
            key={item.tag}
            style={{
              transform: `translate(${offset * 14}px, ${offset * 14}px) scale(${1 - offset * 0.05})`,
              zIndex: total - offset,
              opacity: 1 - offset * 0.25,
              transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s ease',
            }}
            className="absolute inset-0 bg-white border border-divider rounded-3xl p-5 shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary-dark bg-primary/10 px-2 py-1 rounded-full">{item.tag}</span>
              <span className="font-mono text-xs text-muted flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" />{item.streak}</span>
            </div>
            <div className="mt-4 font-display text-lg font-semibold text-ink leading-tight">{item.label}</div>
            <div className="mt-3 flex items-center gap-1.5">
              {Array.from({ length: 24 }).map((_, idx) => (
                <span key={idx} className="h-1 w-1 rounded-full" style={{ background: idx < 24 - offset * 6 ? '#6366F1' : '#E4E6EB' }} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------------------
   Feature Card 2 — Session Notes: SIGNATURE ANIMATION
   (six colored particles, one per tracked area, falling into a notebook)
---------------------------------------------------------------- */
function AreasRain() {
  const [statusIdx, setStatusIdx] = useState(0)
  const [count, setCount] = useState(6)

  const statuses = [
    { text: 'BJJ session logged · guard retention', tone: 'primary' },
    { text: 'Coding note added · yearly heatmap', tone: 'accent' },
    { text: 'Side hustle entry · 4 replies today', tone: 'primary' },
    { text: 'All six areas up to date', tone: 'emerald' },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((idx) => {
        const next = (idx + 1) % statuses.length
        if (statuses[next].tone === 'emerald') setCount((c) => c + 1)
        return next
      })
    }, 2300)
    return () => clearInterval(interval)
  }, [])

  // One drop per tracked area — same colors used across the whole app family.
  const drops = [
    { left: '12%', delay: '0.0s', dur: '2.6s', size: 14, color: '#6366F1' },
    { left: '24%', delay: '1.1s', dur: '3.0s', size: 12, color: '#F97316' },
    { left: '38%', delay: '0.5s', dur: '2.8s', size: 15, color: '#14B8A6' },
    { left: '52%', delay: '1.7s', dur: '2.4s', size: 13, color: '#8B5CF6' },
    { left: '66%', delay: '0.8s', dur: '3.1s', size: 14, color: '#EC4899' },
    { left: '80%', delay: '1.9s', dur: '2.7s', size: 12, color: '#0EA5E9' },
  ]
  const ripples = [{ left: '20%', delay: '0.2s' }, { left: '48%', delay: '1.0s' }, { left: '76%', delay: '1.8s' }]

  const status = statuses[statusIdx]
  const toneText = status.tone === 'emerald' ? 'text-emerald-600' : status.tone === 'accent' ? 'text-accent-dark' : 'text-primary-dark'
  const toneDot = status.tone === 'emerald' ? 'bg-emerald-500' : status.tone === 'accent' ? 'bg-accent' : 'bg-primary'

  return (
    <div className="relative h-44 w-full rounded-3xl overflow-hidden border border-primary/15" style={{ background: 'linear-gradient(180deg, #F1F1FB 0%, #E7E7FA 70%, #DEDEF8 100%)' }}>
      <div className="absolute -top-8 -left-6 h-20 w-32 rounded-full bg-white/60 blur-2xl" />
      <div className="absolute top-2 right-10 h-14 w-24 rounded-full bg-white/50 blur-xl" />

      <div className="absolute top-3 left-4 right-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-3.5 w-3.5 text-primary-dark" strokeWidth={2.2} />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary-dark">Session log</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-display font-bold text-sm text-ink tabular-nums">{String(count).padStart(2, '0')}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted">today</span>
        </div>
      </div>

      {/* Notebook spine at top */}
      <svg className="absolute left-3 right-3 top-9 h-5" viewBox="0 0 400 20" preserveAspectRatio="none">
        <rect x="0" y="6" width="400" height="8" rx="4" fill="#6366F1" fillOpacity="0.22" />
        <rect x="0" y="7" width="400" height="2" fill="#4F46E5" fillOpacity="0.4" />
        {[60, 152, 248, 340].map((x) => (
          <g key={x}>
            <rect x={x - 3} y="2" width="6" height="6" rx="1" fill="#4F46E5" />
            <rect x={x - 4} y="13" width="8" height="3" rx="1" fill="#4F46E5" fillOpacity="0.7" />
          </g>
        ))}
      </svg>

      <div className="absolute inset-x-0 top-14 bottom-11 overflow-hidden">
        {drops.map((d, i) => (
          <svg
            key={i}
            className="absolute top-0"
            style={{
              left: d.left, width: `${d.size}px`, height: `${Math.round(d.size * 1.5)}px`,
              animation: `rain-fall ${d.dur} cubic-bezier(0.55,0.05,0.7,0.45) ${d.delay} infinite`,
              filter: `drop-shadow(0 1px 2px ${d.color}55)`, transform: 'translateX(-50%)',
            }}
            viewBox="0 0 24 36"
          >
            <defs>
              <linearGradient id={`drop-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="white" stopOpacity="0.9" />
                <stop offset="50%" stopColor={d.color} />
                <stop offset="100%" stopColor={d.color} />
              </linearGradient>
            </defs>
            <path d="M12 2 C 9 9, 4 17, 4 24 a 8 8 0 0 0 16 0 C 20 17, 15 9, 12 2 Z" fill={`url(#drop-${i})`} />
            <ellipse cx="9" cy="22" rx="2" ry="3.5" fill="white" fillOpacity="0.55" />
          </svg>
        ))}
      </div>

      <svg className="absolute bottom-9 left-3 right-3 h-3" viewBox="0 0 200 12" preserveAspectRatio="none">
        <path d="M 0,6 Q 12.5,2 25,6 T 50,6 T 75,6 T 100,6 T 125,6 T 150,6 T 175,6 T 200,6" fill="none" stroke="#4F46E5" strokeOpacity="0.35" strokeWidth="1.2" />
      </svg>

      <div className="absolute bottom-[34px] left-3 right-3 h-2">
        {ripples.map((r, i) => (
          <span key={i} className="absolute top-0 -translate-x-1/2 rounded-full border border-primary-dark/40" style={{ left: r.left, width: '4px', height: '4px', animation: `rain-ripple 2.4s ease-out ${r.delay} infinite` }} />
        ))}
      </div>

      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`relative h-2 w-2 rounded-full ${toneDot}`} />
          <span key={status.text} className={`font-mono text-[10px] truncate ${toneText}`} style={{ animation: 'rain-fadein 0.35s ease-out' }}>{status.text}</span>
        </div>
      </div>

      <style>{`
        @keyframes rain-fall { 0% { transform: translate(-50%, -10px); opacity: 0; } 12% { opacity: 1; } 82% { opacity: 1; } 100% { transform: translate(-50%, 95px); opacity: 0; } }
        @keyframes rain-ripple { 0% { transform: translateX(-50%) scale(0.4); opacity: 0.9; } 80% { transform: translateX(-50%) scale(3.5); opacity: 0; } 100% { transform: translateX(-50%) scale(3.5); opacity: 0; } }
        @keyframes rain-fadein { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

/* ----------------------------------------------------------------
   Feature Card 3 — Day Planner: drag-to-place demo
---------------------------------------------------------------- */
function BlockDragDemo() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setStep((p) => (p + 1) % 5), 1400)
    return () => clearInterval(interval)
  }, [])

  const blockWidth = step >= 2 ? 150 : 90
  const cursorX = step === 0 ? 20 : step === 1 ? 90 : step >= 2 ? 20 + blockWidth : 20

  return (
    <div className="relative h-44 w-full bg-white border border-divider rounded-3xl p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">6:00 AM — 7:30 AM</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary-dark bg-primary/10 px-2 py-0.5 rounded-full">Drag to place</span>
      </div>

      <div className="relative h-24 bg-background rounded-2xl border border-divider overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="absolute top-0 bottom-0 border-r border-divider/60" style={{ left: `${(i + 1) * 25}%` }} />
        ))}
        <div
          className="absolute top-3 h-[calc(100%-24px)] rounded-xl flex items-center px-3 transition-all duration-500 ease-out"
          style={{ left: `20px`, width: `${blockWidth}px`, background: '#14B8A6', opacity: step === 0 ? 0 : 1 }}
        >
          <span className="font-mono text-[10px] text-white font-bold truncate">Gym</span>
        </div>
      </div>

      <div className="absolute pointer-events-none transition-all duration-500 ease-out" style={{ left: `${44 + cursorX}px`, top: step >= 3 ? '108px' : '96px', opacity: step === 4 ? 0 : 1 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="#1A1A1F" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="mt-3 font-mono text-[10px] text-muted">
        {step === 0 && 'Click and drag to create a block...'}
        {step === 1 && 'Snapping to the nearest 5 minutes...'}
        {step >= 2 && step < 4 && 'Drag the edge to resize...'}
        {step === 4 && 'Block placed ✓'}
      </p>
    </div>
  )
}

/* ----------------------------------------------------------------
   Features Section
---------------------------------------------------------------- */
function Features() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.feature-card', { scrollTrigger: { trigger: sectionRef.current, start: 'top 90%', once: true }, y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.15 })
      gsap.from('.feature-heading > *', { scrollTrigger: { trigger: sectionRef.current, start: 'top 95%', once: true }, y: 30, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  const cards = [
    { eyebrow: '01 / Track', heading: 'Habit Tracker', sub: 'Daily checkboxes, real streaks', text: 'Six areas, one tap each. Current streaks, best streaks, and a full-year heatmap so patterns are impossible to miss.', Component: StreakShuffler, link: APP_LINKS.tracker },
    { eyebrow: '02 / Reflect', heading: 'Session Notes', sub: 'Where the detail actually lives', text: 'Structured logs per area — technique and position for BJJ, project and stack for coding, task and revenue for the side hustle.', Component: AreasRain, link: APP_LINKS.notes },
    { eyebrow: '03 / Plan', heading: 'Day Planner', sub: 'Minute-by-minute, drag to place', text: 'A full day laid out as a timeline. Drag to create a block, drag the edges to resize, drag the whole thing to move it.', Component: BlockDragDemo, link: APP_LINKS.planner },
  ]

  return (
    <section id="system" ref={sectionRef} className="relative py-28 sm:py-40 px-6 sm:px-10 lg:px-16">
      <div className="max-w-7xl mx-auto">
        <div className="feature-heading max-w-3xl mb-16 sm:mb-24">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-primary-dark">╱ The System</span>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-ink mt-4 leading-[1.05] tracking-tight">
            Three tools.
            <span className="block font-serif italic font-medium text-primary-dark mt-1">One loop.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {cards.map((card, idx) => (
            <article key={idx} className="feature-card group relative bg-surface border border-divider rounded-5xl p-7 hover:border-primary/40 transition-colors duration-500 shadow-sm hover:shadow-xl hover:shadow-primary/10">
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{card.eyebrow}</span>
                <a href={card.link} target="_blank" rel="noopener">
                  <ArrowUpRight className="h-5 w-5 text-ink/30 group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" strokeWidth={1.8} />
                </a>
              </div>
              <card.Component />
              <div className="mt-6">
                <h3 className="font-display font-bold text-2xl text-ink leading-tight">{card.heading}</h3>
                <p className="font-serif italic text-primary-dark text-sm mt-1">{card.sub}</p>
                <p className="text-muted text-[15px] mt-4 leading-relaxed">{card.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   CountUp
---------------------------------------------------------------- */
function CountUp({ target, duration = 1800 }) {
  const [count, setCount] = useState(0)
  const elemRef = useRef(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const el = elemRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true
          const startTime = performance.now()
          const animate = (now) => {
            const progress = Math.min((now - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(target * eased))
            if (progress < 1) requestAnimationFrame(animate)
            else setCount(target)
          }
          requestAnimationFrame(animate)
        }
      })
    }, { threshold: 0.35 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])

  return <span ref={elemRef}>{count}</span>
}

/* ----------------------------------------------------------------
   Pillars
---------------------------------------------------------------- */
function Pillars() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } }, { threshold: 0.15 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const pillars = [
    { n: '01', title: 'Local', target: 100, suffix: '%', label: 'your data, your device', desc: 'No account, no server, no analytics. Every byte lives in your own browser storage, exportable anytime.' },
    { n: '02', title: 'Areas', target: 6, suffix: '', label: 'life areas tracked daily', desc: 'Side hustle, gym, BJJ, coding, growth, screen time — one shared schema across all three apps.' },
    { n: '03', title: 'Apps', target: 3, suffix: '', label: 'tools, one loop', desc: 'Plan it in Day Planner, log it in Session Notes, watch the streak grow in Habit Tracker.' },
  ]

  return (
    <section ref={ref} className="relative py-28 sm:py-40 px-6 sm:px-10 lg:px-16 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[44rem] rounded-full bg-primary/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        <div className={`flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16 sm:mb-24 transition-all duration-1000 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="max-w-2xl">
            <span className="inline-block font-mono text-xs uppercase tracking-[0.3em] text-primary-dark mb-5">╱ Three numbers</span>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-ink leading-[1.05] tracking-tight">
              The system,
              <span className="block font-serif italic font-medium text-primary-dark">in three numbers.</span>
            </h2>
          </div>
          <p className="text-muted text-lg leading-relaxed max-w-md lg:text-right">Not a business pitch — just what the system actually is, and where the data lives.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-divider rounded-5xl overflow-hidden border border-divider shadow-xl shadow-primary/5">
          {pillars.map((p, i) => (
            <article key={i} style={{ transitionDelay: visible ? `${i * 150}ms` : '0ms' }} className={`relative bg-surface p-9 sm:p-12 group overflow-hidden transition-all duration-1000 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="flex items-center justify-between mb-10">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{p.n} / {p.title}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover:bg-primary group-hover:scale-150 transition-all duration-500" />
              </div>
              <div className="flex items-end gap-1 leading-none">
                <span className="font-display font-extrabold text-[6rem] sm:text-[8rem] md:text-[9rem] leading-[0.85] text-ink tabular-nums tracking-tight">
                  <CountUp target={p.target} duration={1800 + i * 200} />
                </span>
                <span className="font-serif italic font-medium text-4xl sm:text-5xl md:text-6xl text-primary-dark mb-3 sm:mb-4">{p.suffix}</span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary-dark mt-5">{p.label}</p>
              <p className="text-muted text-[15px] mt-6 leading-relaxed max-w-xs">{p.desc}</p>
              <div className="absolute bottom-0 left-9 right-9 sm:left-12 sm:right-12 h-px bg-divider overflow-hidden">
                <div className="h-full bg-gradient-to-r from-transparent via-primary to-transparent" style={{ animation: `pillar-sweep 4s ease-in-out ${i * 0.4}s infinite` }} />
              </div>
            </article>
          ))}
        </div>
      </div>

      <style>{`@keyframes pillar-sweep { 0% { transform: translateX(-100%); } 50% { transform: translateX(100%); } 100% { transform: translateX(100%); } }`}</style>
    </section>
  )
}

/* ----------------------------------------------------------------
   Protocol — Plan / Do / Reflect
---------------------------------------------------------------- */
function Protocol() {
  const containerRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.protocol-card')
      cards.forEach((card, i) => {
        if (i === cards.length - 1) return
        gsap.to(card, {
          scrollTrigger: { trigger: card, start: 'top top+=100', endTrigger: cards[cards.length - 1], end: 'top top+=120', scrub: 1 },
          scale: 0.92, filter: 'blur(6px) saturate(0.7)', opacity: 0.5, ease: 'none',
        })
      })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  const steps = [
    { num: '01', title: 'Plan', tagline: 'Structure the day, before it happens.', text: 'Open Day Planner the night before or first thing in the morning. Drag blocks into place — down to the minute, snapped clean.', image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80', alt: 'A planner and calendar laid out on a desk', meta: 'Step 1 / Day Planner' },
    { num: '02', title: 'Do', tagline: 'One tap, everywhere it counts.', text: 'Complete a synced block — Side Hustle, Gym, BJJ, Coding, Growth, or Screen Time — and it marks the day done and feeds the streak in Habit Tracker automatically.', image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80', alt: 'A hand writing in an open notebook', meta: 'Step 2 / Habit Tracker' },
    { num: '03', title: 'Reflect', tagline: 'See the pattern, not just the day.', text: 'Log the real detail in Session Notes, then step back — the yearly heatmap and streak stats turn scattered days into a visible pattern.', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80', alt: 'Reviewing notes and data on a laptop', meta: 'Step 3 / Session Notes' },
  ]

  return (
    <section id="process" ref={containerRef} className="relative px-4 sm:px-6 py-20">
      <div className="max-w-7xl mx-auto mb-16 px-2 sm:px-10">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-primary-dark">╱ How it works</span>
        <h2 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-ink mt-4 leading-[1.05] tracking-tight max-w-3xl">
          Three steps.
          <span className="block font-serif italic font-medium text-primary-dark">Every single day.</span>
        </h2>
      </div>

      <div className="space-y-8">
        {steps.map((step, idx) => (
          <article key={idx} className="protocol-card sticky top-24 sm:top-28 mx-auto max-w-6xl bg-gradient-to-br from-surface to-background border border-divider rounded-6xl overflow-hidden shadow-2xl shadow-primary/5">
            <div className="grid lg:grid-cols-5 gap-0 min-h-[60vh] lg:min-h-[70vh]">
              <div className="lg:col-span-3 p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.25em] text-muted">{step.meta}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary-dark bg-primary/10 px-2.5 py-1 rounded-full">Ledger Loop</span>
                </div>
                <div className="my-12">
                  <span className="font-display font-extrabold text-[7rem] sm:text-[10rem] leading-none text-primary/15 -mb-4 block">{step.num}</span>
                  <h3 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl text-ink leading-[1.02] tracking-tight">{step.title}</h3>
                  <p className="font-serif italic text-primary-dark text-2xl sm:text-3xl mt-3">{step.tagline}</p>
                </div>
                <p className="text-muted text-base sm:text-lg leading-relaxed max-w-lg">{step.text}</p>
              </div>
              <div className="lg:col-span-2 relative overflow-hidden min-h-[300px] lg:min-h-full bg-deep">
                <img src={step.image} alt={step.alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-deep/60 via-transparent to-deep/15" />
                <div className="absolute top-5 left-5 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full pl-3 pr-4 py-1.5 shadow-lg">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink">Step {step.num}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   ServicesGrid — the 6 tracked areas
---------------------------------------------------------------- */
function AreasGrid() {
  const ref = useRef(null)
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.area-tile', { scrollTrigger: { trigger: ref.current, start: 'top 90%', once: true }, y: 30, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06 })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section id="areas" ref={ref} className="relative py-24 px-6 sm:px-10 lg:px-16 bg-deep text-white overflow-hidden rounded-t-6xl">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-0 -left-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-14">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-primary">╱ The Six</span>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl mt-4 leading-[1.05] tracking-tight">
              Six areas,
              <span className="block font-serif italic font-medium text-primary">tracked the same way everywhere.</span>
            </h2>
          </div>
          <p className="text-white/60 max-w-md text-base leading-relaxed">Every app in the system reads and writes these same six categories — log it once, see it everywhere.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 rounded-4xl overflow-hidden">
          {AREAS.map((area, i) => {
            const Icon = area.icon
            return (
              <div key={area.id} className="area-tile group bg-deep p-7 sm:p-9 hover:bg-white/[0.02] transition-colors duration-500 relative">
                <div className="flex items-start justify-between mb-6">
                  <div
                    className="h-12 w-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-500"
                    style={{ background: `${area.color}26`, border: `1px solid ${area.color}4D` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: area.color }} strokeWidth={2} />
                  </div>
                  <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="font-display font-bold text-xl sm:text-2xl mb-3">{area.label}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{area.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   Trust Signals — repurposed as differentiators
---------------------------------------------------------------- */
function TrustSignals() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } }, { threshold: 0.15 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const badges = [
    { Icon: ShieldCheck, title: 'No account required', text: 'Open it and start. No sign-up flow, no email capture, nothing to configure before day one.' },
    { Icon: Award, title: 'Shared, not siloed', text: 'All three apps read and write the same six-category schema — log a BJJ session once, see it everywhere.' },
    { Icon: Clock, title: 'Built to last years', text: 'No framework to outgrow, no subscription to lapse — flat local storage, still readable in five years.' },
  ]

  return (
    <section id="trust" ref={ref} className="relative py-14 sm:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-primary-dark">╱ Why local</span>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-ink mt-3 tracking-tight">Not a product. A system.</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {badges.map(({ Icon, title, text }, i) => (
            <div key={i} style={{ transitionDelay: visible ? `${i * 120}ms` : '0ms' }} className={`bg-white border border-divider rounded-4xl p-6 hover:border-primary/40 transition-all duration-700 ease-out shadow-sm ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <Icon className="h-6 w-6 text-primary mb-3" strokeWidth={1.8} />
              <h3 className="font-display font-bold text-lg text-ink mb-1.5">{title}</h3>
              <p className="text-muted text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   Launch — final CTA, replaces the lead-gen contact form
---------------------------------------------------------------- */
function Launch() {
  const apps = [
    { name: 'Habit Tracker', Icon: CheckCircle2, text: 'Six checkboxes, real streaks, a full-year heatmap.', link: APP_LINKS.tracker },
    { name: 'Session Notes', Icon: NotebookPen, text: 'Structured logs for BJJ, coding, and the side hustle.', link: APP_LINKS.notes },
    { name: 'Day Planner', Icon: CalendarClock, text: 'Minute-by-minute drag-and-drop time blocking.', link: APP_LINKS.planner },
  ]

  return (
    <section id="get-started" className="relative py-24 sm:py-32 px-6 sm:px-10 lg:px-16 bg-background">
      <div className="max-w-7xl mx-auto text-center mb-14">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-primary-dark">╱ Ready when you are</span>
        <h2 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-ink mt-4 leading-[1.05] tracking-tight">
          Open the loop.
          <span className="block font-serif italic font-medium text-primary-dark">Pick where you start.</span>
        </h2>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
        {apps.map((app) => (
          <a
            key={app.name}
            href={app.link}
            target="_blank"
            rel="noopener"
            className="magnetic-btn group bg-surface border border-divider rounded-5xl p-8 shadow-sm hover:shadow-xl hover:shadow-primary/10 hover:border-primary/40 transition-all duration-500 flex flex-col items-start"
          >
            <span className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 group-hover:bg-primary transition">
              <app.Icon className="h-5 w-5 text-primary group-hover:text-white transition" />
            </span>
            <h3 className="font-display font-bold text-xl text-ink mb-2">{app.name}</h3>
            <p className="text-muted text-sm leading-relaxed mb-6">{app.text}</p>
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              Open <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------
   Footer
---------------------------------------------------------------- */
function Footer() {
  return (
    <footer className="relative bg-deep text-white rounded-t-6xl mt-12 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-15" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[40rem] rounded-full bg-primary/20 blur-3xl" />

      <div className="relative px-6 sm:px-10 lg:px-16 pt-20 pb-10 max-w-7xl mx-auto">
        <div className="border-b border-white/10 pb-12 mb-12">
          <h2 className="font-display font-extrabold text-5xl sm:text-7xl md:text-8xl leading-[0.92] tracking-tight">
            One System.
            <span className="font-serif italic font-medium text-primary block">Six Areas. Every Day.</span>
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mt-8 gap-6">
            <p className="text-white/50 max-w-md">Ledger — a local-first personal system. No accounts, no cloud, just your data.</p>
            <a href={APP_LINKS.tracker} target="_blank" rel="noopener" className="magnetic-btn inline-flex items-center gap-2 bg-primary text-white font-semibold px-7 py-3.5 rounded-full self-start sm:self-auto">
              Open Habit Tracker
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-9 w-9 rounded-full bg-primary flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" strokeWidth={2.4} />
              </span>
              <span className="font-display font-bold text-lg">Ledger</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              A personal system connecting three local-first tools around six tracked life areas — planned, done, and reflected on in one daily loop.
            </p>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary mb-4">The Six</p>
            <ul className="space-y-2.5">
              {AREAS.map((a) => (
                <li key={a.id}><a href="#areas" className="text-white/65 hover:text-primary transition text-sm">{a.label}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary mb-4">System</p>
            <ul className="space-y-2.5">
              <li><a href={APP_LINKS.tracker} target="_blank" rel="noopener" className="text-white/65 hover:text-primary transition text-sm">Habit Tracker</a></li>
              <li><a href={APP_LINKS.notes} target="_blank" rel="noopener" className="text-white/65 hover:text-primary transition text-sm">Session Notes</a></li>
              <li><a href={APP_LINKS.planner} target="_blank" rel="noopener" className="text-white/65 hover:text-primary transition text-sm">Day Planner</a></li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary mb-4">Info</p>
            <ul className="space-y-2.5">
              <li><Link to="/privacy" className="text-white/65 hover:text-primary transition text-sm">Privacy</Link></li>
              <li><Link to="/terms" className="text-white/65 hover:text-primary transition text-sm">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">System Operational · 3 apps linked</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-white/50 text-xs font-mono">
            <Link to="/privacy" className="hover:text-primary transition">Privacy</Link>
            <Link to="/terms" className="hover:text-primary transition">Terms</Link>
            <span>© 2026 Ledger</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ----------------------------------------------------------------
   App
---------------------------------------------------------------- */
export default function App() {
  useEffect(() => {
    const t1 = setTimeout(() => ScrollTrigger.refresh(), 200)
    const t2 = setTimeout(() => ScrollTrigger.refresh(), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="relative">
      <div className="noise-overlay" />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Pillars />
        <Protocol />
        <AreasGrid />
        <TrustSignals />
        <Launch />
      </main>
      <Footer />
    </div>
  )
}
