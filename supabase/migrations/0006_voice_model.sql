-- Optional per-business phone model, for trying a faster model on one line.
-- Null (the default) uses the platform's standard phone model.
alter table public.subaccounts add column if not exists voice_model text;
