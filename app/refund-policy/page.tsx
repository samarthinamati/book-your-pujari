import type { Metadata } from 'next'
import { LegalList, LegalPage, LegalSection } from '@/components/legal-page'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Cancellation & Refund Policy',
  description: `Cancellation windows, refund amounts and processing timelines for bookings made on ${siteConfig.name}.`,
}

const slabs = [
  {
    window: 'More than 72 hours before the scheduled puja',
    refund: '100% of the amount paid',
    note: 'Full refund including platform fee.',
  },
  {
    window: '24 to 72 hours before the scheduled puja',
    refund: '75% of the amount paid',
    note: 'Platform fee is retained to cover scheduling and processing costs.',
  },
  {
    window: 'Less than 24 hours before the scheduled puja',
    refund: '50% of the amount paid',
    note: 'The pandit has usually declined other bookings for this slot.',
  },
  {
    window: 'After the puja has started or been completed',
    refund: 'No refund',
    note: 'Quality concerns are handled under the resolution process below.',
  },
]

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Cancellation & Refund Policy"
      intro={`This policy explains how to cancel or reschedule a booking on ${siteConfig.name}, how much is refunded, and how long refunds take to reach you. It forms part of our Terms & Conditions.`}
    >
      <LegalSection heading="1. How to cancel or reschedule">
        <p>
          {`Cancel from your bookings screen in the app, or contact us at ${siteConfig.email} or ${siteConfig.phone}. The time your cancellation request is received determines the refund slab below.`}
        </p>
      </LegalSection>

      <LegalSection heading="2. Cancellation by you">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Refund amounts based on when a booking is cancelled
            </caption>
            <thead className="bg-secondary/60 text-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Cancellation window
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Refund
                </th>
              </tr>
            </thead>
            <tbody>
              {slabs.map((slab) => (
                <tr key={slab.window} className="border-t border-border">
                  <td className="px-4 py-3 align-top text-foreground">
                    {slab.window}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {slab.note}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top font-medium text-foreground">
                    {slab.refund}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Rescheduling more than 48 hours before the scheduled time is free once
          per booking, subject to the pandit&apos;s availability. Later
          rescheduling is treated as a cancellation and rebooking.
        </p>
      </LegalSection>

      <LegalSection heading="3. Cancellation by the pandit or by us">
        <LegalList
          items={[
            'If your assigned pandit becomes unavailable, we offer a replacement pandit of comparable experience at the same rate.',
            'If you do not accept the replacement, or no suitable replacement is available, you receive a 100% refund including the platform fee.',
            'If we cancel a booking for operational reasons, you receive a 100% refund.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. If the pandit does not arrive">
        <p>
          If the pandit fails to arrive and does not perform the ritual, you are
          entitled to a full refund of the amount paid for that booking. Report
          it to us within 24 hours of the scheduled time.
        </p>
      </LegalSection>

      <LegalSection heading="5. Quality concerns and partial refunds">
        <p>
          If a ritual was performed but you believe it was materially incomplete
          or not as described, raise a complaint within 48 hours of the booking
          time with details. We review the case with both parties and may issue
          a full or partial refund, or a credit, based on our findings.
        </p>
      </LegalSection>

      <LegalSection heading="6. Non-refundable amounts">
        <LegalList
          items={[
            'Samagri, flowers, prasad and other physical materials already purchased on your behalf are non-refundable once procured.',
            'Travel costs already incurred by the pandit for long-distance bookings, where the cancellation is made within 24 hours.',
            'Amounts paid directly in cash to a pandit outside the Platform are outside the scope of this policy.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="7. Refund method and timeline">
        <LegalList
          items={[
            'Approved refunds are initiated within 3 working days of approval.',
            'Refunds are credited to the original payment method used for the booking. We cannot refund to a different account or instrument.',
            'After we initiate the refund, your bank or payment provider typically credits the amount within 5 to 7 working days. UPI refunds are often faster.',
            'We share the refund reference number by email so you can trace it with your bank if needed.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="8. Failed and duplicate payments">
        <p>
          If an amount is debited but your booking is not confirmed, or you are
          charged twice for the same booking, the excess amount is refunded in
          full. Such reversals are usually completed within 5 to 7 working days.
        </p>
      </LegalSection>

      <LegalSection heading="9. Contact for refunds">
        <p>
          {`Write to ${siteConfig.email} with your booking ID, or call ${siteConfig.phone} during ${siteConfig.supportHours}. We acknowledge refund requests within 2 working days.`}
        </p>
      </LegalSection>
    </LegalPage>
  )
}
