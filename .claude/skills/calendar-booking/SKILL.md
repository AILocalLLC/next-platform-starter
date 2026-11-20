---
name: calendar-booking
description: Connect a subaccount's Google Calendar so the AI receptionist offers real open times and books appointments. Use when setting up booking, when Ari asks "what day works" instead of offering times, or when bookings don't appear on the calendar.
---

# Google Calendar booking

Uses one Google service account for every client: `ailocal-calendar@ailocal-405814.iam.gserviceaccount.com`
(Netlify env `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY`; never commit the key). Code: `lib/gcal.js`, `lib/booking.js`.

## Per client
1. Share the calendar with the service account email, permission **Make changes to events**.
   Google Workspace domains: admin.google.com → Apps → Google Workspace → Calendar → Sharing settings →
   External sharing must allow "share all information" (or the share silently fails).
2. App → AI receptionist → Calendar booking: Calendar ID (usually the email address), bookable days, from/until,
   appointment length, minimum notice → Save → **Test calendar** must show open times.

## Behaviour to know
- The AI calls `check_availability` and offers 2–3 returned times; `book_appointment` re-checks free/busy, then creates the event,
  saves the lead, inserts an `appointments` row; the caller gets a text with the time.
- An empty set of bookable days means no booking (not Sunday).
- Not fully race-proof for two bookings in the same second.

## Troubleshooting
- `notFound` / "Calendar not accessible" → not shared, or Workspace external sharing blocked.
- AI not offering times → calendar not connected (`calendarConfigured` false) or Test calendar fails.
