import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page'
import { fullAddress, siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: `The terms governing the use of ${siteConfig.name} for booking pandits and puja services.`,
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      intro={`These Terms & Conditions ("Terms") govern your use of the ${siteConfig.name} website and mobile application (together, the "Platform"), operated by ${siteConfig.legalName}. By accessing the Platform, creating an account or making a booking, you agree to be bound by these Terms.`}
    >
      <LegalSection heading="1. About us">
        <p>
          {`${siteConfig.legalName} (${siteConfig.entityType}) operates ${siteConfig.name}, an online marketplace that connects users seeking religious and ritual services with independent pandits, poojaris and priests ("Service Providers").`}
        </p>
        <p>{`Registered address: ${fullAddress}.`}</p>
      </LegalSection>

      <LegalSection heading="2. Nature of our service">
        <p>
          We act as a technology platform and facilitator only. The puja, havan
          or ritual is performed by an independent Service Provider, not by
          {` ${siteConfig.legalName}`}. We are not an employer of, or agent for,
          any Service Provider.
        </p>
        <LegalList
          items={[
            'We verify Service Provider identity documents and stated credentials, but we do not guarantee religious outcomes or results of any ritual.',
            'Each Service Provider independently determines the dakshina (fee) they charge for a given ritual.',
            'We facilitate collection of payment on behalf of the Service Provider and remit their share to them.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Eligibility and accounts">
        <LegalList
          items={[
            'You must be at least 18 years of age and legally capable of entering into a binding contract.',
            'You are responsible for the accuracy of the information you provide, including address, date, time and ritual requirements.',
            'You are responsible for keeping your account credentials confidential and for all activity under your account.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Bookings">
        <LegalList
          items={[
            'A booking request becomes a confirmed booking only after successful payment and confirmation from the assigned Service Provider.',
            'The amount displayed before payment is the total payable amount in Indian Rupees (INR), including the Service Provider dakshina, any selected add-ons, platform fee and applicable taxes.',
            'Puja samagri, flowers, prasad and other materials are your responsibility unless you have explicitly purchased a samagri add-on shown at checkout.',
            'You agree to provide a safe, accessible and appropriate space for the ritual to be performed.',
            'Rescheduling is subject to Service Provider availability and to our Cancellation & Refund Policy.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="5. Pricing, payments and taxes">
        <LegalList
          items={[
            'All prices are quoted and charged in Indian Rupees (INR).',
            'Payments are processed by a third-party PCI-DSS compliant payment gateway. We do not store your card numbers, CVV, UPI PIN or net banking credentials.',
            'A platform fee and Goods and Services Tax (GST), where applicable, are itemised before payment.',
            'If a payment fails but is debited from your account, the amount is reversed by the payment gateway or your bank, normally within 5 to 7 working days.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="6. Cancellations and refunds">
        <p>
          Cancellations, rescheduling and refunds are governed by our{' '}
          <Link
            href="/refund-policy"
            className="text-primary underline underline-offset-4"
          >
            Cancellation &amp; Refund Policy
          </Link>
          , which forms part of these Terms.
        </p>
      </LegalSection>

      <LegalSection heading="7. Your responsibilities">
        <LegalList
          items={[
            'Treat Service Providers with respect and do not ask them to perform any act that is unlawful, unsafe or contrary to their stated practice.',
            'Do not attempt to contract with a Service Provider off-platform in order to avoid platform fees for a booking initiated on the Platform.',
            'Do not misuse the Platform, including by submitting false bookings, fraudulent payment instruments or abusive content.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="8. Prohibited use">
        <p>
          You may not use the Platform for any unlawful purpose, to infringe the
          rights of others, to transmit malicious code, to scrape or reverse
          engineer the Platform, or to post content that is defamatory, obscene,
          hateful or that promotes discrimination on the basis of religion,
          caste, gender or any other protected characteristic.
        </p>
      </LegalSection>

      <LegalSection heading="9. Intellectual property">
        <p>
          {`All trademarks, logos, text, graphics, photographs and software on the Platform are owned by ${siteConfig.legalName} or its licensors and may not be copied, modified or distributed without prior written permission.`}
        </p>
      </LegalSection>

      <LegalSection heading="10. Limitation of liability">
        <p>
          To the maximum extent permitted by law, our aggregate liability arising
          out of or relating to any booking is limited to the total amount you
          paid for that booking. We are not liable for indirect, incidental or
          consequential losses, or for the acts or omissions of an independent
          Service Provider beyond our role as facilitator.
        </p>
      </LegalSection>

      <LegalSection heading="11. Indemnity">
        <p>
          {`You agree to indemnify and hold harmless ${siteConfig.legalName}, its officers and employees from any claim, demand, loss or expense arising from your breach of these Terms or your unlawful use of the Platform.`}
        </p>
      </LegalSection>

      <LegalSection heading="12. Suspension and termination">
        <p>
          We may suspend or terminate your access to the Platform if we
          reasonably believe you have breached these Terms, engaged in
          fraudulent activity or created risk or legal exposure for us or our
          Service Providers.
        </p>
      </LegalSection>

      <LegalSection heading="13. Changes to these Terms">
        <p>
          We may update these Terms from time to time. The revised version takes
          effect when published on this page with an updated date. Continued use
          of the Platform after that date constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection heading="14. Governing law and disputes">
        <p>
          {`These Terms are governed by the laws of India. Subject to any applicable consumer protection law, the courts at ${siteConfig.address.city}, ${siteConfig.address.state} shall have exclusive jurisdiction over any dispute arising from these Terms.`}
        </p>
      </LegalSection>

      <LegalSection heading="15. Contact">
        <p>
          {`Questions about these Terms can be sent to ${siteConfig.email} or ${siteConfig.phone}. See our `}
          <Link
            href="/contact"
            className="text-primary underline underline-offset-4"
          >
            Contact Us
          </Link>
          {' page for full details.'}
        </p>
      </LegalSection>
    </LegalPage>
  )
}
