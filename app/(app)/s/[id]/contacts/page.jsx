import { addContact, importContacts } from 'app/(app)/actions';
import { ActionForm } from 'components/app/action-form';
import { requireSubaccount } from 'lib/auth';
import { formatDateTime, formatPhone } from 'lib/stats';

const SOURCES = { ai_receptionist: 'AI call', website_chat: 'Web chat', import: 'Import', manual: 'Manual' };

export default async function ContactsPage({ params, searchParams }) {
    const { id } = await params;
    const { q } = await searchParams;
    const { supabase, subaccount } = await requireSubaccount(id);
    let query = supabase.from('contacts').select('*').eq('subaccount_id', id).order('created_at', { ascending: false }).limit(200);
    if (q) {
        const term = `%${q.replace(/[%,()]/g, '')}%`;
        query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
    }
    const { data } = await query;
    const contacts = data ?? [];

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
                <form className="flex gap-2">
                    <input name="q" defaultValue={q} placeholder="Search name, phone, email" className="field" />
                    <button className="btn-ghost-sm">Search</button>
                </form>
                <div className="card overflow-x-auto p-0">
                    <table className="table-basic">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Tags</th>
                                <th>Source</th>
                                <th>Added</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contacts.map((c) => (
                                <tr key={c.id} title={c.notes || ''}>
                                    <td className="font-medium">{c.name || '—'}</td>
                                    <td className="whitespace-nowrap tabular-nums">{formatPhone(c.phone)}</td>
                                    <td>{c.email || '—'}</td>
                                    <td className="max-w-[12rem] truncate text-slate-600">{c.tags?.join(', ')}</td>
                                    <td>{SOURCES[c.source] || c.source}</td>
                                    <td className="whitespace-nowrap">{formatDateTime(c.created_at, subaccount.timezone)}</td>
                                </tr>
                            ))}
                            {!contacts.length && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-500">
                                        No contacts{q ? ' match your search' : ' yet'}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="space-y-6">
            <div className="card h-fit">
                <h2 className="mb-4 font-semibold">Add contact</h2>
                <ActionForm action={addContact.bind(null, id)} submitLabel="Add contact">
                    <input name="name" placeholder="Name" className="field" />
                    <input name="phone" type="tel" placeholder="Phone" className="field" />
                    <input name="email" type="email" placeholder="Email" className="field" />
                    <textarea name="notes" placeholder="Notes" rows={3} className="field" />
                </ActionForm>
            </div>
            <div className="card h-fit">
                <h2 className="mb-1 font-semibold">Import from CSV</h2>
                <p className="mb-4 text-sm text-slate-500">Go High Level: Contacts → select all → Export. Duplicates (same phone or email) are skipped.</p>
                <ActionForm action={importContacts.bind(null, id)} submitLabel="Import" pendingText="Importing…">
                    <input name="file" type="file" accept=".csv,text/csv" required className="block w-full text-sm" />
                </ActionForm>
            </div>
            </div>
        </div>
    );
}
