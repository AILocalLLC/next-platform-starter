---
name: voice-test-calls
description: Test and tune the AI phone receptionist - read per-turn timings from call transcripts, place scripted test calls through Twilio, and fix pauses, misreadings or booking problems. Use when the owner reports pauses, wrong behaviour on calls, or before go-live.
---

# Voice testing and latency

## Read the last call (no owner input needed)
```bash
S=https://uanvjjibesevskafqhrc.supabase.co/rest/v1
curl -s "$S/calls?select=started_at,transcript&order=started_at.desc&limit=1" | python3 -c "
import sys,json
for c in json.load(sys.stdin):
  for t in c['transcript']:
    tm=t.get('timing') or {}; print('AI' if t['role']=='ai' else 'C ', tm.get('total'), tm.get('ai'), tm.get('tools'), tm.get('rounds'), '|', t['text'])"
```
`timing` = ms on our side per reply (load, AI, tools, rounds). Baseline: ~1s normal replies; calendar replies hide their
extra time behind "One moment while I check the calendar / book that" (`yieldBeforeTools` in `lib/receptionist.js`).

## Scripted test call (paid account only)
Outbound call **from a verified caller ID** (not the AI number itself) to the AI line with inline TwiML of timed `<Pause>`/`<Say>`
caller lines; then read the transcript as above. Book test estimates ≥1 week out and tell the owner to delete them.
On trial accounts this fails (trial preamble waits for a keypress).

## Levers already in place
Phone uses `claude-sonnet-5` at low effort (Opus retry on 400/404); `speechTimeout: '1'`; zips/phones spoken digit by digit
(`lib/speech.js`); voicemail fallback if the AI errors. A robot caller can't judge naturalness - ask the owner for an occasional real call.
