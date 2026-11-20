-- Business members may edit their own settings, but not the ones that route
-- calls, texts, leads and bookings. Only the agency (or the server) can change:
-- twilio_number, crm_funnel_slug, calendar_id, voice_model.
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
        or new.voice_model is distinct from old.voice_model then
        raise exception 'Only the agency can change the phone number, CRM link, calendar or voice model.'
            using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists subaccounts_admin_columns on public.subaccounts;
create trigger subaccounts_admin_columns before update on public.subaccounts
    for each row execute function public.guard_subaccount_admin_columns();
