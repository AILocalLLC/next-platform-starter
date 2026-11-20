import Link from 'next/link';
import { Logo } from 'components/app/logo';
import { requireUser } from 'lib/auth';

export default async function AppLayout({ children }) {
    const { supabase, user, profile } = await requireUser();
    const { data: subaccounts } = await supabase.from('subaccounts').select('id, name').order('name');
    const isAdmin = profile?.role === 'agency_admin';

    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <aside className="border-b border-slate-200 bg-white md:w-64 md:shrink-0 md:border-b-0 md:border-r">
                <div className="flex items-center justify-between px-4 py-4">
                    <Logo href="/dashboard" />
                </div>
                <nav className="space-y-1 px-2 pb-4 text-sm">
                    <NavLink href="/dashboard">Dashboard</NavLink>
                    {isAdmin && <NavLink href="/team">Team</NavLink>}
                    <NavLink href="/account">My account</NavLink>
                    <div className="flex items-center justify-between px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <span>Subaccounts</span>
                        {isAdmin && (
                            <Link href="/subaccounts/new" className="text-slate-500 hover:text-slate-900" title="New subaccount">
                                + New
                            </Link>
                        )}
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto">
                        {subaccounts?.map((s) => (
                            <NavLink key={s.id} href={`/s/${s.id}`}>
                                {s.name}
                            </NavLink>
                        ))}
                        {!subaccounts?.length && <p className="px-3 py-1 text-slate-400">None yet</p>}
                    </div>
                </nav>
                <form action="/auth/signout" method="post" className="border-t border-slate-100 px-4 py-3 text-sm">
                    <p className="truncate text-slate-500">{user.email}</p>
                    <button className="mt-1 text-slate-500 hover:text-slate-900 hover:underline">Sign out</button>
                </form>
            </aside>
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
        </div>
    );
}

function NavLink({ href, children }) {
    return (
        <Link href={href} className="block truncate rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100">
            {children}
        </Link>
    );
}
