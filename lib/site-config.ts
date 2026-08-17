/**
 * SINGLE SOURCE OF TRUTH for business details shown across the website.
 *
 * IMPORTANT (Razorpay activation): every value marked TODO must be replaced with
 * your real, verifiable business details. Razorpay's activation team checks that
 * the business name, address, email and phone on your website match the details
 * submitted in your Razorpay account. Placeholder text is a common rejection reason.
 */
export const siteConfig = {
  name: 'Book Your Poojari',
  tagline: 'Book verified pandits for every ritual',
  description:
    'Book Your Poojari connects families with verified, experienced pandits and poojaris for pujas, havans, weddings and all life-cycle rituals — at home or at a temple.',

  // TODO: replace with your registered/trade business name
  legalName: 'Book Your Poojari',
  // TODO: e.g. 'Sole Proprietorship' | 'Private Limited Company' | 'Partnership'
  entityType: 'Sole Proprietorship',

  // TODO: replace the email and address below with real ones
  email: 'support@bookyourpoojari.com',
  phone: '+91 80888 90537',
  whatsapp: '+91 80888 90537',
  address: {
    line1: 'Building / Street',
    line2: 'Area, Landmark',
    city: 'City',
    state: 'State',
    postalCode: '000000',
    country: 'India',
  },

  supportHours: 'Monday to Sunday, 9:00 AM to 8:00 PM IST',

  // Keep this in sync with the date you actually publish/update the policies.
  policiesUpdatedAt: '31 July 2026',
} as const

export const fullAddress = [
  siteConfig.address.line1,
  siteConfig.address.line2,
  `${siteConfig.address.city}, ${siteConfig.address.state} ${siteConfig.address.postalCode}`,
  siteConfig.address.country,
].join(', ')
