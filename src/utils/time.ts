/** Format a price with a currency symbol, e.g. formatPrice(2.67, 'EUR') -> "€2.67". */
export function formatPrice(amount: number, currency: string): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '';
  return `${symbol}${amount.toFixed(2)}`;
}

/** Compact relative time for feed/chat timestamps, e.g. "3m", "2h", "5d", "Mar 4". */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);

  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
