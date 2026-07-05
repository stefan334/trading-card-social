-- CardLink — user location for the local marketplace
-- Coordinates are stored ROUNDED (~1km, 2 decimals) since profiles are public —
-- enough to compute "near me" distance and meet up locally, without exposing an
-- exact home address. `location_name` is a coarse city/region label.
alter table profiles add column latitude numeric(8, 2);
alter table profiles add column longitude numeric(8, 2);
alter table profiles add column location_name text;
