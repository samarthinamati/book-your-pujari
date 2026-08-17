import type { Metadata } from 'next'
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page'
import { fullAddress, siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${siteConfig.name} collects, uses and protects your personal information.`,
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${siteConfig.legalName} ("we", "us") respects your privacy. This policy explains what personal information we collect through the ${siteConfig.name} website and app, why we collect it, how we use and share it, and the choices available to you.`}
    >
      <LegalSection heading="1. Information we collect">
        <LegalList
          items={[
            'Identity and contact details: name, mobile number, email address and the address where the ritual is to be performed.',
            'Booking details: the ritual selected, date and time, language and tradition preferences, and notes you provide to the pandit.',
            'Transaction details: booking amount, payment status, gateway transaction reference and invoices. We do not collect or store your full card number, CVV, UPI PIN or net banking credentials.',
            'Technical data: device type, browser, IP address, approximate location and app usage events, collected to keep the service secure and to improve it.',
            'Communications: messages, call notes and support tickets you exchange with us.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="2. How we use your information">
        <LegalList
          items={[
            'To create and manage your account and to process and confirm your bookings.',
            'To share the minimum necessary details (name, contact number, address, ritual requirements) with the pandit assigned to your booking.',
            'To process payments, issue receipts and handle refunds through our payment gateway partner.',
            'To provide customer support and resolve disputes.',
            'To detect, prevent and investigate fraud, abuse and security incidents.',
            'To send service messages about your booking. Marketing messages are sent only where permitted and you can opt out at any time.',
            'To comply with legal, tax and regulatory obligations.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Legal basis">
        <p>
          We process your information to perform our contract with you (your
          booking), to comply with legal obligations, for our legitimate
          interests in operating and securing the Platform, and with your
          consent where consent is required.
        </p>
      </LegalSection>

      <LegalSection heading="4. Sharing your information">
        <p>We share personal information only as described below:</p>
        <LegalList
          items={[
            'Service Providers (pandits): the details needed to perform your booking.',
            'Payment gateway and banking partners: to process payments and refunds.',
            'Technology service providers: hosting, analytics, communication and customer support tools, bound by confidentiality obligations.',
            'Legal and regulatory authorities: where disclosure is required by law or to protect rights and safety.',
          ]}
        />
        <p>We do not sell your personal information.</p>
      </LegalSection>

      <LegalSection heading="5. Payment security">
        <p>
          Online payments are handled entirely by a PCI-DSS compliant third-party
          payment gateway. Card, UPI and net banking credentials are entered on
          the gateway&apos;s secure interface and are never accessible to us. We
          retain only the transaction reference, amount and status needed for
          accounting and support.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data retention">
        <p>
          We keep booking and transaction records for as long as needed to
          provide the service and to meet legal, tax and accounting
          requirements. Other data is deleted or anonymised when it is no longer
          needed for the purposes described above.
        </p>
      </LegalSection>

      <LegalSection heading="7. Security">
        <p>
          We use encryption in transit, access controls, and internal review
          processes to protect your information. No method of transmission or
          storage is completely secure, so we cannot guarantee absolute
          security.
        </p>
      </LegalSection>

      <LegalSection heading="8. Your rights">
        <LegalList
          items={[
            'Access a copy of the personal information we hold about you.',
            'Ask us to correct inaccurate or incomplete information.',
            'Ask us to delete your account and associated data, subject to records we must retain by law.',
            'Withdraw consent for marketing communications at any time.',
          ]}
        />
        <p>
          {`To exercise any of these rights, write to ${siteConfig.email}. We respond within 30 days.`}
        </p>
      </LegalSection>

      <LegalSection heading="9. Cookies and similar technologies">
        <p>
          We use cookies and similar technologies to keep you signed in,
          remember preferences and understand aggregate usage. You can control
          cookies through your browser settings; disabling them may affect some
          functionality.
        </p>
      </LegalSection>

      <LegalSection heading="10. Children">
        <p>
          The Platform is not intended for use by anyone under 18. We do not
          knowingly collect personal information from children. Bookings made on
          behalf of a family, including children participating in a ritual, must
          be made by an adult.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be
          notified on the Platform or by email, and the updated date at the top
          of this page will change.
        </p>
      </LegalSection>

      <LegalSection heading="12. Grievance officer and contact">
        <p>
          {`For privacy questions, complaints or grievances, contact us at ${siteConfig.email} or ${siteConfig.phone}.`}
        </p>
        <p>{`Postal address: ${fullAddress}.`}</p>
      </LegalSection>
    </LegalPage>
  )
}
