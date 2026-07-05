-- CardLink — marketplace: per-card asking price + public wishlists
-- Informational pricing only (no in-app payment): when a card is marked for
-- trade, the owner can set an asking cash price (EUR, to match the Cardmarket
-- reference we display). A null price means "open to card trades / offers".

alter table user_cards add column sale_price numeric(10, 2);

-- Wishlists become publicly readable so profiles and trade partners can see what
-- someone wants (a social trading app benefits from this). Owner-only write is
-- unchanged; the wishlist-match trigger uses SECURITY DEFINER regardless.
drop policy if exists "wishlists readable by owner" on wishlists;
create policy "wishlists readable by all" on wishlists for select using (true);
