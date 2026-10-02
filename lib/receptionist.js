import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-opus-5';
// Phone calls are latency-sensitive: the caller waits in silence for every reply.
export const VOICE_MODEL = 'claude-sonnet-5';

// Server-side refusal fallback is documented for the Opus/Fable line; Sonnet runs without it.
export function modelParams(channel) {
    return channel === 'phone'
        ? { model: VOICE_MODEL }
        : { model: MODEL, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
}
const MAX_TOOL_ROUNDS = 5;

let defaultClient;
function getClient() {
    defaultClient ??= new Anthropic();
    return defaultClient;
}

// Stable per subaccount so the prefix caches across turns. Per-call details go in the first user message.
export function buildSystemPrompt(subaccount, channel = 'phone') {
    const web = channel === 'web';
    return [
        web
            ? `You are the AI assistant for ${subaccount.name}, chatting with a visitor on the business's website.`
            : `You are the AI phone receptionist for ${subaccount.name}. You are speaking with a caller on a live phone call.`,
        web
            ? 'Reply in one to three short, friendly sentences of plain text. No markdown or lists.'
            : 'Your words are converted to speech, so reply in one to three short, natural spoken sentences. No lists, markdown, emojis, or URLs.',
        `Your goals: answer questions using only the business information below, and capture the ${web ? 'visitor' : 'caller'} as a lead (name, ${web ? 'phone or email' : 'best callback number'}, what they need) when they want service, a quote, an appointment, or a callback.`,
        'Never invent prices, availability, or policies that are not in the business information. If you do not know, say someone from the team will follow up.',
        `Once you have their name${web ? ', a phone number or email,' : ''} and reason, call save_lead. Confirm the details back briefly.`,
        web
            ? `If they need a person right away, share the business phone number${subaccount.business_phone ? ` (${subaccount.business_phone})` : ''} if you have it.`
            : 'When the caller is done or says goodbye, give a short friendly goodbye and call end_call.',
        web
            ? ''
            : subaccount.transfer_number
              ? 'If the caller insists on speaking with a person or it is an emergency, tell them you are transferring them and call transfer_call.'
              : 'You cannot transfer calls; offer to take a message instead.',
        subaccount.calendar_enabled
            ? 'To book an appointment, call check_availability and offer two or three of the returned times (use a date if they name a day). Only offer times the tool returned. When they pick one, call book_appointment with that exact start value plus their details. Only say it is booked after book_appointment succeeds; if it fails, offer other times.'
            : 'You cannot book calendar appointments directly yet. If your instructions say to book a time, ask which day and time works best, save it as callback_time, and tell them the team will confirm the exact time by text or call. Never promise a specific slot is reserved.',
        '',
        '<business_information>',
        subaccount.business_info?.trim() || '(none provided)',
        '</business_information>',
        subaccount.instructions?.trim() ? `\n<owner_instructions>\n${subaccount.instructions.trim()}\n</owner_instructions>` : '',
        subaccount.calendar_enabled
            ? '\n<booking>\nThe business calendar is connected. Whenever it is time to schedule (even if the owner instructions say to just ask for a preferred day and time), call check_availability first and offer two or three of the returned times. If they ask for a different day, call check_availability with that date. Book with book_appointment using the exact start value. Do this without announcing that you are checking.\n</booking>'
            : ''
    ].join('\n');
}

export function buildTools(subaccount, channel = 'phone') {
    const tools = [
        {
            name: 'save_lead',
            description:
                "Save the caller as a lead for the business to follow up. Call once you know the caller's name and what they need. Call again to update details if they change.",
            input_schema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: "Caller's full name" },
                    phone: { type: 'string', description: channel === 'web' ? 'Phone number' : 'Best callback number; omit to use the caller ID' },
                    email: { type: 'string' },
                    reason: { type: 'string', description: 'What the caller needs, in one or two sentences' },
                    service: { type: 'string', description: 'Which service they want, if known' },
                    address: { type: 'string', description: 'Full service/property address, if given' },
                    callback_time: { type: 'string', description: 'Preferred appointment or callback day and time, if given' },
                    callback_requested: { type: 'boolean', description: 'True if they asked for a live callback instead of booking' }
                },
                required: ['name', 'reason'],
                additionalProperties: false
            }
        },
        {
            name: 'end_call',
            description: 'Hang up after you have said goodbye.',
            input_schema: { type: 'object', properties: {}, additionalProperties: false }
        }
    ];
    if (subaccount.calendar_enabled) {
        tools.push(
            {
                name: 'check_availability',
                description: 'Get open appointment times from the business calendar. Returns start values and spoken labels.',
                input_schema: {
                    type: 'object',
                    properties: { date: { type: 'string', description: 'Optional day to check, YYYY-MM-DD, in the business time zone' } },
                    additionalProperties: false
                }
            },
            {
                name: 'book_appointment',
                description: 'Book a time returned by check_availability. Also saves the lead.',
                input_schema: {
                    type: 'object',
                    properties: {
                        start: { type: 'string', description: 'Exact start value from check_availability' },
                        name: { type: 'string' },
                        phone: { type: 'string', description: channel === 'web' ? 'Phone number' : 'Callback number; omit to use the caller ID' },
                        email: { type: 'string' },
                        service: { type: 'string' },
                        address: { type: 'string' },
                        reason: { type: 'string', description: 'Short note about the issue' }
                    },
                    required: ['start', 'name', 'reason'],
                    additionalProperties: false
                }
            }
        );
    }
    if (channel === 'web') return tools.filter((t) => t.name !== 'end_call');
    if (subaccount.transfer_number) {
        tools.push({
            name: 'transfer_call',
            description: 'Transfer the caller to a staff member after telling them you are transferring.',
            input_schema: { type: 'object', properties: {}, additionalProperties: false }
        });
    }
    return tools;
}

export function callStartMessage({ from, startedAt, timezone }) {
    const when = new Date(startedAt).toLocaleString('en-US', { timeZone: timezone || 'America/Chicago' });
    return `[Call connected at ${when}. Caller ID: ${from || 'unknown'}.]`;
}

/**
 * Run one caller turn. `messages` is the stored Claude history (append-only).
 * Returns the new history, the text to speak, and what Twilio should do next.
 */
export async function runTurn({ subaccount, messages, callerText, onSaveLead, onBook, calendar, channel = 'phone', client = getClient() }) {
    const history = [...messages, { role: 'user', content: callerText }];
    const system = buildSystemPrompt(subaccount, channel);
    const tools = buildTools(subaccount, channel);
    const spoken = [];
    let action = 'continue';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const request = { max_tokens: 4096, system, tools, messages: history, cache_control: { type: 'ephemeral' }, output_config: { effort: 'low' } };
        let response;
        try {
            response = await client.beta.messages.create({ ...modelParams(channel), ...request });
        } catch (err) {
            // If the fast phone model rejects the request, keep the call alive on the main model.
            if (channel !== 'phone' || !(err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError)) throw err;
            console.error('voice model rejected request, retrying on main model', err.message);
            response = await client.beta.messages.create({ ...modelParams('web'), ...request });
        }

        history.push({ role: 'assistant', content: response.content });

        if (response.stop_reason === 'refusal') {
            spoken.push("I'm sorry, I can't help with that. Someone from the team will follow up with you.");
            break;
        }

        for (const block of response.content) {
            if (block.type === 'text' && block.text.trim()) spoken.push(block.text.trim());
        }

        const toolUses = response.content.filter((b) => b.type === 'tool_use');
        if (response.stop_reason !== 'tool_use' || toolUses.length === 0) break;

        const results = [];
        for (const tool of toolUses) {
            if (tool.name === 'save_lead') {
                try {
                    await onSaveLead(tool.input ?? {});
                    results.push({ type: 'tool_result', tool_use_id: tool.id, content: 'Lead saved.' });
                } catch (err) {
                    results.push({ type: 'tool_result', tool_use_id: tool.id, content: `Could not save: ${err.message}`, is_error: true });
                }
            } else if (tool.name === 'check_availability' && calendar) {
                try {
                    const slots = await calendar.findSlots({ date: tool.input?.date || null });
                    results.push({
                        type: 'tool_result',
                        tool_use_id: tool.id,
                        content: slots.length ? JSON.stringify(slots) : 'No open times found. Offer a callback instead.'
                    });
                } catch (err) {
                    results.push({ type: 'tool_result', tool_use_id: tool.id, content: `Calendar unavailable: ${err.message}. Take their preferred time and offer a callback.`, is_error: true });
                }
            } else if (tool.name === 'book_appointment' && calendar && onBook) {
                try {
                    const booked = await onBook(tool.input ?? {});
                    results.push({ type: 'tool_result', tool_use_id: tool.id, content: `Booked for ${booked.label}.` });
                } catch (err) {
                    results.push({ type: 'tool_result', tool_use_id: tool.id, content: `Not booked: ${err.message}`, is_error: true });
                }
            } else if (tool.name === 'end_call' && channel === 'phone') {
                action = 'hangup';
                results.push({ type: 'tool_result', tool_use_id: tool.id, content: 'Call ending.' });
            } else if (tool.name === 'transfer_call' && subaccount.transfer_number) {
                action = 'transfer';
                results.push({ type: 'tool_result', tool_use_id: tool.id, content: 'Transferring.' });
            } else {
                results.push({ type: 'tool_result', tool_use_id: tool.id, content: 'Unknown tool.', is_error: true });
            }
        }
        history.push({ role: 'user', content: results });

        // Hang-up / transfer: the goodbye was already spoken alongside the tool call.
        if (action !== 'continue') break;
    }

    return { messages: history, reply: spoken.join(' '), action };
}

export async function summarizeCall({ subaccount, transcript, client = getClient() }) {
    if (!transcript?.length) return 'No conversation.';
    const text = transcript.map((t) => `${t.role === 'ai' ? 'Receptionist' : 'Caller'}: ${t.text}`).join('\n');
    const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 2048,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: `Summarize customer conversations (phone calls or website chats) for the owner of ${subaccount.name}. Two or three plain sentences: who it was, what they need, and any follow-up promised.`,
        messages: [{ role: 'user', content: `<transcript>\n${text}\n</transcript>` }]
    });
    if (response.stop_reason === 'refusal') return 'Summary unavailable.';
    return response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim();
}
