-- AiLocal platform schema: agency -> unlimited subaccounts, team members, contacts, AI receptionist calls.

create extension if not exists pgcrypto;

-- Profiles mirror auth.users. role: 'agency_admin' sees everything; 'member' sees assigned subaccounts.
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null,
    full_name text,
    role text not null default 'member' check (role in ('agency_admin', 'member')),
    created_at timestamptz not null default now()
);

create table public.subaccounts (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    business_phone text,
    website text,
    timezone text not null default 'America/Chicago',
    twilio_number text unique,
    notify_phone text,
    notify_email text,
    receptionist_enabled boolean not null default true,
    greeting text not null default 'Thanks for calling! How can I help you today?',
    business_info text not null default '',
    instructions text not null default '',
    transfer_number text,
    created_at timestamptz not null default now()
);

create table public.memberships (
    user_id uuid not null references public.profiles (id) on delete cascade,
    subaccount_id uuid not null references public.subaccounts (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, subaccount_id)
);

create table public.contacts (
    id uuid primary key default gen_random_uuid(),
    subaccount_id uuid not null references public.subaccounts (id) on delete cascade,
    name text,
    phone text,
    email text,
    source text not null default 'manual',
    notes text,
    created_at timestamptz not null default now()
);
create index contacts_subaccount_idx on public.contacts (subaccount_id, created_at desc);

create table public.calls (
    id uuid primary key default gen_random_uuid(),
    subaccount_id uuid not null references public.subaccounts (id) on delete cascade,
    twilio_call_sid text unique,
    from_number text,
    to_number text,
    status text not null default 'in-progress',
    -- Full Claude message history (append-only, includes thinking/tool blocks).
    messages jsonb not null default '[]'::jsonb,
    -- Human-readable transcript: [{role: 'caller'|'ai', text, at}]
    transcript jsonb not null default '[]'::jsonb,
    summary text,
    lead_captured boolean not null default false,
    contact_id uuid references public.contacts (id) on delete set null,
    duration_seconds integer,
    started_at timestamptz not null default now(),
    ended_at timestamptz
);
create index calls_subaccount_idx on public.calls (subaccount_id, started_at desc);

-- Helpers (security definer so RLS policies don't recurse).
create or replace function public.is_agency_admin() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'agency_admin');
$$;

create or replace function public.has_subaccount(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select public.is_agency_admin()
        or exists (select 1 from public.memberships where user_id = auth.uid() and subaccount_id = sid);
$$;

-- New auth user -> profile. First user ever becomes agency admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, email, full_name, role)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'full_name', ''),
        case when exists (select 1 from public.profiles) then 'member' else 'agency_admin' end
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Row level security
alter table public.profiles enable row level security;
alter table public.subaccounts enable row level security;
alter table public.memberships enable row level security;
alter table public.contacts enable row level security;
alter table public.calls enable row level security;

create policy profiles_select on public.profiles for select
    using (id = auth.uid() or public.is_agency_admin());
create policy profiles_update_self on public.profiles for update
    using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy profiles_admin_all on public.profiles for all
    using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy subaccounts_select on public.subaccounts for select using (public.has_subaccount(id));
create policy subaccounts_update on public.subaccounts for update using (public.has_subaccount(id)) with check (public.has_subaccount(id));
create policy subaccounts_admin_insert on public.subaccounts for insert with check (public.is_agency_admin());
create policy subaccounts_admin_delete on public.subaccounts for delete using (public.is_agency_admin());

create policy memberships_select on public.memberships for select
    using (user_id = auth.uid() or public.is_agency_admin());
create policy memberships_admin_all on public.memberships for all
    using (public.is_agency_admin()) with check (public.is_agency_admin());

create policy contacts_all on public.contacts for all
    using (public.has_subaccount(subaccount_id)) with check (public.has_subaccount(subaccount_id));

create policy calls_select on public.calls for select using (public.has_subaccount(subaccount_id));
create policy calls_update on public.calls for update
    using (public.has_subaccount(subaccount_id)) with check (public.has_subaccount(subaccount_id));
