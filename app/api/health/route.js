export const dynamic = 'force-dynamic';

// Cheap endpoint the keep-warm schedule pings so the first call after a quiet spell isn't slow.
export function GET() {
    return Response.json({ ok: true });
}
