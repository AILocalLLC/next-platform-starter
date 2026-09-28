import Link from 'next/link';
import { BarChart } from 'components/app/bar-chart';
import { Stat } from 'components/app/stat';
import { requireUser } from 'lib/auth';
import { dailyCounts, formatPhone, sinceIso, summarize } from 'lib/stats';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
    const { supabase, profile } = await requireUser();
    const [subRes, callRes] = await Promise.all([
        supabase.from('subaccounts').select('id, name, twilio_number, receptionist_enabled').order('name'),
        supabase.from('calls').select('subaccount_id, started_at, lead_captured, duration_seconds').gte('started_at', sinceIso(30)).limit(10000)
    ]);
    const subaccounts = subRes.data ?? [];
    const calls = callRes.data ?? [];
    const totals = summarize(calls);
    const bySub = new Map(subaccounts.map((s) => [s.id, []]));
    for (const c of calls) bySub.get(c.subaccount_id)?.push(c);
    const isAdmin = profile?.role === 'agency_admin';

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">{isAdmin ? 'Agency dashboard' : 'Dashboard'}</h1>
                {isAdmin && (
                    <Link href="/subaccounts/new" className="btn-brand">
                        New subaccount
                    </Link>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Subaccounts" value={subaccounts.length} />
                <Stat label="Calls answered" value={totals.total} hint="Last 30 days" />
                <Stat label="Leads captured" value={totals.leads} hint={`${totals.conversion}% of calls`} />
                <Stat label="AI minutes" value={totals.minutes} hint="Last 30 days" />
            </div>
            <BarChart data={dailyCounts(calls, 30)} title="Calls per day, all subaccounts" />
            <div className="card overflow-x-auto p-0">
                <table className="table-basic">
                    <thead>
                        <tr>
                            <th>Subaccount</th>
                            <th>Number</th>
                            <th>Receptionist</th>
                            <th className="text-right">Calls (30d)</th>
                            <th className="text-right">Leads (30d)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subaccounts.map((s) => {
                            const st = summarize(bySub.get(s.id));
                            return (
                                <tr key={s.id}>
                                    <td>
                                        <Link href={`/s/${s.id}`} className="link">
                                            {s.name}
                                        </Link>
                                    </td>
                                    <td className="tabular-nums">{s.twilio_number ? formatPhone(s.twilio_number) : <span className="text-slate-400">Not connected</span>}</td>
                                    <td>{s.receptionist_enabled ? 'On' : 'Off'}</td>
                                    <td className="text-right tabular-nums">{st.total}</td>
                                    <td className="text-right tabular-nums">{st.leads}</td>
                                </tr>
                            );
                        })}
                        {!subaccounts.length && (
                            <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-500">
                                    No subaccounts yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
