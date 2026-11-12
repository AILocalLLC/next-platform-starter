-- Customers who texted STOP to a business's number. Checked before every text to a customer.
-- Written only by the server (service role); members can see their business's list.

create table public.sms_opt_outs (
    subaccount_id uuid not null references public.subaccounts (id) on delete cascade,
    phone text not null,
    opted_out_at timestamptz not null default now(),
    primary key (subaccount_id, phone)
);

alter table public.sms_opt_outs enable row level security;
create policy sms_opt_outs_select on public.sms_opt_outs for select using (public.has_subaccount(subaccount_id));
