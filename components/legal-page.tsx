import type { ReactNode } from 'react'
import { siteConfig } from '@/lib/site-config'

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-14 md:py-20">
      <h1 className="font-serif text-3xl tracking-tight text-accent text-balance md:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {`Last updated: ${siteConfig.policiesUpdatedAt}`}
      </p>
      {intro ? (
        <p className="mt-6 leading-relaxed text-muted-foreground text-pretty">
          {intro}
        </p>
      ) : null}
      <div className="mt-10 flex flex-col gap-8">{children}</div>
    </main>
  )
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="font-serif text-xl text-accent md:text-2xl">{heading}</h2>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5">
      {items.map((item) => (
        <li key={item} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  )
}
