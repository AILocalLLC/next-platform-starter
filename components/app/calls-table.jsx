import Link from 'next/link';
import { formatDateTime, formatPhone } from 'lib/stats';

export function CallsTable({ calls, subaccountId, timeZone }) {
    return (
        <div className="card overflow-x-auto p-0">
            <table className="table-basic">
                <thead>
                    <tr>
                        <th>When</th>
                        <th>Caller</th>
                        <th>Summary</th>
                        <th>Lead</th>
                        <th className="text-right">Length</th>
                    </tr>
                </thead>
                <tbody>
                    {calls.map((c) => (
                        <tr key={c.id}>
                            <td className="whitespace-nowrap">
                                <Link href={`/s/${subaccountId}/calls/${c.id}`} className="link">
                                    {formatDateTime(c.started_at, timeZone)}
                                </Link>
                            </td>
                            <td className="whitespace-nowrap tabular-nums">{formatPhone(c.from_number)}</td>
                            <td className="max-w-md truncate text-slate-600">{c.summary || (c.ended_at ? '—' : 'In progress')}</td>
                            <td>{c.lead_captured ? <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Lead</span> : ''}</td>
                            <td className="text-right tabular-nums">{c.duration_seconds != null ? `${Math.floor(c.duration_seconds / 60)}:${String(c.duration_seconds % 60).padStart(2, '0')}` : '—'}</td>
                        </tr>
                    ))}
                    {!calls.length && (
                        <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500">
                                No calls yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
