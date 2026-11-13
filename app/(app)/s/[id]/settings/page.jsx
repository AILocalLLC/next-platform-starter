import { buyNumber, connectNumber, updateSubaccount } from 'app/(app)/actions';
import { ActionForm } from 'components/app/action-form';
import { TimezoneSelect } from 'components/app/timezone-select';
import { requireSubaccount } from 'lib/auth';
import { formatPhone } from 'lib/stats';

export default async function SettingsPage({ params }) {
    const { id } = await params;
    const { subaccount: s, profile } = await requireSubaccount(id);
    const isAdmin = profile?.role === 'agency_admin';

    return (
        <div className="max-w-3xl space-y-6">
            <div className="card">
                <h2 className="mb-4 font-semibold">Business</h2>
                <ActionForm action={updateSubaccount.bind(null, id)}>
                    <div>
                        <label className="label" htmlFor="name">
                            Business name
                        </label>
                        <input id="name" name="name" defaultValue={s.name} required className="field" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label" htmlFor="business_phone">
                                Business phone
                            </label>
                            <input id="business_phone" name="business_phone" type="tel" defaultValue={s.business_phone || ''} className="field" />
                        </div>
                        <div>
                            <label className="label" htmlFor="website">
                                Website
                            </label>
                            <input id="website" name="website" defaultValue={s.website || ''} className="field" />
                        </div>
                        <div>
                            <label className="label" htmlFor="notify_email">
                                Notification email
                            </label>
                            <input id="notify_email" name="notify_email" type="email" defaultValue={s.notify_email || ''} className="field" />
                        </div>
                        <TimezoneSelect value={s.timezone} />
                    </div>
                </ActionForm>
            </div>

            <div className="card space-y-5">
                <div>
                    <h2 className="font-semibold">AI phone number</h2>
                    <p className="text-sm text-slate-500">
                        {s.twilio_number ? `Connected: ${formatPhone(s.twilio_number)}. Forward your business line here, or give this number out directly.` : 'No number connected yet.'}
                    </p>
                </div>
                {isAdmin ? (
                    <>
                        <ActionForm action={connectNumber.bind(null, id)} submitLabel="Connect" pendingText="Connecting…" className="space-y-2">
                            <label className="label" htmlFor="twilio_number">
                                Use a number already in your Twilio account
                            </label>
                            <input id="twilio_number" name="twilio_number" type="tel" placeholder="+19185551234" className="field" />
                        </ActionForm>
                        <ActionForm action={buyNumber.bind(null, id)} submitLabel="Buy & connect" pendingText="Buying…" className="space-y-2 border-t border-slate-100 pt-5">
                            <label className="label" htmlFor="area_code">
                                Or buy a new local number (billed to your Twilio account)
                            </label>
                            <input id="area_code" name="area_code" inputMode="numeric" maxLength={3} placeholder="Area code, e.g. 918" className="field max-w-[12rem]" />
                        </ActionForm>
                    </>
                ) : (
                    <p className="text-sm text-slate-500">Ask your agency admin to change the phone number.</p>
                )}
            </div>
        </div>
    );
}
