import type { Metadata } from 'next'
import { Building2, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { fullAddress, siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: `Get in touch with ${siteConfig.name} — email, phone, support hours and registered office address.`,
}

export default function ContactPage() {
  const details = [
    {
      icon: Building2,
      label: 'Business name',
      value: `${siteConfig.legalName} (${siteConfig.entityType})`,
    },
    {
      icon: Mail,
      label: 'Email',
      value: siteConfig.email,
      href: `mailto:${siteConfig.email}`,
    },
    {
      icon: Phone,
      label: 'Phone',
      value: siteConfig.phone,
      href: `tel:${siteConfig.phone.replace(/\s/g, '')}`,
    },
    {
      icon: MapPin,
      label: 'Registered address',
      value: fullAddress,
    },
    {
      icon: Clock,
      label: 'Support hours',
      value: siteConfig.supportHours,
    },
  ]

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-14 md:py-20">
      <h1 className="font-serif text-3xl tracking-tight text-accent text-balance md:text-4xl">
        Contact Us
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground text-pretty">
        {`Reach the ${siteConfig.name} team for help choosing a ritual, booking a pandit, changing a booking, or any billing or refund question.`}
      </p>

      <dl className="mt-10 flex flex-col gap-4">
        {details.map(({ icon: Icon, label, value, href }) => (
          <div
            key={label}
            className="flex items-start gap-4 rounded-xl border border-border bg-card p-5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 leading-relaxed text-foreground">
                {href ? (
                  <a
                    href={href}
                    className="text-primary underline underline-offset-4"
                  >
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          </div>
        ))}
      </dl>

      <section className="mt-10 rounded-xl border border-border bg-secondary/50 p-6">
        <h2 className="font-serif text-xl text-accent">Grievance redressal</h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {`If a concern is not resolved to your satisfaction, escalate it by writing to ${siteConfig.email} with the subject line "Grievance" and your booking ID. We acknowledge grievances within 2 working days and aim to resolve them within 15 working days.`}
        </p>
      </section>
    </main>
  )
}
