import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

const PROTECTED = ['/dashboard', '/s/', '/subaccounts', '/team', '/account'];

export async function middleware(request) {
    let response = NextResponse.next({ request });
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return response;

    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            }
        }
    });

    const {
        data: { user }
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    if (!user && PROTECTED.some((p) => path.startsWith(p))) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        return NextResponse.redirect(url);
    }
    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.svg|images/|widget.js|api/voice|api/sms|api/chat).*)']
};
