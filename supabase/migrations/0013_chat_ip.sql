-- Hashed website-chat visitor IP, so the per-IP chat limit holds across servers.
-- Only a salted sha256 hash is stored, never the raw IP. Null for phone calls.

alter table public.calls add column if not exists client_ip_hash text;

create index if not exists calls_client_ip_idx on public.calls (client_ip_hash, started_at desc) where client_ip_hash is not null;
