export const DAY = 24 * 60 * 60 * 1000;

// Calls per day for the last `days` days (oldest first), bucketed in the given timezone.
export function dailyCounts(calls, days = 30, timeZone = 'America/Chicago', now = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const buckets = new Map();
    for (let i = days - 1; i >= 0; i--) buckets.set(fmt.format(new Date(now.getTime() - i * DAY)), { calls: 0, leads: 0 });
    for (const c of calls) {
        const b = buckets.get(fmt.format(new Date(c.started_at)));
        if (!b) continue;
        b.calls++;
        if (c.lead_captured) b.leads++;
    }
    return [...buckets].map(([date, v]) => ({ date, ...v }));
}

export function summarize(calls) {
    const total = calls.length;
    const leads = calls.filter((c) => c.lead_captured).length;
    const seconds = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0);
    return {
        total,
        leads,
        conversion: total ? Math.round((leads / total) * 100) : 0,
        minutes: Math.round(seconds / 60)
    };
}

export function sinceIso(days, now = new Date()) {
    return new Date(now.getTime() - days * DAY).toISOString();
}

export function formatPhone(p) {
    const d = (p || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return p || '—';
}

export function formatDateTime(iso, timeZone = 'America/Chicago') {
    return new Date(iso).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
