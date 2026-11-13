'use client';

import { useState } from 'react';

// Single-series daily bar chart with hover tooltip. data: [{date: 'YYYY-MM-DD', calls, leads}]
export function BarChart({ data, title = 'Calls per day' }) {
    const [hover, setHover] = useState(null);
    const max = Math.max(1, ...data.map((d) => d.calls));
    const W = 900;
    const H = 150;
    const slot = W / data.length;
    const bar = Math.max(2, slot - 2);
    const label = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const active = hover == null ? null : data[hover];

    return (
        <div className="card">
            <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-slate-500 tabular-nums">
                    {active ? `${label(active.date)}: ${active.calls} calls · ${active.leads} leads` : `Peak ${max} / day`}
                </p>
            </div>
            <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
                <line x1="0" x2={W} y1={H} y2={H} stroke="#e2e8f0" />
                {data.map((d, i) => {
                    const h = d.calls ? Math.max(3, (d.calls / max) * (H - 8)) : 0;
                    return (
                        <g key={d.date} onMouseEnter={() => setHover(i)}>
                            <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" />
                            {h > 0 && <rect x={i * slot + 1} y={H - h} width={bar} height={h} rx="2" fill="var(--brand)" opacity={hover == null || hover === i ? 1 : 0.45} />}
                        </g>
                    );
                })}
                <text x="0" y={H + 15} fontSize="11" fill="#64748b">
                    {label(data[0].date)}
                </text>
                <text x={W} y={H + 15} fontSize="11" fill="#64748b" textAnchor="end">
                    {label(data[data.length - 1].date)}
                </text>
            </svg>
            <details className="mt-2 text-sm text-slate-500">
                <summary className="cursor-pointer">View as table</summary>
                <table className="table-basic mt-2">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Calls</th>
                            <th>Leads</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data
                            .filter((d) => d.calls)
                            .map((d) => (
                                <tr key={d.date}>
                                    <td>{label(d.date)}</td>
                                    <td>{d.calls}</td>
                                    <td>{d.leads}</td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
