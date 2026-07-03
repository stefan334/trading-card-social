/**
 * App domain types mirroring the Supabase schema (see supabase/migrations/).
 * Keep these in sync with the DB — regenerate via `supabase gen types typescript`
 * once the project is linked, and prefer the generated types where they diverge.
 */

export interface Profile {
  id: string; // = auth.users.id
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  favoriteGameId?: string;
  createdAt: string;
}

export type CardCondition = 'mint' | 'near_mint' | 'excellent' | 'good' | 'played' | 'poor';

export interface UserCard {
  id: string;
  ownerId: string;
  cardId: string; // Card.id (provider-namespaced)
  quantity: number;
  condition?: CardCondition;
  isForTrade: boolean;
  imageUrl?: string; // user's own scanned photo, if any
  acquiredAt: string;
}

export interface WishlistItem {
  id: string;
  userId: string;
  cardId: string;
  createdAt: string;
}

export type TradeStatus = 'proposed' | 'countered' | 'accepted' | 'completed' | 'declined' | 'cancelled';

export interface TradeItem {
  userCardId: string;
  fromUserId: string;
}

export interface Trade {
  id: string;
  initiatorId: string;
  counterpartyId: string;
  status: TradeStatus;
  items: TradeItem[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatThread {
  id: string;
  participantIds: [string, string];
  tradeId?: string;
  cardId?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  imageUrl?: string;
  createdAt: string;
}

export type NotificationType = 'wishlist_match' | 'trade_update' | 'chat_message' | 'new_follower';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}
