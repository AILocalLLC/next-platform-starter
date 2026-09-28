import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-opus-5';
const MAX_TOOL_ROUNDS = 4;

let defaultClient;
function getClient() {
    defaultClient ??= new Anthropic();
    return defaultClient;
}

// Stable per subaccount so the prefix caches across turns. Per-call details go in the first user message.
export function buildSystemPrompt(subaccount) {
    return [
        `You are the AI phone receptionist for ${subaccount.name}. You are speaking with a caller on a live phone call.`,
        'Your words are converted to speech, so reply in one to three short, natural spoken sentences. No lists, markdown, emojis, or URLs.',
        'Your goals: answer questions using only the business information below, and capture the caller as a lead (name, best callback number, what they need) when they want service, a quote, an appointment, or a callback.',
        'Never invent prices, availability, or policies that are not in the business information. If you do not know, say someone from the team will follow up.',
        'Once you have the caller\'s name and reason, call save_lead. Confirm the details back to the caller briefly.',
        'When the caller is done or says goodbye, give a short friendly goodbye and call end_call.',
        subaccount.transfer_number
            ? 'If the caller insists on speaking with a person or it is an emergency, tell them you are transferring them and call transfer_call.'
            : 'You cannot transfer calls; offer to take a message instead.',
        '',
        '<business_information>',
        subaccount.business_info?.trim() || '(none provided)',
        '</business_information>',
        subaccount.instructions?.trim() ? `\n<owner_instructions>\n${subaccount.instructions.trim()}\n</owner_instructions>` : ''
    ].join('\n');
}

export function buildTools(subaccount) {
    const tools = [
        {
            name: 'save_lead',
            description:
                "Save the caller as a lead for the business to follow up. Call once you know the caller's name and what they need. Call again to update details if they change.",
            input_schema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: "Caller's full name" },
                    phone: { type: 'string', description: 'Best callback number; omit to use the caller ID' },
                    email: { type: 'string' },
                    reason: { type: 'string', description: 'What the caller needs, in one or two sentences' },
                    callback_time: { type: 'string', description: 'Preferred callback or appointment time, if given' }
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
export async function runTurn({ subaccount, messages, callerText, onSaveLead, client = getClient() }) {
    const history = [...messages, { role: 'user', content: callerText }];
    const system = buildSystemPrompt(subaccount);
    const tools = buildTools(subaccount);
    const spoken = [];
    let action = 'continue';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await client.beta.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system,
            tools,
            messages: history,
            cache_control: { type: 'ephemeral' },
            output_config: { effort: 'low' },
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default'
        });

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
            } else if (tool.name === 'end_call') {
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
        system: `Summarize phone calls for the owner of ${subaccount.name}. Two or three plain sentences: who called, what they need, and any follow-up promised.`,
        messages: [{ role: 'user', content: `<transcript>\n${text}\n</transcript>` }]
    });
    if (response.stop_reason === 'refusal') return 'Summary unavailable.';
    return response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
        .trim();
}
