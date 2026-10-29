export function About() {
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-24 pt-8 sm:px-6 sm:pb-32"
    >
      <div className="border-t border-white/10 pt-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-stone">
          About ResourcX
        </p>

        <h2
          id="about-title"
          className="mx-auto mt-4 max-w-3xl text-balance font-display text-3xl font-medium leading-[1.05] tracking-tight sm:text-5xl"
        >
          Unlocking Capital. Empowering Shared Innovation for Everyone.
        </h2>

        <div className="mx-auto mt-8 max-w-3xl space-y-5 text-pretty text-base leading-relaxed text-white/70">
          <p>
            ResourcX is an open asset and space-sharing platform engineered
            to bridge the gap between underutilized resources and the
            researchers, creators, students, and teams who need them.
          </p>

          <p>
            Across colleges, research centers, laboratories, makerspaces,
            community organizations, and small businesses, high-value
            equipment, specialized fabrication tools, testing devices,
            and workshop facilities can remain idle for extended periods.
            Meanwhile, nearby creators and early-stage teams face
            significant bottlenecks because purchasing or privately
            renting these facilities is too expensive.
          </p>
        </div>
      </div>
    </section>
  )
}