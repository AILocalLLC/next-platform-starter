-- Downtime alerts: one row per thing the uptime check watches (CRM, Ari, websites).
-- Server only (service role): RLS on with no policies, so no signed-in user can read it.

create table public.uptime_checks (
    name text primary key,
    fail_count integer not null default 0,
    failing_since timestamptz,
    alerted boolean not null default false,
    last_error text,
    updated_at timestamptz not null default now()
);

alter table public.uptime_checks enable row level security;
