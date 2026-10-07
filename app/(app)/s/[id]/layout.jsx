import Link from 'next/link';
import { requireSubaccount } from 'lib/auth';
import { formatPhone } from 'lib/stats';

const TABS = [
    ['', 'Overview'],
    ['/calls', 'Calls'],
    ['/messages', 'Messages'],
    ['/contacts', 'Contacts'],
    ['/receptionist', 'AI receptionist'],
    ['/settings', 'Settings']
];

export default async function SubaccountLayout({ children, params }) {
    const { id } = await params;
    const { subaccount } = await requireSubaccount(id);
    return (
        <div className="mx-auto max-w-6xl">
            <div className="mb-4">
                <h1 className="text-2xl font-bold">{subaccount.name}</h1>
                <p className="text-sm text-slate-500">
                    {subaccount.twilio_number ? `AI line ${formatPhone(subaccount.twilio_number)}` : 'No AI phone number connected'}
                    {subaccount.receptionist_enabled ? '' : ' · Receptionist off'}
                </p>
            </div>
            <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 text-sm">
                {TABS.map(([path, label]) => (
                    <Link key={label} href={`/s/${id}${path}`} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-slate-600 hover:border-slate-300 hover:text-slate-900">
                        {label}
                    </Link>
                ))}
            </nav>
            {children}
        </div>
    );
}
