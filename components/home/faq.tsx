import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'How are pandits verified?',
    a: 'Every poojari submits government ID, proof of address and details of the rituals they are trained to perform. We verify these documents and check references before a profile goes live.',
  },
  {
    q: 'Can I get a pandit who speaks my language or follows my tradition?',
    a: 'Yes. Profiles list languages spoken and the sampradaya or regional vidhi each pandit follows, so you can match your family custom.',
  },
  {
    q: 'Who arranges the puja samagri?',
    a: 'By default you arrange the samagri using the list your pandit shares after booking. If you prefer, many pandits offer a samagri arrangement add-on, priced separately and shown before payment.',
  },
  {
    q: 'What if the pandit cannot make it?',
    a: 'We arrange a replacement pandit of similar experience at the same rate. If no suitable replacement is available, you receive a full refund as per our Cancellation & Refund Policy.',
  },
  {
    q: 'Which payment methods can I use?',
    a: 'UPI, credit and debit cards, net banking and popular wallets. Payments are processed by our payment gateway partner; we never see or store your card or banking credentials.',
  },
  {
    q: 'Do you serve my city?',
    a: 'We currently operate in major cities and are expanding continuously. Contact us with your city and ritual and we will confirm availability.',
  },
]

export function Faq() {
  return (
    <section
      id="faq"
      className="scroll-mt-20 border-t border-border bg-secondary/40"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-16 md:py-20">
        <h2 className="font-serif text-3xl tracking-tight text-accent text-balance md:text-4xl">
          Frequently asked questions
        </h2>

        <div className="mt-8 flex flex-col gap-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-border bg-card px-5 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-foreground">
                {item.q}
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
