import { awaitingReply, callGuard, callStartMessage, closingLine, runTurn, wrapUpLine } from './receptionist.js';
import { bookingContext } from './booking.js';
import { upsertLead } from './leads.js';

const TRANSFER_FALLBACK = "Sorry, I'm having trouble right now. Let me connect you with someone on the team.";
const VOICEMAIL_FALLBACK = "Sorry, I'm having trouble right now. Please leave your name, number, and what you need after the tone, and someone will call you back shortly.";

// One phone turn, shared by both call engines (Twilio <Gather> and ConversationRelay).
// `call` is a calls row joined with its subaccount. Returns what Ari says and what happens next:
// action 'continue' | 'pending' (speak, then run again with resume) | 'hangup' | 'transfer' | 'voicemail'.
// `silent` = how many times in a row the caller said nothing (only when speech is empty).
export async function voiceTurn({ db, call, speech = '', resume = false, silent = 0, loadMs = 0, run = runTurn }) {
    const t0 = Date.now() - loadMs;
    const subaccount = call.subaccounts;
    speech = String(speech || '').trim();

    if (resume && !awaitingReply(call.messages)) return { reply: '', action: 'continue' };
    if (!speech && !resume) {
        if (silent <= 1) return { reply: 'Are you still there?', action: 'continue', silent: true };
        return { reply: `I didn't hear anything, so I'll let you go. ${closingLine(subaccount)}`, action: 'hangup', silent: true };
    }

    const now = new Date().toISOString();
    const transcript = resume ? [...call.transcript] : [...call.transcript, { role: 'caller', text: speech, at: now }];
    const callerText = resume
        ? null
        : call.messages.length
        ? speech
        : `${callStartMessage({ from: call.from_number, startedAt: call.started_at, timezone: subaccount.timezone })}\n` +
          `You already greeted the caller with: "${subaccount.greeting}"\nCaller: ${speech}`;

    const state = { contactId: call.contact_id };
    const onSaveLead = async (lead) => {
        state.contactId = await upsertLead(db, { subaccountId: subaccount.id, contactId: state.contactId, lead, fallbackPhone: call.from_number, source: 'ai_receptionist' });
    };
    const booking = bookingContext({ db, subaccount, callId: call.id, fallbackPhone: call.from_number, source: 'ai_receptionist', state });

    let result;
    const stop = callGuard({ transcript, startedAt: call.started_at });
    if (stop) {
        console.log('call guard', call.id, stop);
        result = { messages: call.messages, reply: wrapUpLine(subaccount, Boolean(state.contactId)), action: 'hangup' };
    } else {
        try {
            result = await run({ ...booking, messages: call.messages, callerText, onSaveLead, yieldBeforeTools: !resume });
        } catch (err) {
            console.error('receptionist turn failed', err);
            // Never drop the caller: hand them to a person if we can, otherwise take a voicemail.
            result = subaccount.transfer_number
                ? { messages: call.messages, reply: TRANSFER_FALLBACK, action: 'transfer' }
                : { messages: call.messages, reply: VOICEMAIL_FALLBACK, action: 'voicemail' };
        }
    }
    if (result.reply && result.action === 'continue' && callGuard({ transcript, nextReply: result.reply })) {
        console.log('call guard', call.id, 'looping');
        result = { ...result, reply: wrapUpLine(subaccount, Boolean(state.contactId)), action: 'hangup' };
    }
    const reply = result.reply || (resume && result.action === 'continue' ? '' : result.action === 'continue' ? 'Sorry, could you say that again?' : closingLine(subaccount));
    const timing = { ...result.timing, load: loadMs, total: Date.now() - t0 };
    console.log('voice turn timing', call.id, JSON.stringify(timing));
    if (reply) transcript.push({ role: 'ai', text: reply, at: new Date().toISOString(), timing });
    await db
        .from('calls')
        .update({ messages: result.messages, transcript, contact_id: state.contactId, lead_captured: Boolean(state.contactId) })
        .eq('id', call.id);

    return { reply, action: result.action, timing };
}
