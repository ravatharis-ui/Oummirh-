-- =============================================================================
-- 20260922140000_core_function_grants — fermer l'exécution par défaut
--
-- Supabase applique `alter default privileges ... grant all on functions to anon,
-- authenticated`. Every function therefore starts out callable by an anonymous
-- visitor, and `revoke all from public` does not undo an explicit grant to a role.
--
-- The consequence was real: `verify_employee_pin` was reachable without any
-- session. The lockout still capped the damage at five tries per collaboratrice,
-- but an anonymous caller could bypass the application's own throttle and lock
-- every account at will.
--
-- This migration does two things: it revokes what should never have been granted,
-- and it flips the default so a future function is private until granted.
-- =============================================================================

-- Future functions created by `postgres` in `public` are no longer callable by
-- the API roles unless a migration grants it explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- --- Internals: no API role has any business calling these -------------------
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- --- Read helpers: signed-in users only, never anonymous ---------------------
revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_role(text, uuid) from public, anon;
revoke all on function public.is_acceptable_pin(text) from public, anon;
revoke all on function public.current_employee_id() from public, anon;

-- --- PIN verification: server side only --------------------------------------
-- This is the one that mattered. It must be unreachable from any browser,
-- signed in or not: the only legitimate caller is the login route handler,
-- which holds the service key and applies its own per-IP throttle.
revoke all on function public.verify_employee_pin(uuid, text, inet)
  from public, anon, authenticated;
grant execute on function public.verify_employee_pin(uuid, text, inet) to service_role;

-- --- Direction actions: signed in, and the function re-checks the role --------
revoke all on function public.reset_employee_pin(uuid, text) from public, anon;
revoke all on function public.admin_create_employee from public, anon;

-- --- Pre-login lookups: anonymous on purpose, minimal columns ----------------
-- login_boutiques / login_employees / login_employee keep their grant to `anon`:
-- the login screen needs them before any session exists, and they return nothing
-- beyond a first name.
