'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import twilio from 'twilio';
import { requireAdmin, requireSubaccount, requireUser } from 'lib/auth';
import { createAdminClient } from 'lib/supabase/admin';
import { toE164 } from 'lib/phone';

const str = (fd, k) => String(fd.get(k) ?? '').trim();
const opt = (fd, k) => str(fd, k) || null;

function twilioClient() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) throw new Error('Twilio credentials are not configured.');
    return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function webhookUrls() {
    const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
    if (!base) throw new Error('PUBLIC_BASE_URL is not configured.');
    return {
        voiceUrl: `${base}/api/voice/incoming`,
        voiceMethod: 'POST',
        statusCallback: `${base}/api/voice/status`,
        statusCallbackMethod: 'POST'
    };
}

// ---- Subaccounts ----

export async function createSubaccount(prev, fd) {
    const { supabase } = await requireAdmin();
    const name = str(fd, 'name');
    if (!name) return { error: 'Name is required.' };
    const { data, error } = await supabase
        .from('subaccounts')
        .insert({
            name,
            business_phone: toE164(opt(fd, 'business_phone')),
            website: opt(fd, 'website'),
            timezone: str(fd, 'timezone') || 'America/Chicago',
            greeting: `Thanks for calling ${name}! How can I help you today?`
        })
        .select('id')
        .single();
    if (error) return { error: error.message };
    redirect(`/s/${data.id}/receptionist`);
}

export async function updateSubaccount(id, prev, fd) {
    const { supabase } = await requireSubaccount(id);
    const patch = {};
    for (const k of ['name', 'website', 'timezone', 'greeting', 'business_info', 'instructions', 'notify_email']) {
        if (fd.has(k)) patch[k] = str(fd, k);
    }
    for (const k of ['business_phone', 'notify_phone', 'transfer_number']) {
        if (fd.has(k)) patch[k] = toE164(opt(fd, k));
    }
    if (fd.has('receptionist_form')) patch.receptionist_enabled = fd.get('receptionist_enabled') === 'on';
    if (patch.name === '') return { error: 'Name is required.' };
    const { error } = await supabase.from('subaccounts').update(patch).eq('id', id);
    if (error) return { error: error.message };
    revalidatePath(`/s/${id}`, 'layout');
    return { message: 'Saved.' };
}

// Point an existing Twilio number at this app and assign it to the subaccount.
export async function connectNumber(id, prev, fd) {
    await requireAdmin();
    const number = toE164(str(fd, 'twilio_number'));
    if (!number) return { error: 'Enter a phone number.' };
    try {
        const client = twilioClient();
        const [match] = await client.incomingPhoneNumbers.list({ phoneNumber: number, limit: 1 });
        if (!match) return { error: `${number} is not in your Twilio account.` };
        await client.incomingPhoneNumbers(match.sid).update(webhookUrls());
    } catch (err) {
        return { error: err.message };
    }
    const { error } = await createAdminClient().from('subaccounts').update({ twilio_number: number }).eq('id', id);
    if (error) return { error: error.code === '23505' ? 'That number is already assigned to another subaccount.' : error.message };
    revalidatePath(`/s/${id}`, 'layout');
    return { message: `Connected ${number}.` };
}

// Buy a new local number (charges your Twilio account) and connect it.
export async function buyNumber(id, prev, fd) {
    const { supabase } = await requireAdmin();
    const areaCode = str(fd, 'area_code');
    if (!/^\d{3}$/.test(areaCode)) return { error: 'Enter a 3-digit area code.' };
    let number;
    try {
        const client = twilioClient();
        const [available] = await client.availablePhoneNumbers('US').local.list({ areaCode: Number(areaCode), voiceEnabled: true, smsEnabled: true, limit: 1 });
        if (!available) return { error: `No numbers available in ${areaCode}.` };
        const { data: sub } = await supabase.from('subaccounts').select('name').eq('id', id).single();
        const bought = await client.incomingPhoneNumbers.create({ phoneNumber: available.phoneNumber, friendlyName: sub?.name, ...webhookUrls() });
        number = bought.phoneNumber;
    } catch (err) {
        return { error: err.message };
    }
    await createAdminClient().from('subaccounts').update({ twilio_number: number }).eq('id', id);
    revalidatePath(`/s/${id}`, 'layout');
    return { message: `Bought and connected ${number}.` };
}

// ---- Contacts ----

export async function addContact(subaccountId, prev, fd) {
    const { supabase } = await requireSubaccount(subaccountId);
    const row = {
        subaccount_id: subaccountId,
        name: opt(fd, 'name'),
        phone: toE164(opt(fd, 'phone')),
        email: opt(fd, 'email'),
        notes: opt(fd, 'notes'),
        source: 'manual'
    };
    if (!row.name && !row.phone && !row.email) return { error: 'Enter a name, phone, or email.' };
    const { error } = await supabase.from('contacts').insert(row);
    if (error) return { error: error.message };
    revalidatePath(`/s/${subaccountId}/contacts`);
    return { message: 'Contact added.' };
}

// ---- Team ----

export async function inviteUser(prev, fd) {
    await requireAdmin();
    const email = str(fd, 'email').toLowerCase();
    if (!email) return { error: 'Email is required.' };
    const db = createAdminClient();
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
        data: { full_name: str(fd, 'full_name') },
        redirectTo: `${process.env.PUBLIC_BASE_URL || ''}/account`
    });
    if (error) return { error: error.message };
    const subs = fd.getAll('subaccounts').map(String);
    if (subs.length) await db.from('memberships').upsert(subs.map((s) => ({ user_id: data.user.id, subaccount_id: s })));
    if (fd.get('role') === 'agency_admin') await db.from('profiles').update({ role: 'agency_admin' }).eq('id', data.user.id);
    revalidatePath('/team');
    return { message: `Invite sent to ${email}.` };
}

export async function updateMember(userId, prev, fd) {
    const { user } = await requireAdmin();
    const db = createAdminClient();
    const role = fd.get('role') === 'agency_admin' ? 'agency_admin' : 'member';
    if (userId === user.id && role !== 'agency_admin') return { error: 'You cannot remove your own admin access.' };
    await db.from('profiles').update({ role }).eq('id', userId);
    const subs = fd.getAll('subaccounts').map(String);
    const { error: delError } = await db.from('memberships').delete().eq('user_id', userId);
    if (delError) return { error: delError.message };
    if (subs.length) {
        const { error } = await db.from('memberships').insert(subs.map((s) => ({ user_id: userId, subaccount_id: s })));
        if (error) return { error: error.message };
    }
    revalidatePath('/team');
    return { message: 'Saved.' };
}

// ---- Account ----

export async function updateAccount(prev, fd) {
    const { supabase, user } = await requireUser();
    const fullName = str(fd, 'full_name');
    const password = str(fd, 'password');
    if (password) {
        if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return { error: error.message };
    }
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
    revalidatePath('/', 'layout');
    return { message: 'Saved.' };
}
