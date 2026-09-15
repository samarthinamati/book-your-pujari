import Image from 'next/image'
import { Clock } from 'lucide-react'
import { siteConfig } from '@/lib/site-config'

const featured = [
  {
    title: 'Griha Pravesh & Vastu Shanti',
    image: '/images/griha-pravesh.png',
    alt: 'Doorway decorated with mango leaves and marigold for a Griha Pravesh ritual',
    duration: '2 – 3 hours',
    range: '₹2,500 – ₹7,000',
    summary:
      'House-warming puja with kalash sthapana, navagraha shanti and havan. Pandit brings the vidhi; samagri list shared in advance.',
  },
  {
    title: 'Vivah & Engagement Sanskar',
    image: '/images/vivah-sanskar.png',
    alt: 'Sacred fire in a copper havan kund during a Hindu wedding ceremony',
    duration: '3 – 6 hours',
    range: '₹8,000 – ₹25,000',
    summary:
      'Complete marriage sanskar including mangal snan, havan, saptapadi and kanyadaan, performed in your family tradition.',
  },
  {
    title: 'Satyanarayan & Monthly Puja',
    image: '/images/satyanarayan.png',
    alt: 'Satyanarayan puja altar with banana leaves, prasad and oil lamps',
    duration: '1.5 – 2.5 hours',
    range: '₹1,800 – ₹5,000',
    summary:
      'Satyanarayan katha, Ganpati puja, Lakshmi puja and other recurring rituals with katha recitation and aarti.',
  },
]

const more = [
  'Namkaran & Annaprasan',
  'Mundan Sanskar',
  'Shraddha & Pind Daan',
  'Navagraha Shanti Havan',
  'Rudrabhishek',
  'Office & Shop Opening Puja',
  'Bhoomi Pujan',
  'Ganpati Sthapana & Visarjan',
  'Durga / Navratri Puja',
  'Katha & Bhagwat Path',
]

export function Services() {
  return (
    <section
      id="services"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 md:py-20"
    >
      <div className="max-w-2xl">
        <h2 className="font-serif text-3xl tracking-tight text-accent text-balance md:text-4xl">
          {`Pujas you can book on ${siteConfig.name}`}
        </h2>
        <p className="mt-4 leading-relaxed text-muted-foreground text-pretty">
          Each pandit on the platform sets their own dakshina for a ritual, so
          you always see the exact rate for the pandit you pick. The ranges
          below are what families typically pay.
        </p>
      </div>

      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {featured.map((item) => (
          <li
            key={item.title}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="relative aspect-3/2">
              <Image
                src={item.image}
                alt={item.alt}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <h3 className="font-serif text-xl text-accent">{item.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                {item.summary}
              </p>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-base font-medium text-foreground">
                  {item.range}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {item.duration}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-xl border border-border bg-secondary/50 p-6">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Also available
        </h3>
        <ul className="mt-4 flex flex-wrap gap-2">
          {more.map((item) => (
            <li
              key={item}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
