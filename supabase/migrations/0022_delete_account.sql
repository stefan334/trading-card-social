-- CardLink — self-service account deletion (required by app stores for any app
-- with accounts). All public-schema FKs cascade from profiles (audited), and
-- profiles cascades from auth.users, so deleting the auth user removes the
-- account and all its content in one statement.

create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  -- Best-effort: drop the user's uploaded files (avatars, scans, chat images).
  -- Never let storage cleanup block the deletion itself.
  begin
    delete from storage.objects where owner = uid or owner_id = uid::text;
  exception when others then
    null;
  end;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function delete_account() from public;
grant execute on function delete_account() to authenticated;
