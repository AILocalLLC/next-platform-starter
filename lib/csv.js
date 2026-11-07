import { toE164 } from './phone.js';

// RFC 4180-ish CSV parser (quoted fields, escaped quotes, CRLF, newlines in quotes).
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else field += c;
    }
    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((v) => v.trim()));
}

const COLUMNS = {
    name: ['name', 'full name', 'contact name'],
    first: ['first name', 'firstname', 'first'],
    last: ['last name', 'lastname', 'last'],
    phone: ['phone', 'phone number', 'mobile', 'mobile phone', 'cell'],
    email: ['email', 'email address', 'e-mail'],
    tags: ['tags', 'tag'],
    notes: ['notes', 'note', 'description'],
    company: ['company name', 'company', 'business name'],
    address: ['address', 'address1', 'street address'],
    city: ['city'],
    state: ['state'],
    postal: ['postal code', 'zip', 'zip code']
};

// Map a CSV (e.g. a Go High Level contacts export) to contact rows.
export function csvToContacts(text) {
    const [header, ...data] = parseCsv(text);
    if (!header) return [];
    const norm = header.map((h) => h.trim().toLowerCase());
    const idx = Object.fromEntries(Object.entries(COLUMNS).map(([k, names]) => [k, norm.findIndex((h) => names.includes(h))]));
    const get = (r, k) => (idx[k] >= 0 ? (r[idx[k]] || '').trim() : '');

    return data
        .map((r) => {
            const name = get(r, 'name') || [get(r, 'first'), get(r, 'last')].filter(Boolean).join(' ');
            const address = [get(r, 'address'), get(r, 'city'), get(r, 'state'), get(r, 'postal')].filter(Boolean).join(', ');
            const notes = [get(r, 'company') && `Company: ${get(r, 'company')}`, address && `Address: ${address}`, get(r, 'notes')].filter(Boolean).join('\n');
            return {
                name: name || null,
                phone: toE164(get(r, 'phone')),
                email: get(r, 'email').toLowerCase() || null,
                tags: get(r, 'tags')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                notes: notes || null
            };
        })
        .filter((c) => c.name || c.phone || c.email);
}
