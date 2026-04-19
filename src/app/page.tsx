import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-teal-950 via-zinc-900 to-zinc-950 px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] text-white">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-300/90">
          delhi.rent
        </p>
        <h1 className="mt-4 max-w-xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          Check if you&apos;re overpaying rent in Delhi
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-300">
          Open the map — anonymous pins, area medians, and a confidence score on every
          listing. No login. Built for Delhi NCR.
        </p>
      </header>

      <main className="mt-auto flex flex-1 flex-col justify-center gap-4">
        <Link
          href="/map?near=1"
          className="inline-flex w-full max-w-sm items-center justify-center rounded-2xl bg-teal-500 px-6 py-4 text-center text-base font-semibold text-teal-950 shadow-lg shadow-teal-900/40 transition hover:bg-teal-400 active:scale-[0.99]"
        >
          Explore map
        </Link>
        <p className="max-w-sm text-xs text-zinc-400">
          We&apos;ll ask for your location once to zoom to your area (you can deny and
          browse manually).
        </p>
        <Link
          href="/map"
          className="text-sm font-medium text-teal-200/90 underline-offset-4 hover:underline"
        >
          Skip — open map without locating me
        </Link>
      </main>

      <footer className="mt-12 text-[11px] text-zinc-500">
        Crowdsourced data · Not financial or legal advice · Verify before you sign.
      </footer>
    </div>
  );
}
