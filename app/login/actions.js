'use server';

import { redirect } from 'next/navigation';
import { createClient } from 'lib/supabase/server';

export async function signIn(prevState, formData) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || '')
    });
    if (error) return { error: error.message };
    redirect('/dashboard');
}

export async function sendReset(prevState, formData) {
    const supabase = await createClient();
    const email = String(formData.get('email') || '').trim();
    if (!email) return { error: 'Enter your email first.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.PUBLIC_BASE_URL || ''}/auth/confirm?next=/account`
    });
    if (error) return { error: error.message };
    return { message: 'Check your email for a reset link.' };
}
