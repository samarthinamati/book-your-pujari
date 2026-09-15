import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { fullAddress, siteConfig } from '@/lib/site-config'

const policyLinks = [
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refund-policy', label: 'Cancellation & Refund Policy' },
  { href: '/service-delivery', label: 'Shipping & Service Delivery' },
  { href: '/contact', label: 'Contact Us' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-accent text-accent-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <p className="font-serif text-xl tracking-wide">{siteConfig.name}</p>
          <p className="mt-3 text-sm leading-relaxed text-accent-foreground/75">
            {siteConfig.description}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-accent-foreground/60">
            Policies
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {policyLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-accent-foreground/85 underline-offset-4 transition-colors hover:text-accent-foreground hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="max-w-xs">
          <h2 className="text-sm font-medium uppercase tracking-wider text-accent-foreground/60">
            Reach us
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm text-accent-foreground/85">
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <a
                href={`mailto:${siteConfig.email}`}
                className="underline-offset-4 hover:underline"
              >
                {siteConfig.email}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <a
                href={`tel:${siteConfig.phone.replace(/\s/g, '')}`}
                className="underline-offset-4 hover:underline"
              >
                {siteConfig.phone}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <address className="not-italic leading-relaxed">
                {fullAddress}
              </address>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-accent-foreground/15">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-accent-foreground/60">
          <p>
            {`© ${new Date().getFullYear()} ${siteConfig.legalName}. All rights reserved.`}
          </p>
          <p className="mt-1">
            Payments are processed securely by our payment gateway partner. We
            never store your card or banking credentials.
          </p>
        </div>
      </div>
    </footer>
  )
}
