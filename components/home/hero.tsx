import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, CalendarCheck, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/lib/site-config'

const highlights = [
  { icon: BadgeCheck, label: 'ID & credential verified pandits' },
  { icon: CalendarCheck, label: 'Date, muhurat and samagri guidance' },
  { icon: ShieldCheck, label: 'Secure online payment, clear receipts' },
]

export function Hero() {
  return (
    <section className="border-b border-border bg-secondary/40">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:items-center md:gap-12 md:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
            Serving families across India
          </p>
          <h1 className="mt-5 font-serif text-4xl leading-tight tracking-tight text-accent text-balance md:text-5xl">
            Book a verified pandit for your puja, without the phone calls
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground text-pretty">
            {siteConfig.name} is a marketplace of experienced poojaris. Choose
            your ritual, compare pandits by language, tradition and rate, and
            confirm the booking online — for your home, hall or temple.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/#services">Explore puja services</Link>}
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/#how-it-works">See how it works</Link>}
            />
          </div>

          <ul className="mt-9 flex flex-col gap-3">
            {highlights.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 text-sm text-foreground"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <Image
            src="/images/hero-puja.png"
            alt="A traditional puja altar with brass lamps, marigold garlands and a kalash"
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  )
}
