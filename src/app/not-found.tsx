import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#07111f]">
      <section className="bg-[#07111f] text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-blue-100">
            Page not found
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-normal sm:text-5xl">
            The requested page could not be found.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">
            The page may have moved, or the address may be incorrect. Use the public website links below to continue.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-bold text-[#07111f] shadow-sm transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              Go to homepage
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/65 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              Contact Torque Empire
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
