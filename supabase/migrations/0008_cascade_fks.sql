-- CardLink — add ON DELETE CASCADE to trade/chat FKs
-- Without these, deleting a user (or a trade) errors when trade/chat history
-- references it. user_cards/wishlists/follows/notifications/thread_reads already
-- cascade; this brings trades, trade_items, chat_threads, chat_messages in line.

-- trades -> profiles
alter table trades drop constraint trades_initiator_id_fkey,
  add constraint trades_initiator_id_fkey foreign key (initiator_id) references profiles(id) on delete cascade;
alter table trades drop constraint trades_counterparty_id_fkey,
  add constraint trades_counterparty_id_fkey foreign key (counterparty_id) references profiles(id) on delete cascade;

-- trade_items -> profiles / user_cards (trade_id already cascades)
alter table trade_items drop constraint trade_items_from_user_id_fkey,
  add constraint trade_items_from_user_id_fkey foreign key (from_user_id) references profiles(id) on delete cascade;
alter table trade_items drop constraint trade_items_user_card_id_fkey,
  add constraint trade_items_user_card_id_fkey foreign key (user_card_id) references user_cards(id) on delete cascade;

-- chat_threads -> profiles / trades (thread_id on chat_messages already cascades)
alter table chat_threads drop constraint chat_threads_participant_one_fkey,
  add constraint chat_threads_participant_one_fkey foreign key (participant_one) references profiles(id) on delete cascade;
alter table chat_threads drop constraint chat_threads_participant_two_fkey,
  add constraint chat_threads_participant_two_fkey foreign key (participant_two) references profiles(id) on delete cascade;
alter table chat_threads drop constraint chat_threads_trade_id_fkey,
  add constraint chat_threads_trade_id_fkey foreign key (trade_id) references trades(id) on delete cascade;

-- chat_messages -> profiles
alter table chat_messages drop constraint chat_messages_sender_id_fkey,
  add constraint chat_messages_sender_id_fkey foreign key (sender_id) references profiles(id) on delete cascade;
