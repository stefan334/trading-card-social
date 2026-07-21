-- CardLink — listing composer: optional seller description on listings.
-- (Photos became required-to-list at the same time, enforced in the composer
-- UI — the checkout edge function independently enforces them for purchases.)

alter table user_cards add column listing_description text
  check (listing_description is null or char_length(listing_description) <= 500);
