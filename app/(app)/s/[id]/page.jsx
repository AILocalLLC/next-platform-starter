import Link from 'next/link';
import { BarChart } from 'components/app/bar-chart';
import { CallsTable } from 'components/app/calls-table';
import { Stat } from 'components/app/stat';
import { requireSubaccount } from 'lib/auth';
import { dailyCounts, sinceIso, summarize } from 'lib/stats';

const CALL_COLUMNS = 'id, started_at, ended_at, from_number, summary, lead_captured, duration_seconds';

export default async function SubaccountOverview({ params }) {
    const { id } = await params;
    const { supabase, subaccount } = await requireSubaccount(id);
    const [monthRes, recentRes, contactRes] = await Promise.all([
        supabase.from('calls').select('started_at, lead_captured, duration_seconds').eq('subaccount_id', id).gte('started_at', sinceIso(30)).limit(10000),
        supabase.from('calls').select(CALL_COLUMNS).eq('subaccount_id', id).order('started_at', { ascending: false }).limit(8),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('subaccount_id', id)
    ]);
    const month = monthRes.data ?? [];
    const st = summarize(month);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Calls answered" value={st.total} hint="Last 30 days" />
                <Stat label="Leads captured" value={st.leads} hint={`${st.conversion}% of calls`} />
                <Stat label="AI minutes" value={st.minutes} hint="Last 30 days" />
                <Stat label="Contacts" value={contactRes.count ?? 0} hint="All time" />
            </div>
            <BarChart data={dailyCounts(month, 30, subaccount.timezone)} />
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-semibold">Recent calls</h2>
                    <Link href={`/s/${id}/calls`} className="link text-sm">
                        All calls
                    </Link>
                </div>
                <CallsTable calls={recentRes.data ?? []} subaccountId={id} timeZone={subaccount.timezone} />
            </div>
        </div>
    );
}
