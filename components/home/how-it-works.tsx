const steps = [
  {
    title: 'Tell us the ritual and date',
    body: 'Pick the puja, your city, preferred language and tradition (Vedic, Smarta, Vaishnav, regional vidhi) and the date or muhurat window.',
  },
  {
    title: 'Compare pandits and their rates',
    body: 'Every poojari profile shows experience, languages, rituals performed and the dakshina they charge for your selected puja. Nothing is hidden.',
  },
  {
    title: 'Confirm and pay securely',
    body: 'Review the final amount, then pay online through our payment gateway. You get an instant booking confirmation and a receipt by email.',
  },
  {
    title: 'Puja is performed',
    body: 'Your pandit shares the samagri list beforehand and arrives at the agreed time. Support is available before and after the ritual.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y border-border bg-secondary/40"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
        <div className="max-w-2xl">
          <h2 className="font-serif text-3xl tracking-tight text-accent text-balance md:text-4xl">
            How a booking works
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground text-pretty">
            Four steps from choosing a ritual to the pandit at your door.
          </p>
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl border border-border bg-card p-6"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary font-serif text-base text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-4 font-serif text-lg text-accent">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
