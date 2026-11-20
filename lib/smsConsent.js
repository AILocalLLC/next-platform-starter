// Public text-message consent details for businesses registered (or being registered) for A2P 10DLC texting.
// Each business gets its own page at /sms-consent/<key>; carriers review it with the brand and campaign.
// New Gutters Near Me keeps its original page at /sms-consent (already approved).
export const CONSENT_LINE = "We'll text you a confirmation at this number. Message and data rates may apply, and you can reply STOP to opt out.";

export const SMS_CONSENT = {
    'ai-local': {
        name: 'AI Local',
        legalName: 'AI Local LLC',
        address: '751 Lake Avenue Northeast, Massillon, OH 44646',
        website: 'ailocal.net',
        phone: '(330) 476-7348',
        request: 'ask about our AI receptionist and website services or book a free consultation',
        web: 'or submit a form on ailocal.net that includes the text-message consent checkbox',
        sample: 'Thanks Sam! Your AI Local appointment is booked for Wednesday, October 14 at 9:00 AM. Reply STOP to opt out.',
        privacyUrl: 'https://ailocal.net/privacy',
        termsUrl: 'https://ailocal.net/terms'
    },
    thermal: {
        name: 'Thermal Roofing and Siding',
        legalName: 'Thermal Roofing & Siding Co LTD.',
        address: '114 6th St SW, Massillon, OH 44647',
        website: 'thermalroofing.net',
        phone: '(330) 422-3322',
        request: 'request a free in-home consultation, inspection or roofing and siding service',
        web: 'or submit the free-offers form on thermalroofing.net, which includes the text-message consent checkbox',
        sample: 'Thanks Sam! Your Thermal Roofing and Siding appointment is booked for Wednesday, October 14 at 9:00 AM. Reply STOP to opt out.',
        privacyUrl: 'https://thermalroofing.net/privacy-page',
        termsUrl: 'https://thermalroofing.net/terms'
    }
};
