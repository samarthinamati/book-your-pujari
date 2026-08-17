import type { Metadata } from 'next'
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Shipping & Service Delivery Policy',
  description: `How and when services booked on ${siteConfig.name} are delivered, including areas served and any physical items.`,
}

export default function ServiceDeliveryPage() {
  return (
    <LegalPage
      title="Shipping & Service Delivery Policy"
      intro={`${siteConfig.name} primarily sells services, not physical goods. This policy explains how bookings are fulfilled, where we operate, and how any physical items such as puja samagri are handled.`}
    >
      <LegalSection heading="1. What you are buying">
        <p>
          A booking on {siteConfig.name} is a service: an independent pandit
          performs the selected ritual at the address, date and time confirmed in
          your booking. There is no physical shipment for a standard service
          booking.
        </p>
      </LegalSection>

      <LegalSection heading="2. Confirmation of your order">
        <LegalList
          items={[
            'On successful payment, a booking confirmation with the booking ID, ritual, date, time and pandit details is shown on screen and sent to your registered email and mobile number immediately.',
            'The assigned pandit contacts you at least 24 hours before the scheduled time to confirm arrangements and share the samagri list.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Service delivery timeline">
        <LegalList
          items={[
            'Standard bookings are performed on the date and time slot you selected at checkout.',
            'Same-day and next-day bookings are accepted subject to pandit availability in your area.',
            'The pandit aims to arrive 15 to 30 minutes before the scheduled muhurat to set up.',
            'If an unavoidable delay occurs, the pandit or our support team informs you as early as possible and proposes a revised time.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Areas we serve">
        <p>
          {`We currently operate in selected cities across ${siteConfig.address.country}. Availability is confirmed when you enter your address at booking. For locations outside the pandit's listed service area, an additional travel charge may be shown before payment.`}
        </p>
      </LegalSection>

      <LegalSection heading="5. Online and remote rituals">
        <p>
          Where a ritual is offered online, it is conducted over a video call at
          the scheduled time. The joining link is sent to your registered email
          and mobile number at least 2 hours before the session. A stable
          internet connection at your end is required.
        </p>
      </LegalSection>

      <LegalSection heading="6. Physical items (puja samagri)">
        <LegalList
          items={[
            'Samagri is arranged by you using the list shared by the pandit, unless you purchase a samagri add-on at checkout.',
            'Where a samagri add-on is purchased, the items are procured locally and brought to your address by the pandit or a delivery partner on the day of the puja. No separate courier shipping is involved.',
            'Fresh items such as flowers, fruit and prasad are perishable and are procured as close to the puja time as possible. Exact varieties may vary by local availability.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="7. Your responsibilities for delivery">
        <LegalList
          items={[
            'Provide a complete, accurate address with landmark and a reachable mobile number.',
            'Ensure someone is present at the address at the scheduled time and that the space for the ritual is ready.',
            'Inform us in advance of any building access restrictions, gate passes or parking constraints.',
          ]}
        />
        <p>
          If the pandit cannot deliver the service because the address was
          incorrect or nobody was available, the booking is treated as a
          same-day cancellation by you under our Cancellation &amp; Refund
          Policy.
        </p>
      </LegalSection>

      <LegalSection heading="8. Support">
        <p>
          {`For anything related to fulfilment of a booking, contact ${siteConfig.email} or ${siteConfig.phone} during ${siteConfig.supportHours}.`}
        </p>
      </LegalSection>
    </LegalPage>
  )
}
