import { updateAccount } from 'app/(app)/actions';
import { ActionForm } from 'components/app/action-form';
import { requireUser } from 'lib/auth';

export const metadata = { title: 'My account' };

export default async function AccountPage() {
    const { user, profile } = await requireUser();
    return (
        <div className="mx-auto max-w-xl">
            <h1 className="mb-6 text-2xl font-bold">My account</h1>
            <div className="card">
                <ActionForm action={updateAccount}>
                    <div>
                        <label className="label">Email</label>
                        <p className="text-sm text-slate-700">{user.email}</p>
                    </div>
                    <div>
                        <label className="label" htmlFor="full_name">
                            Full name
                        </label>
                        <input id="full_name" name="full_name" defaultValue={profile?.full_name || ''} className="field" />
                    </div>
                    <div>
                        <label className="label" htmlFor="password">
                            New password
                        </label>
                        <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" placeholder="Leave blank to keep current" className="field" />
                    </div>
                </ActionForm>
            </div>
        </div>
    );
}
