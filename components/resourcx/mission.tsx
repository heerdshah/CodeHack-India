const STATS = [
  { value: '214', label: 'Shared assets' },
  { value: '18', label: 'Departments' },
  { value: '0', label: 'Payments required' },
]

export function Mission() {
  return (
    <section aria-labelledby="mission-title" className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-6 sm:pb-32">
      <div className="grid gap-10 border-t border-white/10 pt-10 md:grid-cols-2 md:gap-16">
        <div>
          <p className="flex items-center gap-3 text-xs uppercase tracking-widest text-stone">
            <span className="text-cream">01</span>
            <span className="h-px w-8 bg-white/20" aria-hidden />
            Mission
          </p>
          <h2 id="mission-title" className="mt-5 text-balance font-display text-3xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            Shared access, accountable by design.
          </h2>
        </div>
        <div className="flex flex-col gap-6 text-pretty text-base leading-relaxed text-white/70">
          <p>
            Millions in equipment sit idle between semesters. ResourcX opens every CNC mill, confocal scope, and sound stage
            on campus to verified members of the institution, matched by role, department, and certification.
          </p>
          <p>
            No credit cards. No rental fees. Every booking is owner-approved, bound by a dual-signed agreement, and
            documented with six-angle inspections before and after use.
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {STATS.map((s) => (
              <div key={s.label}>
                <dd className="font-display text-3xl font-medium text-cream sm:text-4xl">{s.value}</dd>
                <dt className="mt-1 text-xs text-stone">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
