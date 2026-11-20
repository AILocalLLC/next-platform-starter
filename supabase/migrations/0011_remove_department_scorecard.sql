-- The unused "department scorecard" (added 2026-10-25 outside this app; no data). Removed at the owner's request.
drop function if exists public.dept_admin_get(text);
drop function if exists public.dept_admin_set(text, jsonb);
drop function if exists public.dept_admin_json(uuid);
drop function if exists public.dept_create(jsonb);
drop function if exists public.dept_get(text);
drop function if exists public.dept_save(text, jsonb, jsonb, jsonb, boolean);
drop function if exists public.dept_clean_person(jsonb);
drop function if exists public.dept_allowed(text);
drop table if exists public.dept_responses;
drop table if exists public.dept_assessments;
