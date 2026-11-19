/* eslint-disable @next/next/no-img-element */

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Chronyx"
      className="min-h-screen overflow-hidden bg-[#fbf8f7] text-[#292326]"
    >
      <div aria-hidden="true" className="loading-bar-track fixed inset-x-0 top-0 z-50 h-1">
        <div className="loading-bar-indicator" />
      </div>

      <header className="relative z-10 border-b border-[#eee5e4] bg-white/90 backdrop-blur">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8"
        >
          <div className="flex items-center gap-3">
            <img src="/chronyx.png" alt="" className="h-10 w-10 rounded-full object-cover" />
            <span className="text-lg font-bold tracking-tight text-[#41151e]">Chronyx</span>
          </div>
          <div aria-hidden="true" className="flex items-center gap-6">
            <div className="skeleton-shimmer hidden h-4 w-16 rounded sm:block" />
            <div className="skeleton-shimmer h-10 w-24 rounded-full" />
          </div>
        </nav>
      </header>

      <main aria-hidden="true" className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="max-w-2xl">
          <div className="skeleton-shimmer h-7 w-52 rounded-full" />
          <div className="skeleton-shimmer mt-7 h-12 w-4/5 rounded-xl sm:h-14" />
          <div className="skeleton-shimmer mt-3 h-12 w-2/3 rounded-xl sm:h-14" />
          <div className="skeleton-shimmer mt-6 h-5 w-full max-w-xl rounded" />
          <div className="skeleton-shimmer mt-2.5 h-5 w-4/5 max-w-xl rounded" />
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <div className="skeleton-shimmer h-12 w-36 rounded-xl" />
            <div className="skeleton-shimmer h-12 w-40 rounded-xl" />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[500px]">
          <div className="rounded-[1.5rem] border border-white bg-white p-4 shadow-[0_24px_70px_rgba(66,30,38,0.12)] sm:p-6">
            <div className="flex items-center justify-between border-b border-[#f0e9e9] pb-4">
              <div className="space-y-2">
                <div className="skeleton-shimmer h-3 w-28 rounded" />
                <div className="skeleton-shimmer h-5 w-40 rounded" />
              </div>
              <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
            </div>

            <div className="mt-5 grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((day) => (
                <div key={day} className="skeleton-shimmer h-8 rounded-lg" />
              ))}
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-5 gap-2">
                <div className="skeleton-shimmer col-start-2 h-14 rounded-lg" />
                <div className="skeleton-shimmer col-start-4 h-14 rounded-lg" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div className="skeleton-shimmer col-start-1 h-14 rounded-lg" />
                <div className="skeleton-shimmer col-start-3 h-14 rounded-lg" />
              </div>
            </div>

            <div className="skeleton-shimmer mt-5 h-12 w-full rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  )
}
