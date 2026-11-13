import { calendarConfigured, createCalendar } from './gcal.js';
import { upsertLead } from './leads.js';
import { appointmentEvent, lookupBookingCalendar, pushAppointmentToCrm } from './crm.js';

// Adds calendar tools to a receptionist turn when the subaccount has a calendar connected.
// `state.contactId` is updated in place so the caller can store it on the call row.
export function bookingContext({ db, subaccount, callId, fallbackPhone, source, state }) {
    if (!calendarConfigured(subaccount)) return { subaccount: { ...subaccount, calendar_enabled: false } };
    const business = createCalendar(subaccount);

    // A caller the CRM has assigned to a team member with their own calendar gets that
    // person's open times; everyone else gets the business calendar. Looked up once per turn.
    let picked = null;
    function pick(phone, email) {
        if (!picked) {
            picked = lookupBookingCalendar({ slug: subaccount.crm_funnel_slug, business: subaccount.twilio_number, phone, email }).then((who) =>
                who ? { cal: createCalendar({ ...subaccount, calendar_id: who.calendarId }), who } : { cal: business, who: null }
            );
        }
        return picked;
    }
    const calendar = {
        settings: business.settings,
        findSlots: async (opts) => (await pick(fallbackPhone)).cal.findSlots(opts)
    };

    async function onBook(input) {
        const phone = input.phone || fallbackPhone;
        if (!phone && !input.email) throw new Error('Ask for a phone number or email first.');
        if (!fallbackPhone) picked = null; // chat: the visitor only now gave their number
        const { cal, who } = await pick(phone, input.email);
        const booked = await cal.book({
            start: input.start,
            // Business first: one Google Calendar can hold several businesses' appointments.
            summary: `${subaccount.name} – ${input.service || 'Estimate'}: ${input.name}`,
            description: [
                `Business: ${subaccount.name}`,
                `Name: ${input.name}`,
                phone && `Phone: ${phone}`,
                input.email && `Email: ${input.email}`,
                input.address && `Address: ${input.address}`,
                input.service && `Service: ${input.service}`,
                input.reason && `Notes: ${input.reason}`,
                'Booked by the AI receptionist.'
            ]
                .filter(Boolean)
                .join('\n')
        });
        state.contactId = await upsertLead(db, {
            subaccountId: subaccount.id,
            contactId: state.contactId,
            lead: { ...input, callback_time: `Booked: ${booked.label}` },
            fallbackPhone,
            source
        });
        if (who) {
            booked.calendarId = who.calendarId;
            booked.assignedToId = who.assignedToId;
        }
        const { error } = await db.from('appointments').insert({
            subaccount_id: subaccount.id,
            contact_id: state.contactId,
            call_id: callId,
            start_at: booked.start,
            end_at: booked.end,
            google_event_id: booked.eventId,
            google_calendar_id: who?.calendarId || null,
            crm_assignee_id: who?.assignedToId || null
        });
        if (error) console.error('appointment insert failed', error);
        // Chats send it to the CRM calendar now. Phone calls send it when the call ends
        // (see finalizeCall), so the caller never waits on the CRM mid-conversation.
        if (source === 'website_chat') await pushAppointmentToCrm(appointmentEvent(subaccount, booked, input, phone));
        return booked;
    }

    return { subaccount: { ...subaccount, calendar_enabled: true }, calendar, onBook };
}
