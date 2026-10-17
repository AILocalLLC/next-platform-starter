import { createSign } from 'node:crypto';

// Google Calendar via a service account. Each business shares its calendar with
// GOOGLE_CLIENT_EMAIL ("Make changes to events") and saves the calendar ID in the app.

const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';

export function calendarConfigured(subaccount) {
    return Boolean(subaccount?.calendar_id && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

let cachedToken = null;

// Accepts the private_key value as pasted into an env var: with or without surrounding quotes,
// literal "\n" sequences, or the BEGIN/END lines left off.
export function normalizePrivateKey(raw) {
    let key = String(raw || '').trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n').trim();
    if (!key.includes('BEGIN')) {
        const body = key.replace(/\s+/g, '');
        key = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
    }
    return `${key}\n`;
}

async function accessToken(fetchImpl = fetch) {
    if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
        iss: process.env.GOOGLE_CLIENT_EMAIL,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600
    })}`;
    const key = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
    const signature = createSign('RSA-SHA256').update(unsigned).sign(key, 'base64url');
    const res = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Google auth failed: ${data.error_description || data.error || res.status}`);
    cachedToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
    return cachedToken.value;
}

async function google(path, body, fetchImpl = fetch) {
    const res = await fetchImpl(`${API}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await accessToken(fetchImpl)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Google Calendar error: ${data.error?.message || res.status}`);
    return data;
}

// ---- Time zone helpers (no dependencies) ----

function tzOffsetMs(utcMs, timeZone) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
            .formatToParts(new Date(utcMs))
            .map((p) => [p.type, Number(p.value)])
    );
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utcMs;
}

// Wall-clock time in `timeZone` -> UTC epoch ms (DST-safe).
export function zonedToUtc(y, m, d, hh, mm, timeZone) {
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    let utc = guess - tzOffsetMs(guess, timeZone);
    utc = guess - tzOffsetMs(utc, timeZone);
    return utc;
}

function localDate(utcMs, timeZone) {
    const p = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
            .formatToParts(new Date(utcMs))
            .map((x) => [x.type, x.value])
    );
    return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
}

export function slotLabel(iso, timeZone) {
    return new Date(iso).toLocaleString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function bookingSettings(s) {
    const hm = (v, def) => (/^\d{1,2}:\d{2}$/.test(v || '') ? v : def).split(':').map(Number);
    return {
        timeZone: s.timezone || 'America/New_York',
        minutes: Math.max(15, Number(s.appointment_minutes) || 60),
        days: String(s.booking_days ?? '1,2,3,4,5')
            .split(',')
            .map((x) => x.trim())
            .filter((x) => /^[0-6]$/.test(x))
            .map(Number),
        start: hm(s.booking_start, '09:00'),
        end: hm(s.booking_end, '17:00'),
        noticeHours: Math.max(0, Number(s.booking_notice_hours ?? 12))
    };
}

/**
 * Open appointment starts (ISO) that don't overlap `busy` ([{start,end}] ISO), within booking hours.
 * Returns up to `perDay` slots on each of the next `maxDays` days that have openings.
 */
export function computeSlots({ busy, settings, now = Date.now(), searchDays = 14, maxDays = 3, perDay = 2, onlyDate = null }) {
    const { timeZone, minutes, days, start, end, noticeHours } = settings;
    const earliest = now + noticeHours * 3600_000;
    const busyMs = busy.map((b) => [Date.parse(b.start), Date.parse(b.end)]);
    const step = minutes * 60_000;
    const today = localDate(now, timeZone);
    const out = [];
    let daysUsed = 0;
    for (let i = 0; i < searchDays && daysUsed < maxDays; i++) {
        const base = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
        const y = base.getUTCFullYear();
        const m = base.getUTCMonth() + 1;
        const d = base.getUTCDate();
        if (!days.includes(base.getUTCDay())) continue;
        if (onlyDate && onlyDate !== `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`) continue;
        const dayEnd = zonedToUtc(y, m, d, end[0], end[1], timeZone);
        let found = 0;
        for (let t = zonedToUtc(y, m, d, start[0], start[1], timeZone); t + step <= dayEnd && found < perDay; t += step) {
            if (t < earliest) continue;
            if (busyMs.some(([bs, be]) => t < be && t + step > bs)) continue;
            out.push(new Date(t).toISOString());
            found++;
        }
        if (found) daysUsed++;
    }
    return out;
}

export function createCalendar(subaccount, fetchImpl = fetch) {
    const settings = bookingSettings(subaccount);
    const calendarId = subaccount.calendar_id;

    async function busyBetween(timeMin, timeMax) {
        const data = await google('/freeBusy', { timeMin, timeMax, timeZone: settings.timeZone, items: [{ id: calendarId }] }, fetchImpl);
        const cal = data.calendars?.[calendarId];
        if (cal?.errors?.length) throw new Error(`Calendar not accessible (${cal.errors[0].reason}). Is it shared with the service account?`);
        return cal?.busy || [];
    }

    // `date` (YYYY-MM-DD, business time zone) narrows the search to one day and lists more times.
    async function findSlots({ date = null, now = Date.now() } = {}) {
        const busy = await busyBetween(new Date(now).toISOString(), new Date(now + 15 * 86400_000).toISOString());
        const opts = date ? { onlyDate: date, perDay: 8, maxDays: 1 } : {};
        return computeSlots({ busy, settings, now, ...opts }).map((start) => ({ start, label: slotLabel(start, settings.timeZone) }));
    }

    async function book({ start, summary, description, now = Date.now() }) {
        const t = Date.parse(start);
        if (Number.isNaN(t)) throw new Error('Invalid time.');
        const { y, m, d } = localDate(t, settings.timeZone);
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        // Re-check against live free/busy right before booking. This narrows, but doesn't fully close, the window
        // for two callers booking the same slot at the same second.
        const busy = await busyBetween(new Date(now).toISOString(), new Date(now + 15 * 86400_000).toISOString());
        const open = computeSlots({ busy, settings, now, onlyDate: dateStr, perDay: 100, maxDays: 1 });
        const iso = new Date(t).toISOString();
        if (!open.includes(iso)) throw new Error('That time is not available. Check availability again and offer other times.');
        const end = new Date(t + settings.minutes * 60_000).toISOString();
        const event = await google(
            `/calendars/${encodeURIComponent(calendarId)}/events`,
            { summary, description, start: { dateTime: iso, timeZone: settings.timeZone }, end: { dateTime: end, timeZone: settings.timeZone } },
            fetchImpl
        );
        return { start: iso, end, label: slotLabel(iso, settings.timeZone), eventId: event.id };
    }

    return { findSlots, book, settings };
}
