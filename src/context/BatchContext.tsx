import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Card, CardSet } from '../types/card';
import type { CardFinish } from '../types/domain';

export interface BatchItem {
  key: string;
  card: Card;
  set: CardSet;
  /** Print finish of this physical copy — set per card (scan confirm / review sheet). */
  finish: CardFinish;
}

interface BatchContextValue {
  items: BatchItem[];
  add: (card: Card, set: CardSet, finish?: CardFinish) => void;
  removeAt: (key: string) => void;
  /** Remove one copy of a card id from the tray (the most recently added). */
  removeOne: (cardId: string) => void;
  /** Change one queued copy's finish. */
  setFinish: (key: string, finish: CardFinish) => void;
  /** Bulk-set every queued copy's finish (review sheet "apply to all"). */
  setAllFinishes: (finish: CardFinish) => void;
  clear: () => void;
}

const BatchContext = createContext<BatchContextValue | undefined>(undefined);

/**
 * Holds a tray of cards being added together (e.g. opening a pack). Both the
 * scanner and the batch screen push into it; committing adds them all at once,
 * which the feed groups into a single "added N cards" post.
 */
export function BatchProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const add = useCallback((card: Card, set: CardSet, finish: CardFinish = 'normal') => {
    setItems((prev) => [...prev, { key: `${card.id}-${Date.now()}-${Math.random()}`, card, set, finish }]);
  }, []);
  const removeAt = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const removeOne = useCallback(
    (cardId: string) =>
      setItems((prev) => {
        let lastIdx = -1;
        for (let i = 0; i < prev.length; i++) if (prev[i].card.id === cardId) lastIdx = i;
        return lastIdx === -1 ? prev : prev.filter((_, i) => i !== lastIdx);
      }),
    []
  );
  const setFinish = useCallback(
    (key: string, finish: CardFinish) =>
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, finish } : i))),
    []
  );
  const setAllFinishes = useCallback(
    (finish: CardFinish) => setItems((prev) => prev.map((i) => ({ ...i, finish }))),
    []
  );
  const clear = useCallback(() => setItems([]), []);

  return (
    <BatchContext.Provider value={{ items, add, removeAt, removeOne, setFinish, setAllFinishes, clear }}>
      {children}
    </BatchContext.Provider>
  );
}

export function useBatch(): BatchContextValue {
  const ctx = useContext(BatchContext);
  if (!ctx) throw new Error('useBatch must be used within a <BatchProvider>');
  return ctx;
}
