-- Link a subaccount to its CRM funnel so every lead lands in the CRM and every
-- lead texts the owner. Leads from Ari are sent to the CRM under this slug, and
-- the CRM's new-lead alerts name this slug to find the business here.
alter table public.subaccounts add column if not exists crm_funnel_slug text unique;
