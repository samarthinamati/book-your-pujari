import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Hero } from '@/components/home/hero'
import { Services } from '@/components/home/services'
import { HowItWorks } from '@/components/home/how-it-works'
import { Pricing } from '@/components/home/pricing'
import { Faq } from '@/components/home/faq'
import { siteConfig } from '@/lib/site-config'

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Services />
      <HowItWorks />
      <Pricing />
      <Faq />

      <section className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 md:flex-row md:items-center md:justify-between md:py-20">
          <div className="max-w-xl">
            <h2 className="font-serif text-3xl tracking-tight text-accent text-balance md:text-4xl">
              Not sure which puja or muhurat you need?
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">
              Our team will help you choose the right ritual, timing and pandit.
              Support is available {siteConfig.supportHours}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={
                <a href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}>
                  {`Call ${siteConfig.phone}`}
                </a>
              }
            />
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/contact">Contact us</Link>}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
