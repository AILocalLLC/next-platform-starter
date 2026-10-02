-- Contact tags (GHL import) and website chat channel.

alter table public.contacts add column tags text[] not null default '{}';
create index contacts_phone_idx on public.contacts (subaccount_id, phone);
create index contacts_email_idx on public.contacts (subaccount_id, lower(email));

alter table public.calls add column channel text not null default 'phone' check (channel in ('phone', 'web'));
alter table public.calls add column chat_token text;

alter table public.subaccounts add column chat_enabled boolean not null default false;
alter table public.subaccounts add column chat_greeting text not null default 'Hi! How can I help you today?';
