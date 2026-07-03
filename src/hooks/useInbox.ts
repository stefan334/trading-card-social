import { useChatThreads } from './useChatThreads';
import { useTrades } from './useTrades';
import type { TradeStatus } from '../types/domain';

export interface InboxItem {
  key: string;
  kind: 'trade' | 'dm';
  /** Route to open this item. */
  href: string;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  timestamp: string | null;
  unread: number;
  status?: TradeStatus;
  needsAction?: boolean;
}

/**
 * Unified inbox: trades + direct-message threads (excluding trade-linked threads,
 * which are represented by the trade itself), sorted by most recent activity.
 * Trades open the trade screen (chat is inline there); DMs open the chat screen.
 */
export function useInbox() {
  const trades = useTrades();
  const chats = useChatThreads();

  const isLoading = trades.isLoading || chats.isLoading;

  const items: InboxItem[] = [];

  for (const t of trades.data ?? []) {
    items.push({
      key: `trade:${t.id}`,
      kind: 'trade',
      href: `/trade/${t.id}`,
      title: t.counterpart?.displayName || t.counterpart?.username || 'Unknown',
      subtitle: t.direction === 'incoming' ? 'Trade offer to you' : 'Your trade offer',
      avatarUrl: t.counterpart?.avatarUrl ?? null,
      timestamp: t.updatedAt,
      unread: 0,
      status: t.status,
      needsAction: t.direction === 'incoming' && t.status === 'proposed',
    });
  }

  for (const c of chats.data ?? []) {
    if (c.tradeId) continue; // trade-linked chats live under the trade
    items.push({
      key: `dm:${c.threadId}`,
      kind: 'dm',
      href: `/chat/${c.threadId}`,
      title: c.other?.displayName || c.other?.username || 'Unknown',
      subtitle: c.lastBody ?? (c.cardId ? 'About a card' : 'No messages yet'),
      avatarUrl: c.other?.avatarUrl ?? null,
      timestamp: c.lastAt,
      unread: c.unread,
    });
  }

  items.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));

  return { items, isLoading };
}
