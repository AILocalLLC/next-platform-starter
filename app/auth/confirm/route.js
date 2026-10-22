import { NextResponse } from 'next/server';
import { createClient } from 'lib/supabase/server';

// Handles invite, recovery, and magic-link emails (token_hash flow).
export async function GET(request) {
    const { searchParams, origin } = new URL(request.url);
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next') : '/dashboard';

    if (tokenHash && type) {
        const supabase = await createClient();
        const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
        if (!error) return NextResponse.redirect(`${origin}${type === 'invite' || type === 'recovery' ? '/account' : next}`);
    }
    return NextResponse.redirect(`${origin}/login`);
}
