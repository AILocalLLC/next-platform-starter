-- Phone engine per business: 'gather' (Twilio <Gather>, one webhook per turn) or
-- 'relay' (Twilio ConversationRelay through the WebSocket bridge on the CRM API).
alter table public.subaccounts add column if not exists voice_engine text not null default 'gather';
alter table public.subaccounts drop constraint if exists subaccounts_voice_engine_check;
alter table public.subaccounts add constraint subaccounts_voice_engine_check check (voice_engine in ('gather', 'relay'));

-- Agency-only, like the other call-routing settings (0007).
create or replace function public.guard_subaccount_admin_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    -- Server-side code (service role) has no auth.uid().
    if auth.uid() is null or public.is_agency_admin() then
        return new;
    end if;
    if new.twilio_number is distinct from old.twilio_number
        or new.crm_funnel_slug is distinct from old.crm_funnel_slug
        or new.calendar_id is distinct from old.calendar_id
        or new.voice_model is distinct from old.voice_model
        or new.voice_engine is distinct from old.voice_engine then
        raise exception 'Only the agency can change the phone number, CRM link, calendar or voice settings.'
            using errcode = '42501';
    end if;
    return new;
end;
$$;
