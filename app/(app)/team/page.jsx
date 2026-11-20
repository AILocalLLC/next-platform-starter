import { inviteUser, updateMember } from 'app/(app)/actions';
import { ActionForm } from 'components/app/action-form';
import { requireAdmin } from 'lib/auth';

export const metadata = { title: 'Team' };

export default async function TeamPage() {
    const { supabase } = await requireAdmin();
    const [profilesRes, subsRes, membersRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at'),
        supabase.from('subaccounts').select('id, name').order('name'),
        supabase.from('memberships').select('user_id, subaccount_id')
    ]);
    const profiles = profilesRes.data ?? [];
    const subaccounts = subsRes.data ?? [];
    const memberships = membersRes.data ?? [];
    const access = (uid) => new Set(memberships.filter((m) => m.user_id === uid).map((m) => m.subaccount_id));

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <h1 className="text-2xl font-bold">Team</h1>
            <div className="card">
                <h2 className="mb-4 font-semibold">Invite a team member</h2>
                <ActionForm action={inviteUser} submitLabel="Send invite" pendingText="Sending…">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <input name="full_name" placeholder="Full name" className="field" />
                        <input name="email" type="email" required placeholder="Email" className="field" />
                        <RoleSelect />
                    </div>
                    <SubaccountChecks subaccounts={subaccounts} />
                </ActionForm>
            </div>
            {profiles.map((p) => {
                const mine = access(p.id);
                return (
                    <div key={p.id} className="card">
                        <div className="mb-3">
                            <p className="font-medium">{p.full_name || p.email}</p>
                            <p className="text-sm text-slate-500">{p.email}</p>
                        </div>
                        <ActionForm action={updateMember.bind(null, p.id)}>
                            <div className="max-w-xs">
                                <RoleSelect value={p.role} />
                            </div>
                            <SubaccountChecks subaccounts={subaccounts} checked={mine} />
                        </ActionForm>
                    </div>
                );
            })}
        </div>
    );
}

function RoleSelect({ value = 'member' }) {
    return (
        <select name="role" defaultValue={value} className="field" aria-label="Role">
            <option value="member">Member: assigned subaccounts only</option>
            <option value="agency_admin">Agency admin: everything</option>
        </select>
    );
}

function SubaccountChecks({ subaccounts, checked = new Set() }) {
    if (!subaccounts.length) return null;
    return (
        <fieldset>
            <legend className="label">Subaccount access (members)</legend>
            <div className="grid gap-1 sm:grid-cols-3">
                {subaccounts.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="subaccounts" value={s.id} defaultChecked={checked.has(s.id)} />
                        {s.name}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
