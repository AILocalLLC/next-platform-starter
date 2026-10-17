export function toE164(raw) {
    if (!raw) return null;
    const d = raw.replace(/[^\d+]/g, '');
    if (d.startsWith('+')) return d;
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith('1')) return `+${d}`;
    return d || null;
}
