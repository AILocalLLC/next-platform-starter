import { createSubaccount } from 'app/(app)/actions';
import { ActionForm } from 'components/app/action-form';
import { TimezoneSelect } from 'components/app/timezone-select';
import { requireAdmin } from 'lib/auth';

export const metadata = { title: 'New subaccount' };

export default async function NewSubaccountPage() {
    await requireAdmin();
    return (
        <div className="mx-auto max-w-xl">
            <h1 className="mb-6 text-2xl font-bold">New subaccount</h1>
            <div className="card">
                <ActionForm action={createSubaccount} submitLabel="Create subaccount" pendingText="Creating…">
                    <div>
                        <label className="label" htmlFor="name">
                            Business name
                        </label>
                        <input id="name" name="name" required className="field" />
                    </div>
                    <div>
                        <label className="label" htmlFor="business_phone">
                            Business phone
                        </label>
                        <input id="business_phone" name="business_phone" type="tel" className="field" />
                    </div>
                    <div>
                        <label className="label" htmlFor="website">
                            Website
                        </label>
                        <input id="website" name="website" className="field" />
                    </div>
                    <TimezoneSelect />
                </ActionForm>
            </div>
        </div>
    );
}
