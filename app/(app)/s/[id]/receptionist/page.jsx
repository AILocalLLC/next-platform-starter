import { updateSubaccount } from 'app/(app)/actions';
import { ActionForm } from 'components/app/action-form';
import { requireSubaccount } from 'lib/auth';
import { brand } from 'lib/brand';

const PLACEHOLDER = `Services: gutter installation, gutter guards, repairs, cleaning
Service area: Tulsa, Broken Arrow, Owasso, Jenks
Hours: Mon–Fri 8am–6pm, Sat 9am–1pm
Free estimates: yes, usually within 2 business days
Common questions: ...`;

export default async function ReceptionistPage({ params }) {
    const { id } = await params;
    const { subaccount: s } = await requireSubaccount(id);
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
