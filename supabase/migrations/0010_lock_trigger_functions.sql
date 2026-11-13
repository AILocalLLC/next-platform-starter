-- Trigger-only functions: nobody needs to call them directly through the API.
-- Triggers keep working: Postgres checks EXECUTE only when a trigger is created, not when it fires.
revoke execute on function public.guard_subaccount_admin_columns() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
