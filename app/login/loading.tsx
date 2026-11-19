/* eslint-disable @next/next/no-img-element */

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading login page"
      className="flex min-h-screen w-full flex-col"
    >
      {/* Top Navbar */}
      <header>
        <nav
          aria-label="Brand"
          className="flex h-14 items-center justify-between bg-[#5D1A25] px-4 py-3 text-white sm:px-6"
        >
          <div className="flex items-center gap-2.5">
            <img src="/chronyx.png" alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            <span className="text-lg font-bold tracking-tight">Chronyx</span>
          </div>
        </nav>
      </header>

      {/* Full-Screen Image Container */}
      <main className="relative flex min-h-[calc(100dvh-3.5rem)] w-full grow items-center justify-center overflow-visible bg-[#fbf8f7] px-4 py-6 md:overflow-hidden md:bg-transparent md:px-6 md:py-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-cover bg-center bg-no-repeat md:block"
          style={{ backgroundImage: "url('/OIP.webp')" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-[#5D1A25] opacity-40 mix-blend-multiply md:block"
        />
        <div aria-hidden="true" className="absolute inset-0 hidden bg-[#5D1A25] opacity-30 md:block" />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-[#5D1A25]/10 backdrop-blur-[1px] md:block"
        />

        {/* Skeletal Auth Card */}
        <section
          aria-hidden="true"
          className="relative flex w-full max-w-md flex-col md:h-[min(78vh,45rem)] md:min-h-[34rem] md:w-[88vw] md:max-w-[54rem] md:flex-row md:overflow-hidden md:rounded-xl md:bg-[#5D1A25] md:shadow-[0_14px_40px_rgba(0,0,0,0.4)]"
        >
          {/* Left Maroon Welcome Panel Skeleton */}
          <div className="hidden w-[40%] flex-col items-center justify-center px-6 py-10 text-center md:flex">
            <div className="skeleton-shimmer-dark mb-5 h-20 w-20 rounded-full" />
            <div className="skeleton-shimmer-dark h-6 w-44 rounded-md" />
            <div className="skeleton-shimmer-dark mt-2.5 h-4 w-36 rounded-md" />
            <div className="skeleton-shimmer-dark mt-12 h-4 w-40 rounded-md" />
            <div className="skeleton-shimmer-dark mt-3 h-10 w-36 rounded-lg" />
          </div>

          {/* Right White Form Panel Skeleton */}
          <div className="relative flex w-full flex-col justify-center overflow-hidden rounded-2xl bg-white px-6 py-7 shadow-[0_12px_35px_rgba(54,24,28,0.12)] sm:px-10 md:w-[60%] md:rounded-xl md:px-12 md:py-9 md:shadow-none">
            <div className="loading-bar-track absolute inset-x-0 top-0 h-1">
              <div className="loading-bar-indicator" />
            </div>

            {/* Mobile Mode Toggle Skeleton */}
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-[#f7f5f4] p-1 md:hidden">
              <div className="skeleton-shimmer h-9 rounded-lg" />
              <div className="skeleton-shimmer h-9 rounded-lg opacity-60" />
            </div>

            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-[#fbf5f6] px-3 py-1 text-xs font-semibold text-[#5D1A25]">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#5D1A25]/25 border-t-[#5D1A25]" />
              <span>Loading Chronyx...</span>
            </div>

            <div className="skeleton-shimmer h-9 w-28 rounded-md" />

            <div className="mt-6 space-y-5">
              <div>
                <div className="skeleton-shimmer h-4 w-14 rounded" />
                <div className="skeleton-shimmer mt-2 h-10 w-full rounded-md" />
              </div>

              <div>
                <div className="skeleton-shimmer h-4 w-20 rounded" />
                <div className="skeleton-shimmer mt-2 h-10 w-full rounded-md" />
              </div>

              <div className="skeleton-shimmer h-4 w-28 rounded" />

              <div className="pt-1">
                <div className="skeleton-shimmer h-10 w-28 rounded-md" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
