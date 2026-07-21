import { useQuery } from '@tanstack/react-query';
import { dbSearchCards } from '../services/catalog';
import { getProvider } from '../services/tcg-providers';
import type { Card } from '../types/card';

/**
 * Cardmarket-style query parsing: a trailing number token is treated as the
 * collector number. "emma 76", "charizard #4" and "charizard 4/102" all become
 * { name, number }; names that merely end in digits ("porygon2") are untouched
 * because the number must be separated by a space or '#'.
 */
export function parseCardQuery(raw: string): { name: string; number: string | null } {
  const q = raw.trim();
  const m = q.match(/^(.{2,}?)[\s#]+(\d{1,4})(?:\s*\/\s*\d{1,4})?$/);
  if (m) return { name: m[1].trim(), number: m[2] };
  return { name: q, number: null };
}

/**
 * Search a game's cards by name — with optional "name number" syntax and an
 * optional set restriction. DB-first via the trigram index (instant once the
 * catalog is synced); falls back to the live provider API when the local
 * catalog has no match / isn't populated yet.
 */
export function useCardSearch(query: string, gameId: string, setId?: string | null) {
  const q = query.trim();
  const { name, number } = parseCardQuery(q);

  return useQuery({
    queryKey: ['card-search', gameId, q, setId ?? null],
    enabled: q.length >= 2,
    queryFn: async (): Promise<Card[]> => {
      const local = await dbSearchCards(gameId, name, 30, { number, setId });
      if (local && local.length) return local;
      const { cards } = await getProvider(gameId).searchCards({
        name,
        number: number ?? undefined,
        setId: setId ?? undefined,
        pageSize: 30,
      });
      return cards;
    },
  });
}
