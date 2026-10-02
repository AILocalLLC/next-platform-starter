import { testCalendar, updateSubaccount } from 'app/(app)/actions';
import { TestCalendar } from 'components/app/test-calendar';
import { ActionForm } from 'components/app/action-form';
import { requireSubaccount } from 'lib/auth';
import { brand } from 'lib/brand';

const PLACEHOLDER = `Services: gutter installation, gutter guards, repairs, cleaning
Service area: Tulsa, Broken Arrow, Owasso, Jenks
Hours: Mon–Fri 8am–6pm, Sat 9am–1pm
Free estimates: yes, usually within 2 business days
Common questions: ...`;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function ReceptionistPage({ params }) {
    const { id } = await params;
    const { subaccount: s } = await requireSubaccount(id);
    const serviceEmail = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_CLIENT_EMAIL : null;
    const bookDays = String(s.booking_days ?? '1,2,3,4,5').split(',').map(Number);
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const snippet = `<script src="${base}/widget.js" data-account="${s.id}" data-color="${brand.color}" async></script>`;

    return (
        <div className="max-w-3xl space-y-6">
            <div className="card">
                <h2 className="mb-4 font-semibold">Phone receptionist</h2>
                <ActionForm action={updateSubaccount.bind(null, id)}>
                    <input type="hidden" name="receptionist_form" value="1" />
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" name="receptionist_enabled" defaultChecked={s.receptionist_enabled} className="h-4 w-4" />
                        AI receptionist answers calls
                    </label>
                    <div>
                        <label className="label" htmlFor="greeting">
                            Greeting
                        </label>
                        <input id="greeting" name="greeting" defaultValue={s.greeting} required className="field" />
                        <p className="mt-1 text-xs text-slate-500">The first thing callers hear.</p>
                    </div>
                    <div>
                        <label className="label" htmlFor="business_info">
                            Business information
                        </label>
                        <textarea id="business_info" name="business_info" defaultValue={s.business_info} rows={12} placeholder={PLACEHOLDER} className="field font-mono text-xs" />
                        <p className="mt-1 text-xs text-slate-500">Everything the receptionist is allowed to tell callers. It will not make up anything that isn’t here.</p>
                    </div>
                    <div>
                        <label className="label" htmlFor="instructions">
                            Call handling instructions
                        </label>
                        <textarea
                            id="instructions"
                            name="instructions"
                            defaultValue={s.instructions}
                            rows={5}
                            placeholder="e.g. Always ask for the property address. If they mention a leak or storm damage, treat it as urgent."
                            className="field"
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label" htmlFor="transfer_number">
                                Transfer number
                            </label>
                            <input id="transfer_number" name="transfer_number" type="tel" defaultValue={s.transfer_number || ''} className="field" />
                            <p className="mt-1 text-xs text-slate-500">Emergencies and “talk to a human” go here. Leave blank to only take messages.</p>
                        </div>
                        <div>
                            <label className="label" htmlFor="notify_phone">
                                Text new leads to
                            </label>
                            <input id="notify_phone" name="notify_phone" type="tel" defaultValue={s.notify_phone || ''} className="field" />
                            <p className="mt-1 text-xs text-slate-500">Gets an SMS summary after every call with a lead.</p>
                        </div>
                    </div>
                </ActionForm>
            </div>

            <div className="card">
                <h2 className="mb-1 font-semibold">Calendar booking (Google Calendar)</h2>
                <p className="mb-4 text-sm text-slate-500">
                    {serviceEmail ? (
                        <>
                            In Google Calendar, open the calendar’s <b>Settings and sharing</b>, add <b className="break-all">{serviceEmail}</b> under “Share with specific people” with{' '}
                            <b>Make changes to events</b>, then paste the calendar ID below. Leave it blank to turn booking off.
                        </>
                    ) : (
                        'Calendar booking is not set up on this server yet (GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are missing).'
                    )}
                </p>
                <ActionForm action={updateSubaccount.bind(null, id)}>
                    <input type="hidden" name="calendar_form" value="1" />
                    <div>
                        <label className="label" htmlFor="calendar_id">
                            Calendar ID
                        </label>
                        <input id="calendar_id" name="calendar_id" defaultValue={s.calendar_id || ''} placeholder="you@gmail.com" className="field" />
                        <p className="mt-1 text-xs text-slate-500">For your main Gmail calendar this is your Gmail address. Other calendars show it under “Integrate calendar”.</p>
                    </div>
                    <fieldset>
                        <legend className="label">Bookable days</legend>
                        <div className="flex flex-wrap gap-3 text-sm">
                            {DAYS.map((d, i) => (
                                <label key={d} className="flex items-center gap-1">
                                    <input type="checkbox" name="booking_days" value={i} defaultChecked={bookDays.includes(i)} />
                                    {d}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <div className="grid gap-4 sm:grid-cols-4">
                        <div>
                            <label className="label" htmlFor="booking_start">
                                From
                            </label>
                            <input id="booking_start" name="booking_start" type="time" defaultValue={s.booking_start || '09:00'} className="field" />
                        </div>
                        <div>
                            <label className="label" htmlFor="booking_end">
                                Until
                            </label>
                            <input id="booking_end" name="booking_end" type="time" defaultValue={s.booking_end || '17:00'} className="field" />
                        </div>
                        <div>
                            <label className="label" htmlFor="appointment_minutes">
                                Length (min)
                            </label>
                            <input id="appointment_minutes" name="appointment_minutes" type="number" min="15" max="480" defaultValue={s.appointment_minutes || 60} className="field" />
                        </div>
                        <div>
                            <label className="label" htmlFor="booking_notice_hours">
                                Notice (hours)
                            </label>
                            <input id="booking_notice_hours" name="booking_notice_hours" type="number" min="0" max="336" defaultValue={s.booking_notice_hours ?? 12} className="field" />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">Times use this subaccount’s time zone ({s.timezone}). Existing calendar events block those times automatically.</p>
                </ActionForm>
                <TestCalendar action={testCalendar.bind(null, id)} />
            </div>

            <div className="card">
                <h2 className="mb-1 font-semibold">Website chat</h2>
                <p className="mb-4 text-sm text-slate-500">The same AI, as a chat bubble on the business’s website. It uses the business information above and saves leads to Contacts.</p>
                <ActionForm action={updateSubaccount.bind(null, id)}>
                    <input type="hidden" name="chat_form" value="1" />
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" name="chat_enabled" defaultChecked={s.chat_enabled} className="h-4 w-4" />
                        Website chat is on
                    </label>
                    <div>
                        <label className="label" htmlFor="chat_greeting">
                            Chat greeting
                        </label>
                        <input id="chat_greeting" name="chat_greeting" defaultValue={s.chat_greeting} className="field" />
                    </div>
                </ActionForm>
                <div className="mt-5">
                    <p className="label">Paste before &lt;/body&gt; on the website</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-3 text-xs text-slate-100">{snippet}</pre>
                </div>
            </div>
        </div>
    );
}
