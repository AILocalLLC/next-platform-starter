-- Two-way text messaging on each subaccount's number (replaces GHL Conversations for SMS).

create table public.messages (
    id uuid primary key default gen_random_uuid(),
    subaccount_id uuid not null references public.subaccounts (id) on delete cascade,
    contact_id uuid references public.contacts (id) on delete set null,
    direction text not null check (direction in ('in', 'out')),
    -- The customer's number, whichever way the message went.
    phone text not null,
    body text not null default '',
    media_urls text[] not null default '{}',
    twilio_sid text unique,
    status text,
    sent_by uuid references public.profiles (id) on delete set null,
    read_at timestamptz,
    created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (subaccount_id, phone, created_at desc);
create index messages_recent_idx on public.messages (subaccount_id, created_at desc);

alter table public.messages enable row level security;
create policy messages_all on public.messages for all
    using (public.has_subaccount(subaccount_id)) with check (public.has_subaccount(subaccount_id));
