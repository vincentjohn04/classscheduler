/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import ScrollReveal from './ScrollReveal'

const features = [
  {
    number: '01',
    title: 'Plan with confidence',
    description: 'Build faculty schedules with checks designed to prevent overlapping class times.',
  },
  {
    number: '02',
    title: 'Keep control in admin hands',
    description: 'Administrators generate and manage schedules. Faculty can view their own schedule.',
  },
  {
    number: '03',
    title: 'Find what you need quickly',
    description: 'Move between the dashboard, faculty schedule, and curriculum from one clear workspace.',
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbf8f7] text-[#292326]">
      <header className="intro-nav relative z-10 border-b border-[#eee5e4] bg-white/90 backdrop-blur">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8"
        >
          <Link href="/" className="group flex items-center gap-3" aria-label="Chronyx home">
            <img
              src="/chronyx.png"
              alt=""
              className="h-10 w-10 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="text-lg font-bold tracking-tight text-[#41151e]">Chronyx</span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-8">
            <a href="#features" className="hidden text-sm font-medium text-[#695b5e] hover:text-[#5d1a25] sm:inline">
              Features
            </a>
            <Link
              href="/login"
              className="rounded-full bg-[#5d1a25] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#762331] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d1a25]"
            >
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative isolate">
        <div
          aria-hidden="true"
          className="ambient-float pointer-events-none absolute -right-36 -top-20 -z-10 h-[520px] w-[520px] rounded-full bg-[#f2dfe2] opacity-70 blur-3xl"
        />
        <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="max-w-2xl">
            <span className="intro-fade-up inline-flex items-center gap-2 rounded-full border border-[#ead6d9] bg-white px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[#73323e] shadow-sm">
              <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[#b8515c]" />
              A clearer way to plan the week
            </span>
            <h1 className="intro-fade-up intro-delay-1 mt-7 text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-[#2b2023] sm:text-5xl lg:text-6xl">
              Make room for a
              <span className="block text-[#8b3443]">better schedule.</span>
            </h1>
            <p className="intro-fade-up intro-delay-2 mt-6 max-w-xl text-base leading-7 text-[#74676a] sm:text-lg sm:leading-8">
              Chronyx helps administrators organize faculty schedules and gives faculty a simple,
              read-only place to check their classes.
            </p>
            <div className="intro-fade-up intro-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5d1a25] px-6 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(93,26,37,0.2)] hover:-translate-y-0.5 hover:bg-[#762331] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d1a25]"
              >
                Get started
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                >
                  <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a
                href="#features"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#e7d9da] bg-white px-6 text-sm font-semibold text-[#59484c] hover:-translate-y-0.5 hover:border-[#cdaeb3] hover:bg-[#fffdfd]"
              >
                Explore features
              </a>
            </div>
            <p className="intro-fade-up intro-delay-4 mt-5 text-xs leading-relaxed text-[#8b7c7f]">
              Designed for schedule management by administrators and easy schedule viewing by faculty.
            </p>
          </div>

          <div className="intro-card intro-delay-2 relative mx-auto w-full max-w-[500px]">
            <div
              aria-hidden="true"
              className="ambient-glow absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[#efdadd] via-[#f7ecee] to-[#f4edf1] blur-xl"
            />
            <div className="relative rounded-[1.5rem] border border-white bg-white p-4 shadow-[0_24px_70px_rgba(66,30,38,0.16)] transition-shadow duration-300 hover:shadow-[0_28px_80px_rgba(66,30,38,0.2)] sm:p-6">
              <div className="flex items-center justify-between border-b border-[#f0e9e9] pb-4">
                <div>
                  <p className="text-xs font-medium text-[#948286]">YOUR WORKSPACE</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#34282b]">Schedule overview</h2>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8eff1] text-[#803744] transition-transform duration-300 hover:scale-105">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17M8 13h3m-3 3h3m3-3h2m-2 3h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#413438]">Weekly planner</p>
                  <p className="mt-1 text-xs text-[#9b8c8f]">A simple view of the week ahead</p>
                </div>
                <span className="rounded-full bg-[#f6f0f1] px-3 py-1.5 text-[11px] font-semibold text-[#78404a]">
                  Schedule tools
                </span>
              </div>

              <div aria-hidden="true" className="mt-5 grid grid-cols-5 gap-2">
                {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day, index) => (
                  <div
                    key={day}
                    style={{ animationDelay: `${260 + index * 55}ms` }}
                    className={`schedule-slot-enter rounded-lg py-2 text-center text-[10px] font-semibold tracking-wide ${
                      index === 1 ? 'bg-[#5d1a25] text-white shadow-sm' : 'bg-[#faf7f7] text-[#927f83]'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div aria-hidden="true" className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-[10px] font-medium text-[#a28f93]">08:00</span>
                  <span className="h-px flex-1 bg-[#f0e9e9]" />
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <span
                    style={{ animationDelay: '460ms' }}
                    className="schedule-slot-enter col-start-2 rounded-lg border-l-[3px] border-[#9e4b58] bg-[#f8eff1] px-2 py-3 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <span className="block h-1.5 w-3/4 rounded-full bg-[#b87680]" />
                    <span className="mt-2 block h-1 w-1/2 rounded-full bg-[#dec3c7]" />
                  </span>
                  <span
                    style={{ animationDelay: '560ms' }}
                    className="schedule-slot-enter col-start-4 rounded-lg border-l-[3px] border-[#7c7895] bg-[#f1f0f6] px-2 py-3 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <span className="block h-1.5 w-3/4 rounded-full bg-[#88849f]" />
                    <span className="mt-2 block h-1 w-1/2 rounded-full bg-[#cbc9d8]" />
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-12 text-[10px] font-medium text-[#a28f93]">10:00</span>
                  <span className="h-px flex-1 bg-[#f0e9e9]" />
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <span
                    style={{ animationDelay: '660ms' }}
                    className="schedule-slot-enter col-start-1 rounded-lg border-l-[3px] border-[#738a7b] bg-[#eff5f0] px-2 py-3 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <span className="block h-1.5 w-3/4 rounded-full bg-[#829b8a]" />
                    <span className="mt-2 block h-1 w-1/2 rounded-full bg-[#c4d2c8]" />
                  </span>
                  <span
                    style={{ animationDelay: '760ms' }}
                    className="schedule-slot-enter col-start-3 rounded-lg border-l-[3px] border-[#be8a53] bg-[#fbf4e9] px-2 py-3 transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <span className="block h-1.5 w-3/4 rounded-full bg-[#c79760]" />
                    <span className="mt-2 block h-1 w-1/2 rounded-full bg-[#e6d3b8]" />
                  </span>
                </div>
              </div>

              <div
                style={{ animationDelay: '840ms' }}
                className="schedule-slot-enter mt-5 flex items-center gap-2 rounded-xl bg-[#f8f4f3] px-3.5 py-3"
              >
                <span className="check-pop flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#617b67] shadow-sm">
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                    <path d="m5 10 3.2 3.2L15.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="text-xs font-medium text-[#64575a]">Built to help keep schedules organized</p>
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-[#968589]">Illustrative schedule preview</p>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-[#eee5e4] bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <ScrollReveal className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d4a57]">Made for your workflow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#2b2023] sm:text-4xl">
              Less friction, clearer schedules.
            </h2>
          </ScrollReveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((feature, index) => (
              <ScrollReveal key={feature.number} delayMs={index * 110}>
                <article className="group h-full rounded-2xl border border-[#eee5e4] bg-[#fdfbfa] p-6 transition hover:-translate-y-1 hover:border-[#e1c8cc] hover:shadow-[0_12px_30px_rgba(75,35,43,0.07)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7ecee] text-xs font-bold text-[#803744] transition-all duration-300 group-hover:scale-105 group-hover:bg-[#5d1a25] group-hover:text-white">
                    {feature.number}
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-[#34282b]">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#796b6e]">{feature.description}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#fbf8f7]">
        <ScrollReveal>
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-xs text-[#8b7c7f] sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>Chronyx · Academic scheduling made clearer</span>
            <Link
              href="/login"
              className="group inline-flex items-center gap-1 font-semibold text-[#71323d] hover:text-[#5d1a25]"
            >
              Sign in to your account
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        </ScrollReveal>
      </footer>
    </main>
  )
}
