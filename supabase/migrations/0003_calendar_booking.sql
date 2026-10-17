-- Google Calendar booking settings and booked appointments.

alter table public.subaccounts add column calendar_id text;
alter table public.subaccounts add column appointment_minutes integer not null default 60;
alter table public.subaccounts add column booking_days text not null default '1,2,3,4,5';
alter table public.subaccounts add column booking_start text not null default '09:00';
alter table public.subaccounts add column booking_end text not null default '17:00';
alter table public.subaccounts add column booking_notice_hours integer not null default 12;

create table public.appointments (
    id uuid primary key default gen_random_uuid(),
    subaccount_id uuid not null references public.subaccounts (id) on delete cascade,
    contact_id uuid references public.contacts (id) on delete set null,
    call_id uuid references public.calls (id) on delete set null,
    start_at timestamptz not null,
    end_at timestamptz not null,
    google_event_id text,
    status text not null default 'booked',
    created_at timestamptz not null default now()
);
create index appointments_subaccount_idx on public.appointments (subaccount_id, start_at);

alter table public.appointments enable row level security;
create policy appointments_all on public.appointments for all
    using (public.has_subaccount(subaccount_id)) with check (public.has_subaccount(subaccount_id));
