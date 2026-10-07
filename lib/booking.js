import { calendarConfigured, createCalendar } from './gcal';
import { upsertLead } from './leads';

// Adds calendar tools to a receptionist turn when the subaccount has a calendar connected.
// `state.contactId` is updated in place so the caller can store it on the call row.
export function bookingContext({ db, subaccount, callId, fallbackPhone, source, state }) {
    if (!calendarConfigured(subaccount)) return { subaccount: { ...subaccount, calendar_enabled: false } };
    const calendar = createCalendar(subaccount);

    async function onBook(input) {
        const phone = input.phone || fallbackPhone;
        if (!phone && !input.email) throw new Error('Ask for a phone number or email first.');
        const booked = await calendar.book({
            start: input.start,
            summary: `${input.service || 'Estimate'}: ${input.name}`,
            description: [
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
        const { error } = await db.from('appointments').insert({
            subaccount_id: subaccount.id,
            contact_id: state.contactId,
            call_id: callId,
            start_at: booked.start,
            end_at: booked.end,
            google_event_id: booked.eventId
        });
        if (error) console.error('appointment insert failed', error);
        return booked;
    }

    return { subaccount: { ...subaccount, calendar_enabled: true }, calendar, onBook };
}
