-- CardLink — user-uploaded photos of the actual card on marketplace listings.
--
-- Catalog art shows a pristine copy; a paid marketplace sells a specific
-- physical card, so listings carry up to 5 real photos (stored in the existing
-- public card-scans bucket under the owner's folder, kind 'listing').
-- Orders snapshot the photos at purchase time: they are the dispute evidence
-- for not-as-described claims and must survive listing edits/deletion.
-- The stripe-checkout edge function (phase B) requires >=1 photo to buy;
-- trade-only listings stay photo-optional.

alter table user_cards add column listing_photos text[] not null default '{}'
  check (coalesce(array_length(listing_photos, 1), 0) <= 5);

alter table orders add column card_photos text[] not null default '{}';
