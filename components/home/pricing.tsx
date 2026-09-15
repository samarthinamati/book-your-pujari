import Link from 'next/link'
import { IndianRupee, ReceiptText, Wallet } from 'lucide-react'
import { siteConfig } from '@/lib/site-config'

const points = [
  {
    icon: IndianRupee,
    title: 'The pandit sets the rate',
    body: 'Each poojari lists their own dakshina per ritual. The amount shown on the profile is the amount you pay for their services — we do not mark it up after you choose.',
  },
  {
    icon: Wallet,
    title: 'What the amount covers',
    body: 'The listed rate covers the pandit’s dakshina and performing the vidhi. Puja samagri, flowers, prasad, travel beyond the listed area and any add-on rituals are quoted separately and shown before payment.',
  },
  {
    icon: ReceiptText,
    title: 'Platform fee and taxes',
    body: 'A platform fee and applicable GST are itemised on the payment screen. You always see a full breakdown of the total in INR before you confirm.',
  },
]

export function Pricing() {
  return (
    <section
      id="pricing"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 md:py-20"
    >
      <div className="max-w-2xl">
        <h2 className="font-serif text-3xl tracking-tight text-accent text-balance md:text-4xl">
          Transparent pricing
        </h2>
        <p className="mt-4 leading-relaxed text-muted-foreground text-pretty">
          {`All prices on ${siteConfig.name} are in Indian Rupees (INR). You see the
          final payable amount, itemised, before any payment is made.`}
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {points.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-xl border border-border bg-card p-6"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-serif text-lg text-accent">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-secondary/50 p-6 text-sm leading-relaxed text-muted-foreground">
        <p>
          Payments are collected in INR through a PCI-DSS compliant payment
          gateway. Card, UPI, net banking and wallet options are supported.
          Cancellations and refunds are handled as described in our{' '}
          <Link
            href="/refund-policy"
            className="text-primary underline underline-offset-4"
          >
            Cancellation &amp; Refund Policy
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
