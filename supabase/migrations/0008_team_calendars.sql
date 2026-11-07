-- Appointments the AI receptionist books on a team member's own Google Calendar
-- (the contact's assigned person in the CRM) instead of the business calendar.
alter table public.appointments add column if not exists google_calendar_id text;
alter table public.appointments add column if not exists crm_assignee_id text;
