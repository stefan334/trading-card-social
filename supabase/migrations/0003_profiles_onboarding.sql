-- CardLink — onboarding signal
-- A profile row is auto-created (with a placeholder username) by handle_new_user
-- on sign-up. `onboarded_at` is null until the user completes the onboarding flow
-- (picks a real username, display name, favorite game). The app routes any
-- signed-in user with a null onboarded_at into onboarding before the tabs.

alter table profiles add column onboarded_at timestamptz;
