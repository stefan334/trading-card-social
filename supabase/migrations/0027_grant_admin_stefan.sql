-- CardLink — one-off data migration: grant admin to the founder account.
-- (profiles.is_admin gates the moderation screen and admin RPCs; see 0018.)
-- Raises if the email matches no auth user so a silent no-op can't slip through.

do $$
declare
  n int;
begin
  update profiles
  set is_admin = true
  where id = (
    select id from auth.users where email = 'stefan.ivan334@gmail.com'
  );

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'no profile found for stefan.ivan334@gmail.com';
  end if;
end $$;
