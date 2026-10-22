import { notFound, redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export async function getSession() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { supabase, user: null, profile: null };
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return { supabase, user, profile };
}

export async function requireUser() {
    const session = await getSession();
    if (!session.user) redirect('/login');
    return session;
}

export async function requireAdmin() {
    const session = await requireUser();
    if (session.profile?.role !== 'agency_admin') redirect('/dashboard');
    return session;
}

// RLS decides access: a subaccount the user can't see returns no row -> 404.
export async function requireSubaccount(id) {
    const session = await requireUser();
    const { data: subaccount } = await session.supabase.from('subaccounts').select('*').eq('id', id).maybeSingle();
    if (!subaccount) notFound();
    return { ...session, subaccount };
}
